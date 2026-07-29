"""
Custom Performance & Evaluation Tests for RAG System.

Tests cover:
1. QueryMetrics latency tracking (total_ms, embed_ms, retrieve_ms, rerank_ms, llm_ms).
2. Reranker Relevance Proxy math (_reranker_relevance_proxy sigmoid calculation).
3. Token usage tracking in QueryMetrics & QueryHistory.
4. Daily token budget enforcement (check_daily_budget).
"""

import asyncio
import math
from datetime import datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, Document, QueryHistory, QueryMetrics
from app.pipeline import retrieval
from app.pipeline.retrieval import _reranker_relevance_proxy, _save_query_metrics
from app.services.cost_guard import check_daily_budget


# ── MOCK CLASSES FOR PIPELINE TESTING ──────────────────────────────────────────

class MockNoopManager:
    async def broadcast(self, *args, **kwargs):
        return None


class MockEmbeddingService:
    def embed_query_tracked(self, question):
        # Returns (embedding_vector, token_count)
        return [0.1, 0.2, 0.3], 5


class MockPineconeService:
    def query(self, **kwargs):
        return [{
            "id": "doc-perf-chunk-0",
            "score": 0.88,
            "metadata": {
                "doc_id": "doc-perf",
                "original_name": "perf_doc.txt",
                "file_type": "txt",
                "chunk_index": 0,
                "text": "Performance evaluation grounded evidence chunk."
            },
            "values": None,
        }]


class MockRerankerService:
    def rerank(self, question, candidates, top_k):
        result = [dict(c) for c in candidates[:top_k]]
        for candidate in result:
            candidate["rerank_score"] = 1.5
        return result


class MockDecomposer:
    async def decompose(self, question):
        return [question]


class MockTranslator:
    async def translate_query(self, question):
        return question


class MockLLMService:
    model = "test-perf-model"

    def stream_messages(self, messages, on_token):
        on_token("Grounded answer with citation [S1].")
        return {"prompt_tokens": 42, "completion_tokens": 18}


# ── FIXTURES ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db_session():
    """In-memory SQLite database session fixture."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    db.add(Document(
        id="doc-perf",
        original_name="perf_doc.txt",
        filename="perf_doc.txt",
        file_type="txt",
        status="ready",
        chunk_count=1
    ))
    db.commit()
    try:
        yield db
    finally:
        db.close()


def configure_pipeline_mocks(monkeypatch, llm=None):
    if llm is None:
        llm = MockLLMService()
    monkeypatch.setattr(retrieval, "manager", MockNoopManager())
    monkeypatch.setattr(retrieval, "embedding_service", MockEmbeddingService())
    monkeypatch.setattr(retrieval, "pinecone_service", MockPineconeService())
    monkeypatch.setattr(retrieval, "reranker_service", MockRerankerService())
    monkeypatch.setattr(retrieval, "query_decomposer", MockDecomposer())
    monkeypatch.setattr(retrieval, "QueryTranslator", MockTranslator)
    monkeypatch.setattr(retrieval, "llm_service", llm)
    monkeypatch.setattr(retrieval.settings, "crag_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)


# ── REQUIREMENT 1: LATENCY TRACKING TESTS ─────────────────────────────────────

@pytest.mark.asyncio
async def test_query_metrics_latency_tracking_end_to_end(monkeypatch, db_session):
    """
    Verify end-to-end pipeline records all latency metrics in QueryMetrics:
    total_ms, embed_ms, retrieve_ms, rerank_ms, llm_ms.
    """
    configure_pipeline_mocks(monkeypatch)

    result = await retrieval.retrieve_and_generate(
        "What is the system latency?", 1, db_session, client_id="test-client"
    )
    assert result["answer"].endswith("[S1].")

    metrics = db_session.query(QueryMetrics).one()
    assert metrics.total_ms is not None and metrics.total_ms >= 0.0
    assert metrics.embed_ms is not None and metrics.embed_ms >= 0.0
    assert metrics.retrieve_ms is not None and metrics.retrieve_ms >= 0.0
    assert metrics.rerank_ms is not None and metrics.rerank_ms >= 0.0
    assert metrics.llm_ms is not None and metrics.llm_ms >= 0.0


def test_save_query_metrics_latency_fields(db_session):
    """
    Directly verify _save_query_metrics correctly persists all latency attributes.
    """
    qm_data = {
        "total_ms": 150.5,
        "embed_ms": 20.1,
        "retrieve_ms": 35.4,
        "rerank_ms": 40.2,
        "llm_ms": 54.8,
        "status": "success"
    }
    query_id = "test-latency-query-id"
    _save_query_metrics(db_session, query_id, qm_data)
    db_session.commit()

    record = db_session.query(QueryMetrics).filter_by(id=query_id).one()
    assert record.total_ms == pytest.approx(150.5)
    assert record.embed_ms == pytest.approx(20.1)
    assert record.retrieve_ms == pytest.approx(35.4)
    assert record.rerank_ms == pytest.approx(40.2)
    assert record.llm_ms == pytest.approx(54.8)


# ── REQUIREMENT 2: RERANKER RELEVANCE PROXY MATH TESTS ───────────────────────

def test_reranker_relevance_proxy_sigmoid_calculation():
    """
    Verify _reranker_relevance_proxy math:
    sigmoid(mean_logit) = round(1.0 / (1.0 + exp(-mean_logit)), 4)
    """
    # 1. Zero logit -> sigmoid(0.0) = 0.5
    sources_zero = [{"rerank_score": 0.0}]
    assert _reranker_relevance_proxy(sources_zero) == 0.5

    # 2. Positive logit = 2.0 -> sigmoid(2.0) = 1/(1+e^-2) ~ 0.880797 -> 0.8808
    sources_pos = [{"rerank_score": 2.0}, {"rerank_score": 2.0}]
    expected_pos = round(1.0 / (1.0 + math.exp(-2.0)), 4)
    assert _reranker_relevance_proxy(sources_pos) == expected_pos
    assert expected_pos == 0.8808

    # 3. Negative logit = -2.0 -> sigmoid(-2.0) = 1/(1+e^2) ~ 0.119202 -> 0.1192
    sources_neg = [{"rerank_score": -2.0}]
    expected_neg = round(1.0 / (1.0 + math.exp(2.0)), 4)
    assert _reranker_relevance_proxy(sources_neg) == expected_neg
    assert expected_neg == 0.1192

    # 4. Mixed logits [1.0, 3.0] -> mean = 2.0 -> sigmoid(2.0) = 0.8808
    sources_mixed = [{"rerank_score": 1.0}, {"rerank_score": 3.0}]
    assert _reranker_relevance_proxy(sources_mixed) == 0.8808

    # 5. Empty sources or missing rerank_score -> None
    assert _reranker_relevance_proxy([]) is None
    assert _reranker_relevance_proxy([{"text": "no rerank score"}]) is None


# ── REQUIREMENT 3: TOKEN BUDGET & USAGE TRACKING TESTS ──────────────────────

@pytest.mark.asyncio
async def test_token_usage_tracking_in_metrics_and_history(monkeypatch, db_session):
    """
    Verify prompt_tokens and completion_tokens are recorded in QueryMetrics
    and that corresponding QueryHistory entry is created.
    """
    configure_pipeline_mocks(monkeypatch)

    query_id = "token-test-query-id"
    result = await retrieval.retrieve_and_generate(
        "Token usage test question?", 1, db_session, client_id="client-tokens"
    )
    query_id = result["query_id"]

    metrics = db_session.query(QueryMetrics).filter_by(id=query_id).one()
    assert metrics.prompt_tokens == 42
    assert metrics.completion_tokens == 18

    history = db_session.query(QueryHistory).filter_by(id=query_id).one()
    assert history.id == query_id
    assert history.client_id == "client-tokens"
    assert history.question == "Token usage test question?"
    assert history.status == "success"
    assert history.processing_time >= 0.0


def test_daily_token_budget_enforcement_under_budget(monkeypatch, db_session):
    """
    Verify check_daily_budget returns True when cumulative tokens are under budget.
    """
    monkeypatch.setattr(retrieval.settings, "daily_token_budget", 1000)

    # Insert a record using 300 prompt + 200 completion = 500 tokens
    now = datetime.utcnow()
    m1 = QueryMetrics(
        id="q-budget-1",
        prompt_tokens=300,
        completion_tokens=200,
        created_at=now
    )
    db_session.add(m1)
    db_session.commit()

    assert check_daily_budget(db_session) is True


def test_daily_token_budget_enforcement_exceeded(monkeypatch, db_session):
    """
    Verify check_daily_budget returns False when cumulative tokens meet/exceed budget.
    """
    monkeypatch.setattr(retrieval.settings, "daily_token_budget", 1000)

    now = datetime.utcnow()
    m1 = QueryMetrics(
        id="q-budget-exceeded-1",
        prompt_tokens=600,
        completion_tokens=400,  # Sum = 1000 >= 1000 budget
        created_at=now
    )
    db_session.add(m1)
    db_session.commit()

    assert check_daily_budget(db_session) is False


def test_daily_token_budget_disabled(monkeypatch, db_session):
    """
    Verify check_daily_budget returns True if budget is disabled (<= 0).
    """
    monkeypatch.setattr(retrieval.settings, "daily_token_budget", 0)

    now = datetime.utcnow()
    m1 = QueryMetrics(
        id="q-budget-disabled-1",
        prompt_tokens=5000,
        completion_tokens=5000,
        created_at=now
    )
    db_session.add(m1)
    db_session.commit()

    assert check_daily_budget(db_session) is True


def test_daily_token_budget_ignores_past_days(monkeypatch, db_session):
    """
    Verify check_daily_budget only sums tokens from today (created_at >= today_start).
    """
    monkeypatch.setattr(retrieval.settings, "daily_token_budget", 1000)

    yesterday = datetime.utcnow() - timedelta(days=1)
    m_yesterday = QueryMetrics(
        id="q-yesterday",
        prompt_tokens=2000,
        completion_tokens=2000,
        created_at=yesterday
    )
    db_session.add(m_yesterday)

    today = datetime.utcnow()
    m_today = QueryMetrics(
        id="q-today",
        prompt_tokens=100,
        completion_tokens=100,
        created_at=today
    )
    db_session.add(m_today)
    db_session.commit()

    assert check_daily_budget(db_session) is True
