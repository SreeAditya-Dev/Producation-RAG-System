from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Float, Boolean, UniqueConstraint, inspect as sa_inspect, text
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


class Chunk(Base):
    """
    Full (untruncated) chunk text used as the BM25 lexical search corpus.
    Pinecone's metadata copy is capped at 1000 chars and is dense-vector only.
    """
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doc_id = Column(String, nullable=False, index=True)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    char_start = Column(Integer, nullable=True)
    char_end = Column(Integer, nullable=True)
    boundary_level = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=True, index=True)
    client_id = Column(String, nullable=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    processing_time = Column(Float, default=0.0)
    status = Column(String, default="success")       # success | error
    failure_stage = Column(String, nullable=True)    # embed | retrieve | rerank | llm
    error_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class QueryMetrics(Base):
    """Per-query request telemetry; answer faithfulness is never inferred from reranking."""
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
    # Legacy column retained for existing installations. New code writes the
    # explicitly named reranker relevance proxy below.
    faithfulness_score = Column(Float, nullable=True)
    reranker_relevance_proxy = Column(Float, nullable=True)
    # CRAG: retrieval evaluator grade + confidence, and whether the web search
    # fallback was invoked (grade in {"correct", "incorrect", "ambiguous"})
    crag_grade = Column(String, nullable=True)
    crag_confidence = Column(Float, nullable=True)
    crag_web_results_used = Column(Integer, nullable=True)
    # Budgeting, diversity, and output-grounding telemetry.
    context_tokens_estimated = Column(Integer, nullable=True)
    history_tokens_estimated = Column(Integer, nullable=True)
    context_chunks_dropped = Column(Integer, nullable=True)
    mmr_applied = Column(Boolean, nullable=True)
    citation_valid = Column(Boolean, nullable=True)
    citation_cited_source_count = Column(Integer, nullable=True)
    citation_invalid_citations = Column(Text, nullable=True)
    citation_verifier_used = Column(Boolean, nullable=True)
    citation_repaired = Column(Boolean, nullable=True)
    cache_type = Column(String, nullable=True)
    retry_attempt_count = Column(Integer, nullable=True)
    retry_reason = Column(String, nullable=True)
    retry_rewritten_query = Column(Text, nullable=True)
    retry_latency_ms = Column(Float, nullable=True)
    retry_candidate_overlap = Column(Float, nullable=True)
    retry_chosen = Column(Boolean, nullable=True)
    stream_completed = Column(Boolean, nullable=True)
    budget_exhaustion_reason = Column(String, nullable=True)
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


class QueryFeedback(Base):
    __tablename__ = "query_feedback"
    __table_args__ = (UniqueConstraint("query_id", "client_id", name="uq_query_feedback_actor"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String, nullable=False, index=True)
    client_id = Column(String, nullable=False, index=True)
    rating = Column(String, nullable=False)  # up | down
    correction = Column(Text, nullable=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
            ("session_id",    "ALTER TABLE query_history ADD COLUMN session_id VARCHAR"),
            ("client_id",     "ALTER TABLE query_history ADD COLUMN client_id VARCHAR"),
        ],
        "query_metrics": [
            ("crag_grade",            "ALTER TABLE query_metrics ADD COLUMN crag_grade VARCHAR"),
            ("crag_confidence",       "ALTER TABLE query_metrics ADD COLUMN crag_confidence FLOAT"),
            ("crag_web_results_used", "ALTER TABLE query_metrics ADD COLUMN crag_web_results_used INTEGER"),
            ("context_tokens_estimated", "ALTER TABLE query_metrics ADD COLUMN context_tokens_estimated INTEGER"),
            ("history_tokens_estimated", "ALTER TABLE query_metrics ADD COLUMN history_tokens_estimated INTEGER"),
            ("context_chunks_dropped", "ALTER TABLE query_metrics ADD COLUMN context_chunks_dropped INTEGER"),
            ("mmr_applied", "ALTER TABLE query_metrics ADD COLUMN mmr_applied BOOLEAN"),
            ("citation_valid", "ALTER TABLE query_metrics ADD COLUMN citation_valid BOOLEAN"),
            ("citation_cited_source_count", "ALTER TABLE query_metrics ADD COLUMN citation_cited_source_count INTEGER"),
            ("citation_invalid_citations", "ALTER TABLE query_metrics ADD COLUMN citation_invalid_citations TEXT"),
            ("reranker_relevance_proxy", "ALTER TABLE query_metrics ADD COLUMN reranker_relevance_proxy FLOAT"),
            ("citation_verifier_used", "ALTER TABLE query_metrics ADD COLUMN citation_verifier_used BOOLEAN"),
            ("citation_repaired", "ALTER TABLE query_metrics ADD COLUMN citation_repaired BOOLEAN"),
            ("cache_type", "ALTER TABLE query_metrics ADD COLUMN cache_type VARCHAR"),
            ("retry_attempt_count", "ALTER TABLE query_metrics ADD COLUMN retry_attempt_count INTEGER"),
            ("retry_reason", "ALTER TABLE query_metrics ADD COLUMN retry_reason VARCHAR"),
            ("retry_rewritten_query", "ALTER TABLE query_metrics ADD COLUMN retry_rewritten_query TEXT"),
            ("retry_latency_ms", "ALTER TABLE query_metrics ADD COLUMN retry_latency_ms FLOAT"),
            ("retry_candidate_overlap", "ALTER TABLE query_metrics ADD COLUMN retry_candidate_overlap FLOAT"),
            ("retry_chosen", "ALTER TABLE query_metrics ADD COLUMN retry_chosen BOOLEAN"),
            ("stream_completed", "ALTER TABLE query_metrics ADD COLUMN stream_completed BOOLEAN"),
            ("budget_exhaustion_reason", "ALTER TABLE query_metrics ADD COLUMN budget_exhaustion_reason VARCHAR"),
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
