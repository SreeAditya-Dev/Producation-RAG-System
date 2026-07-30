"""A discarded answer must be recorded as a citation failure, not a success.

The insufficient-evidence boilerplate always validates — it opens with "I don't
have enough" (so it carries no material claims) and lists every source — so
re-validating it overwrote the real verdict. Every discarded answer was persisted
as `citation_valid=True`, which made this whole class of failure invisible.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, QueryHistory, QueryMetrics
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
            "metadata": {
                "doc_id": "doc-1", "original_name": "guide.md", "file_type": "md",
                "chunk_index": 0, "text": "Paris is the capital of France.",
            },
            "values": None,
        }]


class _Reranker:
    def rerank(self, question, candidates, top_k):
        result = [dict(c) for c in candidates[:top_k]]
        for c in result:
            c["rerank_score"] = 2.0
        return result


class _Decomposer:
    async def decompose(self, question):
        return [question]


class _Translator:
    async def translate_query(self, question):
        return question


class _UncitedLLM:
    """Answers correctly but never cites — the shape that got discarded."""

    model = "test-model"

    def stream_messages(self, messages, on_token):
        on_token("The capital city of France is Paris.")
        return {"prompt_tokens": 20, "completion_tokens": 6, "stream_completed": 1}

    def generate_messages(self, messages, max_tokens=256):
        return "The capital city of France is Paris."  # repair fails too


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()


def _configure(monkeypatch):
    monkeypatch.setattr(retrieval, "manager", _NoopManager())
    monkeypatch.setattr(retrieval, "embedding_service", _Embedding())
    monkeypatch.setattr(retrieval, "pinecone_service", _Pinecone())
    monkeypatch.setattr(retrieval, "reranker_service", _Reranker())
    monkeypatch.setattr(retrieval, "query_decomposer", _Decomposer())
    monkeypatch.setattr(retrieval, "QueryTranslator", _Translator)
    monkeypatch.setattr(retrieval, "llm_service", _UncitedLLM())
    monkeypatch.setattr(retrieval.settings, "crag_enabled", False)
    monkeypatch.setattr(retrieval.settings, "retrieval_retry_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", True)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", True)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "retrieval_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "bm25_hybrid_enabled", False)


@pytest.mark.asyncio
async def test_discarded_answer_is_recorded_as_a_citation_failure(monkeypatch, db_session):
    _configure(monkeypatch)
    retrieval.query_cache._store.clear()

    result = await retrieval.retrieve_and_generate(
        "What is the capital of France?", 1, db_session, client_id="client-a"
    )

    assert result["answer"].startswith("I don't have enough grounded evidence")
    metrics = db_session.query(QueryMetrics).one()
    assert metrics.citation_valid is False, "the real verdict must survive the fallback"
    assert metrics.citation_verifier_used is True
    assert metrics.citation_repaired is False
    assert db_session.query(QueryHistory).one().status == "success"


@pytest.mark.asyncio
async def test_boilerplate_is_never_written_to_the_answer_cache(monkeypatch, db_session):
    _configure(monkeypatch)
    retrieval.query_cache._store.clear()
    question = "What is the capital of France?"

    await retrieval.retrieve_and_generate(question, 1, db_session, client_id="client-a")

    # Caching it would replay "I don't have enough grounded evidence" to every
    # later asker of the same question.
    assert retrieval.query_cache.get(db_session, question, 1, None) is None
