"""Deterministic mocked end-to-end checks for the async production pipeline."""

import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base, Chunk, Document, QueryHistory, QueryMetrics
from app.pipeline import retrieval


class _NoopManager:
    async def broadcast(self, *args, **kwargs):
        return None


class _Embedding:
    def embed_query_tracked(self, question):
        return [1.0, 0.0], 2


class _Pinecone:
    def query(self, **kwargs):
        return [{
            "id": "doc-1-chunk-0", "score": 0.91,
            "metadata": {"doc_id": "doc-1", "original_name": "guide.md", "file_type": "md", "chunk_index": 0, "text": "The answer is grounded evidence."},
            "values": None,
        }]


class _Reranker:
    def rerank(self, question, candidates, top_k):
        result = [dict(candidate) for candidate in candidates[:top_k]]
        for candidate in result:
            candidate["rerank_score"] = 2.0
        return result


class _Decomposer:
    async def decompose(self, question):
        return [question]


class _Translator:
    async def translate_query(self, question):
        return question


class _LLM:
    model = "test-model"

    def stream_messages(self, messages, on_token):
        on_token("The answer is grounded evidence [S1].")
        return {"prompt_tokens": 20, "completion_tokens": 8}


class _NoCitationLLM(_LLM):
    def stream_messages(self, messages, on_token):
        on_token("Unsupported factual answer")
        return {"prompt_tokens": 20, "completion_tokens": 4}


class _FailingLLM(_LLM):
    def stream_messages(self, messages, on_token):
        raise RuntimeError("provider stream failed")


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
    db.add(Document(id="doc-1", original_name="guide.md", filename="guide.md", file_type="md", status="ready", chunk_count=1))
    db.commit()
    try:
        yield db
    finally:
        db.close()


@pytest.mark.asyncio
async def test_standard_pipeline_streams_persists_and_validates_citations(monkeypatch, db_session):
    _configure(monkeypatch, _LLM())
    monkeypatch.setattr(retrieval.settings, "crag_enabled", False)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)

    result = await retrieval.retrieve_and_generate("What is the answer?", 1, db_session, client_id="client-a")

    assert result["answer"].endswith("[S1].")
    assert db_session.query(QueryHistory).one().status == "success"
    metrics = db_session.query(QueryMetrics).one()
    assert metrics.stream_completed is True
    assert metrics.citation_valid is True
    assert metrics.prompt_tokens == 20


def _configure(monkeypatch, llm):
    monkeypatch.setattr(retrieval, "manager", _NoopManager())
    monkeypatch.setattr(retrieval, "embedding_service", _Embedding())
    monkeypatch.setattr(retrieval, "pinecone_service", _Pinecone())
    monkeypatch.setattr(retrieval, "reranker_service", _Reranker())
    monkeypatch.setattr(retrieval, "query_decomposer", _Decomposer())
    monkeypatch.setattr(retrieval, "QueryTranslator", _Translator)
    monkeypatch.setattr(retrieval, "llm_service", llm)
    monkeypatch.setattr(retrieval.settings, "crag_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)


@pytest.mark.asyncio
async def test_exact_cache_hit_is_persisted_with_client_identity(monkeypatch, db_session):
    _configure(monkeypatch, _FailingLLM())
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", True)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    retrieval.query_cache._store.clear()
    retrieval.query_cache.set(db_session, "cached question", 1, {"answer": "cached [S1]", "sources": [{"doc_id": "doc-1", "text": "evidence"}]})

    result = await retrieval.retrieve_and_generate("cached question", 1, db_session, client_id="client-a")

    assert result["answer"] == "cached [S1]"
    history = db_session.query(QueryHistory).one()
    assert history.client_id == "client-a"
    assert db_session.query(QueryMetrics).one().cache_type == "exact"


@pytest.mark.asyncio
async def test_citation_failure_uses_at_most_one_retry_and_safe_answer(monkeypatch, db_session):
    _configure(monkeypatch, _NoCitationLLM())
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "retrieval_retry_enabled", True)

    result = await retrieval.retrieve_and_generate("What is the answer?", 1, db_session, client_id="client-a")

    assert result["answer"].startswith("I don't have enough grounded evidence")
    metrics = db_session.query(QueryMetrics).one()
    assert metrics.retry_attempt_count == 1
    # The uncited answer failed validation and was replaced; the persisted
    # verdict describes that answer, not the boilerplate that replaced it.
    assert metrics.citation_valid is False


@pytest.mark.asyncio
async def test_stream_failure_persists_error_and_does_not_save_success(monkeypatch, db_session):
    _configure(monkeypatch, _FailingLLM())
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)

    with pytest.raises(RuntimeError, match="provider stream failed"):
        await retrieval.retrieve_and_generate("What is the answer?", 1, db_session, client_id="client-a")

    assert db_session.query(QueryHistory).one().status == "error"
    assert db_session.query(QueryMetrics).one().status == "error"
