"""
RAG Pipeline Flow & Query Cache System Test Suite.

Tests:
1. End-to-end pipeline flow: Embedding -> BM25 + Pinecone -> Reranker -> Context Compressor -> LLM Generation.
2. Exact query cache lookup:
   - First call: Cache miss, full pipeline runs.
   - Second call (same query, stateless session_id=None): Exact Cache hit, processing time ~0ms, returns cached answer & sources.
3. Semantic query cache lookup:
   - Call with rephrased query when semantic_cache_enabled=True: Semantic Cache hit.
4. Corpus fingerprint cache invalidation:
   - Insert a new document or change Document.updated_at in DB: verify previous cache keys miss immediately (corpus fingerprint changed).
"""

import asyncio
from datetime import datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base, Chunk, Document, QueryHistory, QueryMetrics
from app.pipeline import retrieval
from app.services.query_cache import query_cache


# ── Mocks & Stubs ─────────────────────────────────────────────────────────────

class MockWebSocketManager:
    async def broadcast(self, *args, **kwargs):
        return None


class MockEmbeddingService:
    def __init__(self):
        self.call_count = 0
        self.vector_map = {}

    def embed_query_tracked(self, question: str):
        self.call_count += 1
        vector = self.vector_map.get(question, [1.0, 0.0, 0.0])
        return vector, 10


class MockPineconeService:
    def __init__(self):
        self.query_count = 0

    def query(self, **kwargs):
        self.query_count += 1
        return [{
            "id": "doc-1-chunk-0",
            "score": 0.92,
            "metadata": {
                "doc_id": "doc-1",
                "original_name": "rag_architecture.md",
                "file_type": "md",
                "chunk_index": 0,
                "text": "RAG architecture combines dense vector retrieval with cross-encoder reranking and LLM synthesis.",
            },
            "values": None,
        }]


class MockRerankerService:
    def __init__(self):
        self.rerank_count = 0

    def rerank(self, question, candidates, top_k):
        self.rerank_count += 1
        result = [dict(c) for c in candidates[:top_k]]
        for candidate in result:
            candidate["rerank_score"] = 2.8
        return result


class MockDecomposer:
    async def decompose(self, question):
        return [question]


class MockTranslator:
    async def translate_query(self, question):
        return question


class MockLLMService:
    def __init__(self, answer_text: str = "RAG combines vector retrieval and reranking with LLM generation [S1]."):
        self.model = "test-llama-3-70b"
        self.answer_text = answer_text
        self.stream_count = 0

    def stream_messages(self, messages, on_token):
        self.stream_count += 1
        on_token(self.answer_text)
        return {"prompt_tokens": 45, "completion_tokens": 20}


# ── Database Fixture ──────────────────────────────────────────────────────────

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Add initial ready document and chunk for BM25 and vector lookup
    doc = Document(
        id="doc-1",
        original_name="rag_architecture.md",
        filename="rag_architecture.md",
        file_type="md",
        status="ready",
        chunk_count=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    chunk = Chunk(
        id="doc-1-chunk-0",
        doc_id="doc-1",
        original_name="rag_architecture.md",
        file_type="md",
        chunk_index=0,
        text="RAG architecture combines dense vector retrieval with cross-encoder reranking and LLM synthesis.",
        char_start=0,
        char_end=95,
        boundary_level="paragraph"
    )
    db.add(doc)
    db.add(chunk)
    db.commit()

    try:
        yield db
    finally:
        db.close()


def _clear_query_cache():
    query_cache._store.clear()
    query_cache._retrieval_store.clear()
    query_cache._answer_index.clear()
    query_cache._retrieval_index.clear()
    query_cache._fingerprint = None


def _configure_pipeline_mocks(monkeypatch, embed_service=None, llm_service=None):
    if embed_service is None:
        embed_service = MockEmbeddingService()
    if llm_service is None:
        llm_service = MockLLMService()

    pinecone_mock = MockPineconeService()
    reranker_mock = MockRerankerService()

    monkeypatch.setattr(retrieval, "manager", MockWebSocketManager())
    monkeypatch.setattr(retrieval, "embedding_service", embed_service)
    monkeypatch.setattr("app.services.embedding_service.embedding_service", embed_service)
    monkeypatch.setattr(retrieval, "pinecone_service", pinecone_mock)
    monkeypatch.setattr(retrieval, "reranker_service", reranker_mock)
    monkeypatch.setattr(retrieval, "query_decomposer", MockDecomposer())
    monkeypatch.setattr(retrieval, "QueryTranslator", MockTranslator)
    monkeypatch.setattr(retrieval, "llm_service", llm_service)
    monkeypatch.setattr(retrieval.settings, "crag_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)
    monkeypatch.setattr(retrieval.settings, "bm25_hybrid_enabled", True)

    return {
        "embedding": embed_service,
        "pinecone": pinecone_mock,
        "reranker": reranker_mock,
        "llm": llm_service,
    }


# ── Test 1: Standard End-to-End Pipeline Flow ──────────────────────────────────

@pytest.mark.asyncio
async def test_end_to_end_pipeline_flow(monkeypatch, db_session):
    """
    Rigorously tests standard end-to-end pipeline flow:
    Embedding -> BM25 + Pinecone -> Reranker -> Context Compressor -> LLM Generation.
    """
    _clear_query_cache()
    mocks = _configure_pipeline_mocks(monkeypatch)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)

    question = "What is the architecture of RAG?"
    result = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session)

    # 1. Verify Pipeline Response Contract
    assert result["query_id"] is not None
    assert result["question"] == question
    assert result["answer"].endswith("[S1].")
    assert len(result["sources"]) > 0
    assert result["sources"][0]["doc_id"] == "doc-1"
    assert result["processing_time"] > 0

    # 2. Verify Execution of All Stages
    assert mocks["embedding"].call_count > 0, "Embedding stage failed to execute"
    assert mocks["pinecone"].query_count > 0, "Pinecone dense retrieval stage failed to execute"
    assert mocks["reranker"].rerank_count > 0, "Reranker stage failed to execute"
    assert mocks["llm"].stream_count == 1, "LLM Generation stage failed to execute"

    # 3. Verify Database Persistence (QueryHistory & QueryMetrics)
    history = db_session.query(QueryHistory).filter_by(id=result["query_id"]).one()
    assert history.status == "success"
    assert history.question == question
    assert history.answer == result["answer"]

    metrics = db_session.query(QueryMetrics).filter_by(id=result["query_id"]).one()
    assert metrics.status == "success"
    assert metrics.cache_type == "none"
    assert metrics.prompt_tokens == 45
    assert metrics.completion_tokens == 20
    assert metrics.embed_ms is not None
    assert metrics.retrieve_ms is not None
    assert metrics.rerank_ms is not None
    assert metrics.llm_ms is not None
    assert metrics.total_ms is not None


# ── Test 2: Exact Query Cache Lookup ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_exact_query_cache_hit(monkeypatch, db_session):
    """
    Verifies exact query cache lookup:
    - First call: Cache miss, full pipeline runs.
    - Second call (same query, stateless session_id=None): Exact Cache hit, processing time ~0ms, returns cached answer & sources.
    """
    _clear_query_cache()
    mocks = _configure_pipeline_mocks(monkeypatch)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", True)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)

    question = "Explain Pinecone vector search architecture"

    # --- Call 1: Cache Miss ---
    res1 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)
    assert res1["answer"].endswith("[S1].")

    metrics1 = db_session.query(QueryMetrics).filter_by(id=res1["query_id"]).one()
    assert metrics1.cache_type == "none"
    assert mocks["llm"].stream_count == 1

    # --- Call 2: Exact Cache Hit ---
    res2 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)

    assert res2["answer"] == res1["answer"]
    assert res2["sources"] == res1["sources"]
    assert res2["processing_time"] == 0.0

    metrics2 = db_session.query(QueryMetrics).filter_by(id=res2["query_id"]).one()
    assert metrics2.cache_type == "exact"

    # LLM should NOT have been invoked on cache hit
    assert mocks["llm"].stream_count == 1, "LLM stream should not run on exact cache hit"


# ── Test 3: Semantic Query Cache Lookup ──────────────────────────────────────

@pytest.mark.asyncio
async def test_semantic_query_cache_hit(monkeypatch, db_session):
    """
    Verifies semantic query cache lookup:
    - Call with rephrased query when semantic_cache_enabled=True: Semantic Cache hit.
    """
    _clear_query_cache()

    embed_service = MockEmbeddingService()
    # Configure query embeddings for semantic matching
    # Query 1 and Query 2 have cosine similarity > 0.95 (above 0.92 threshold)
    q1 = "What is BM25 search?"
    q2 = "How does BM25 lexical search work?"

    # Unit vectors: q1 = [1.0, 0.0, 0.0], q2 = [0.99, 0.141, 0.0] -> dot product = 0.99
    embed_service.vector_map = {
        q1: [1.0, 0.0, 0.0],
        q2: [0.99, 0.141, 0.0],
    }

    mocks = _configure_pipeline_mocks(monkeypatch, embed_service=embed_service)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", True)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", True)

    # --- Call 1: Original Query (Cache Miss) ---
    res1 = await retrieval.retrieve_and_generate(q1, top_k=2, db_session=db_session, session_id=None)
    assert res1["answer"].endswith("[S1].")

    metrics1 = db_session.query(QueryMetrics).filter_by(id=res1["query_id"]).one()
    assert metrics1.cache_type == "none"
    assert mocks["llm"].stream_count == 1

    # --- Call 2: Rephrased Query (Semantic Cache Hit) ---
    res2 = await retrieval.retrieve_and_generate(q2, top_k=2, db_session=db_session, session_id=None)

    assert res2["answer"] == res1["answer"]
    assert res2["sources"] == res1["sources"]
    assert res2["processing_time"] == 0.0

    metrics2 = db_session.query(QueryMetrics).filter_by(id=res2["query_id"]).one()
    assert metrics2.cache_type == "semantic"

    # Verify LLM stream was not called again
    assert mocks["llm"].stream_count == 1, "LLM should not execute on semantic cache hit"


# ── Test 4: Corpus Fingerprint Cache Invalidation ─────────────────────────────

@pytest.mark.asyncio
async def test_corpus_fingerprint_cache_invalidation(monkeypatch, db_session):
    """
    Verifies corpus fingerprint cache invalidation:
    - Insert a new document or change Document.updated_at in DB:
      verify previous cache keys miss immediately (corpus fingerprint changed).
    """
    _clear_query_cache()
    mocks = _configure_pipeline_mocks(monkeypatch)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", True)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", True)

    question = "How are context chunks compressed?"

    # --- Step 1: Prime Cache with Query ---
    res1 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)
    assert db_session.query(QueryMetrics).filter_by(id=res1["query_id"]).one().cache_type == "none"
    assert mocks["llm"].stream_count == 1

    # --- Step 2: Verify Exact Cache Hit Before Invalidation ---
    res2 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)
    assert db_session.query(QueryMetrics).filter_by(id=res2["query_id"]).one().cache_type == "exact"
    assert mocks["llm"].stream_count == 1  # No LLM call

    # --- Step 3: Trigger Corpus Fingerprint Invalidation by inserting a new document ---
    new_doc = Document(
        id="doc-2",
        original_name="new_supplement.pdf",
        filename="new_supplement.pdf",
        file_type="pdf",
        status="ready",
        chunk_count=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(new_doc)
    db_session.commit()

    # --- Step 4: Query Again & Verify Cache MISS (New Document Invalidation) ---
    res3 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)

    metrics3 = db_session.query(QueryMetrics).filter_by(id=res3["query_id"]).one()
    assert metrics3.cache_type == "none", "Cache should miss after inserting new document"
    assert mocks["llm"].stream_count == 2, "LLM should run again after cache invalidation"

    # --- Step 5: Verify Cache Hit on New Corpus Fingerprint ---
    res4 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)
    assert db_session.query(QueryMetrics).filter_by(id=res4["query_id"]).one().cache_type == "exact"
    assert mocks["llm"].stream_count == 2  # No extra LLM call

    # --- Step 6: Trigger Invalidation by modifying Document.updated_at ---
    doc1 = db_session.query(Document).filter_by(id="doc-1").one()
    doc1.updated_at = datetime.utcnow() + timedelta(seconds=10)
    db_session.commit()

    # --- Step 7: Query Again & Verify Cache MISS (Document Updated Invalidation) ---
    res5 = await retrieval.retrieve_and_generate(question, top_k=2, db_session=db_session, session_id=None)

    metrics5 = db_session.query(QueryMetrics).filter_by(id=res5["query_id"]).one()
    assert metrics5.cache_type == "none", "Cache should miss after updating Document.updated_at"
    assert mocks["llm"].stream_count == 3, "LLM should run again after Document timestamp update"
