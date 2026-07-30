"""
Custom unit and integration tests for CRAG (Corrective RAG) out-of-KB scenarios.

Tests cover:
1. CRAG evaluation returning 'incorrect' or 'ambiguous' for missing/irrelevant context.
2. WebSearchService query rewriting and mapping/tagging of web search chunks into sources.
3. Citation & unsupported answer fallback returning 'I don't have enough grounded evidence...'
   when context is irrelevant and web search returns no match.
"""

import asyncio
import json
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, Document, QueryHistory, QueryMetrics
from app.pipeline import retrieval
from app.pipeline.retrieval import _web_results_to_sources
from app.services.citation_validator import insufficient_evidence_answer, validate as validate_citations
from app.services.crag_evaluator import CRAGEvaluator, crag_evaluator
from app.services.web_search_service import WebSearchService, web_search_service


class _NoopManager:
    async def broadcast(self, *args, **kwargs):
        return None


class _Embedding:
    def embed_query_tracked(self, question):
        return [1.0, 0.0], 2


class _PineconeIrrelevant:
    def query(self, **kwargs):
        return [{
            "id": "doc-recipe-chunk-0",
            "score": 0.85,
            "metadata": {
                "doc_id": "doc-recipe",
                "original_name": "baking_guide.txt",
                "file_type": "txt",
                "chunk_index": 0,
                "text": "To bake sourdough bread, mix flour, water, salt, and starter. Ferment overnight."
            },
            "values": None,
        }]


class _Reranker:
    def rerank(self, question, candidates, top_k):
        result = [dict(c) for c in candidates[:top_k]]
        for candidate in result:
            candidate["rerank_score"] = 1.5
        return result


class _Decomposer:
    async def decompose(self, question):
        return [question]


class _Translator:
    async def translate_query(self, question):
        return question


class _WebSearchLLM:
    model = "test-model"

    def stream_messages(self, messages, on_token):
        on_token("Quantum computing utilizes quantum mechanics such as superposition and entanglement [S1].")
        return {"prompt_tokens": 25, "completion_tokens": 12}


class _NoCitationLLM:
    model = "test-model"

    def stream_messages(self, messages, on_token):
        on_token("Quantum teleportation was invented in 1993 by Bennett et al.")
        return {"prompt_tokens": 20, "completion_tokens": 10}


class DummyChoice:
    def __init__(self, content):
        self.message = type("Message", (), {"content": content})()


class DummyResponse:
    def __init__(self, content):
        self.choices = [DummyChoice(content)]


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
    db.add(Document(id="doc-recipe", original_name="baking_guide.txt", filename="baking_guide.txt", file_type="txt", status="ready", chunk_count=1))
    db.commit()
    try:
        yield db
    finally:
        db.close()


# ── Requirement 1: Test CRAG Grading for Out-of-KB / Irrelevant Context ───────

@pytest.mark.asyncio
async def test_crag_evaluator_returns_incorrect_for_empty_sources():
    """Verify CRAGEvaluator grade and evaluate_context return 'incorrect' with score 0.0 on empty sources."""
    evaluator = CRAGEvaluator()
    
    grade_val, conf = await evaluator.evaluate_context("What is Quantum Computing?", [])
    assert grade_val == "incorrect"
    assert conf == 0.0

    grade_val2, conf2 = await evaluator.grade("What is Quantum Computing?", [])
    assert grade_val2 == "incorrect"
    assert conf2 == 0.0


@pytest.mark.asyncio
async def test_crag_evaluator_returns_incorrect_or_ambiguous_for_off_topic_sources(monkeypatch):
    """Verify CRAGEvaluator grades off-topic retrieved context as 'incorrect' or 'ambiguous'."""
    evaluator = CRAGEvaluator()
    off_topic_sources = [{
        "doc_id": "doc-1",
        "text": "Baking sourdough requires flour, water, salt, and active yeast starter."
    }]

    # Case A: Evaluator LLM classifies context as 'incorrect'
    mock_llm_client = MagicMock()
    mock_llm_client.chat.completions.create.return_value = DummyResponse(
        json.dumps({"label": "incorrect", "confidence": 0.95})
    )
    monkeypatch.setattr("app.services.crag_evaluator.llm_service.client", mock_llm_client)

    grade_val, conf = await evaluator.evaluate_context(
        "Explain the architecture of Transformer Neural Networks", off_topic_sources
    )
    assert grade_val == "incorrect"
    assert conf == 0.95

    # Case B: Evaluator LLM classifies context as 'ambiguous'
    mock_llm_client.chat.completions.create.return_value = DummyResponse(
        json.dumps({"label": "ambiguous", "confidence": 0.60})
    )
    grade_val_amb, conf_amb = await evaluator.evaluate_context(
        "Explain the architecture of Transformer Neural Networks", off_topic_sources
    )
    assert grade_val_amb == "ambiguous"
    assert conf_amb == 0.60


# ── Requirement 2: Test Web Search Fallback & Query Rewriting ──────────────────

@pytest.mark.asyncio
async def test_web_search_rewrite_query_generates_clean_query(monkeypatch):
    """Verify WebSearchService.rewrite_query reformulates conversational question into a clean search query."""
    service = WebSearchService()
    mock_llm_client = MagicMock()
    mock_llm_client.chat.completions.create.return_value = DummyResponse(
        "quantum computing applications in cryptography"
    )
    monkeypatch.setattr("app.services.web_search_service.llm_service.client", mock_llm_client)

    verbose_question = "Could you please search the web and tell me all about quantum computing applications in cryptography?"
    rewritten = await service.rewrite_query(verbose_question)

    assert rewritten == "quantum computing applications in cryptography"
    assert len(rewritten) < len(verbose_question)


def test_web_results_mapping_and_tagging():
    """Verify web search fallback chunks are mapped into sources and tagged with file_type='web'."""
    raw_web_results = [
        {
            "title": "Quantum Computing Explained",
            "url": "https://example.org/quantum-101",
            "content": "Quantum computers use qubits to execute complex algorithms.",
            "score": 0.91,
        },
        {
            "title": "Post-Quantum Cryptography",
            "url": "https://example.org/pqc",
            "content": "NIST has standardized several quantum-resistant algorithms.",
            "score": 0.88,
        }
    ]

    sources = _web_results_to_sources(raw_web_results)

    assert len(sources) == 2
    for idx, source in enumerate(sources):
        assert source["file_type"] == "web"
        assert source["doc_id"] == f"web:{raw_web_results[idx]['url']}"
        assert source["original_name"] == raw_web_results[idx]["title"]
        assert source["text"] == raw_web_results[idx]["content"]
        assert source["score"] == raw_web_results[idx]["score"]
        assert source["url"] == raw_web_results[idx]["url"]
        assert source["chunk_index"] == 0


@pytest.mark.asyncio
async def test_crag_pipeline_uses_web_search_sources_when_context_is_out_of_kb(monkeypatch, db_session):
    """Verify end-to-end pipeline replaces/supplements out-of-KB context with web search sources when CRAG grades incorrect."""
    _configure_pipeline_mocks(monkeypatch, _WebSearchLLM())
    monkeypatch.setattr(retrieval.settings, "crag_enabled", True)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)
    monkeypatch.setattr(retrieval.settings, "retrieval_retry_enabled", False)

    # Mock CRAG Evaluator to grade internal bread recipe as 'incorrect'
    monkeypatch.setattr(
        retrieval.crag_evaluator,
        "grade",
        AsyncMockReturn(("incorrect", 0.98))
    )

    # Mock WebSearchService.rewrite_query and search
    monkeypatch.setattr(
        retrieval.web_search_service,
        "rewrite_query",
        AsyncMockReturn("Quantum computing superposition entanglement")
    )
    monkeypatch.setattr(
        retrieval.web_search_service,
        "search",
        lambda query, max_results: [{
            "title": "Quantum Principles",
            "url": "https://example.com/quantum",
            "content": "Quantum computing utilizes quantum mechanics such as superposition and entanglement.",
            "score": 0.95
        }]
    )

    result = await retrieval.retrieve_and_generate(
        "What is quantum computing?", 1, db_session, client_id="test-client"
    )

    assert result["answer"].endswith("[S1].")
    sources = result["sources"]
    assert len(sources) == 1
    assert sources[0]["file_type"] == "web"
    assert sources[0]["doc_id"] == "web:https://example.com/quantum"

    metrics = db_session.query(QueryMetrics).one()
    assert metrics.crag_grade == "incorrect"
    assert metrics.crag_confidence == 0.98
    assert metrics.crag_web_results_used == 1


# ── Requirement 3: Test Citation & Unsupported Answer Fallback ────────────────

def test_insufficient_evidence_answer_formatting():
    """Verify insufficient_evidence_answer produces safe fallback answer with citations list if sources present."""
    empty_fallback = insufficient_evidence_answer([])
    assert empty_fallback == "I don't have enough grounded evidence in the retrieved sources to answer reliably."

    sources = [{"doc_id": "doc-1"}, {"doc_id": "doc-2"}]
    sources_fallback = insufficient_evidence_answer(sources)
    assert sources_fallback.startswith("I don't have enough grounded evidence in the retrieved sources to answer reliably.")
    assert "Available retrieved sources: [S1] [S2]" in sources_fallback


@pytest.mark.asyncio
async def test_pipeline_fallback_to_insufficient_evidence_when_out_of_kb_and_no_web_match(monkeypatch, db_session):
    """
    When retrieved context is out-of-KB (incorrect), web search returns no matches,
    and LLM produces uncited/unsupported claims, verify pipeline returns safe fallback.
    """
    _configure_pipeline_mocks(monkeypatch, _NoCitationLLM())
    monkeypatch.setattr(retrieval.settings, "crag_enabled", True)
    monkeypatch.setattr(retrieval.settings, "query_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "semantic_cache_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_verifier_enabled", False)
    monkeypatch.setattr(retrieval.settings, "retrieval_retry_enabled", False)
    monkeypatch.setattr(retrieval.settings, "citation_validation_enabled", True)

    # CRAG grades internal context as 'incorrect'
    monkeypatch.setattr(
        retrieval.crag_evaluator,
        "grade",
        AsyncMockReturn(("incorrect", 0.99))
    )

    # Web search returns empty results
    monkeypatch.setattr(
        retrieval.web_search_service,
        "rewrite_query",
        AsyncMockReturn("Quantum teleportation invention 1993")
    )
    monkeypatch.setattr(
        retrieval.web_search_service,
        "search",
        lambda query, max_results: []
    )

    result = await retrieval.retrieve_and_generate(
        "Who invented quantum teleportation in 1993?", 1, db_session, client_id="test-client"
    )

    # Output answer must be the safe fallback response
    assert result["answer"].startswith("I don't have enough grounded evidence in the retrieved sources to answer reliably.")
    metrics = db_session.query(QueryMetrics).one()
    assert metrics.crag_grade == "incorrect"
    assert metrics.crag_web_results_used == 0
    # The fallback answer is served, but the recorded verdict is the one for the
    # answer the model actually produced. Re-validating the boilerplate here used
    # to report False as True, which hid every discarded answer from the
    # dashboard.
    assert metrics.citation_valid is False


# ── Helpers for Pipeline Mocking ─────────────────────────────────────────────

def AsyncMockReturn(return_val):
    async def _async_fn(*args, **kwargs):
        return return_val
    return _async_fn


def _configure_pipeline_mocks(monkeypatch, llm):
    monkeypatch.setattr(retrieval, "manager", _NoopManager())
    monkeypatch.setattr(retrieval, "embedding_service", _Embedding())
    monkeypatch.setattr(retrieval, "pinecone_service", _PineconeIrrelevant())
    monkeypatch.setattr(retrieval, "reranker_service", _Reranker())
    monkeypatch.setattr(retrieval, "query_decomposer", _Decomposer())
    monkeypatch.setattr(retrieval, "QueryTranslator", _Translator)
    monkeypatch.setattr(retrieval, "llm_service", llm)
