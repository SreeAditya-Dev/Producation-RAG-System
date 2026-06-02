from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Float, inspect as sa_inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from datetime import datetime
import uuid

from app.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_name = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    status = Column(String, default="processing")
    chunk_count = Column(Integer, default=0)
    file_size = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(Text, nullable=True)


class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    processing_time = Column(Float, default=0.0)
    status = Column(String, default="success")       # success | error
    failure_stage = Column(String, nullable=True)    # embed | retrieve | rerank | llm
    error_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class QueryMetrics(Base):
    """Per-query: stage latencies, token usage, retrieval quality, faithfulness proxy."""
    __tablename__ = "query_metrics"

    id = Column(String, primary_key=True)            # == query_id
    # Stage latencies (ms)
    embed_ms = Column(Float, nullable=True)
    retrieve_ms = Column(Float, nullable=True)
    rerank_ms = Column(Float, nullable=True)
    llm_ms = Column(Float, nullable=True)
    total_ms = Column(Float, nullable=True)
    # Token usage
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    embed_tokens = Column(Integer, nullable=True)
    # Retrieval quality
    candidate_count = Column(Integer, nullable=True)
    returned_count = Column(Integer, nullable=True)
    retrieval_score_mean = Column(Float, nullable=True)
    retrieval_score_max = Column(Float, nullable=True)
    rerank_score_top = Column(Float, nullable=True)
    # Hallucination proxy: sigmoid(mean rerank logit) → 0-1
    faithfulness_score = Column(Float, nullable=True)
    # Status
    status = Column(String, default="success")
    failure_stage = Column(String, nullable=True)
    error_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class IngestionMetrics(Base):
    """Per-document: stage latencies, token usage, failure tracking."""
    __tablename__ = "ingestion_metrics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doc_id = Column(String, nullable=False, index=True)
    # Stage latencies (ms)
    download_ms = Column(Float, nullable=True)
    parse_ms = Column(Float, nullable=True)
    chunk_ms = Column(Float, nullable=True)
    embed_ms = Column(Float, nullable=True)
    store_ms = Column(Float, nullable=True)
    total_ms = Column(Float, nullable=True)
    # Content stats
    char_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    embed_tokens = Column(Integer, nullable=True)
    # Status
    status = Column(String, default="success")
    failure_stage = Column(String, nullable=True)    # download|parse|chunk|embed|store
    error_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def _apply_migrations() -> None:
    """
    Safely add new columns to existing tables without dropping data.
    create_all() only creates new tables; this handles additive column additions.
    """
    insp = sa_inspect(engine)
    existing_tables = set(insp.get_table_names())

    additions: dict = {
        "query_history": [
            ("status",        "ALTER TABLE query_history ADD COLUMN status VARCHAR DEFAULT 'success'"),
            ("failure_stage", "ALTER TABLE query_history ADD COLUMN failure_stage TEXT"),
            ("error_type",    "ALTER TABLE query_history ADD COLUMN error_type TEXT"),
        ],
    }

    with engine.begin() as conn:
        for table, cols in additions.items():
            if table not in existing_tables:
                continue
            existing_cols = {c["name"] for c in insp.get_columns(table)}
            for col_name, ddl in cols:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(ddl))
                    except Exception:
                        pass  # race condition: another process already added it


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_migrations()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
