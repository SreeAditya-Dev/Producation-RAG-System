from datetime import datetime

import numpy as np

from app.services.query_cache import QueryCache, _SemanticIndex


def _unit(*values) -> np.ndarray:
    vector = np.asarray(values, dtype=np.float32)
    return vector / np.linalg.norm(vector)


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeSession:
    """Minimal stand-in for the corpus-fingerprint query only."""

    def __init__(self, count=1, latest=None):
        self.count = count
        self.latest = latest

    def query(self, *args, **kwargs):
        return _FakeQuery((self.count, self.latest))


# ── scope validation ─────────────────────────────────────────────────────────

def test_scope_validation_rejects_sources_outside_requested_documents():
    assert not QueryCache._sources_match_scope([{"doc_id": "other"}], ["allowed"])
    assert QueryCache._sources_match_scope([{"doc_id": "allowed"}], ["allowed"])


def test_scope_validation_ignores_web_sources():
    assert QueryCache._sources_match_scope([{"doc_id": "web:https://x.com"}], ["allowed"])


# ── dense semantic index ─────────────────────────────────────────────────────

def test_paraphrase_above_threshold_hits_and_unrelated_vector_misses():
    index = _SemanticIndex(capacity=10)
    index.add("k1", "how do I reset my password", "fp|", _unit(1, 0, 0), {"answer": "reset flow"})

    near = _unit(0.99, 0.14, 0)  # cosine ~0.99 against the stored vector
    hit = index.search(near, "fp|", threshold=0.92, ttl_seconds=3600)
    assert hit is not None
    score, value = hit
    assert score >= 0.92
    assert value["answer"] == "reset flow"

    unrelated = _unit(0, 1, 0)  # orthogonal — cosine 0
    assert index.search(unrelated, "fp|", threshold=0.92, ttl_seconds=3600) is None


def test_similar_but_sub_threshold_vector_is_a_miss():
    index = _SemanticIndex(capacity=10)
    index.add("k1", "install on windows", "fp|", _unit(1, 0, 0), {"answer": "windows"})
    # cosine ~0.89 — related topic, but below the 0.92 answer-replay bar
    borderline = _unit(0.89, 0.456, 0)
    assert index.search(borderline, "fp|", threshold=0.92, ttl_seconds=3600) is None


def test_identical_vector_under_a_different_scope_never_matches():
    index = _SemanticIndex(capacity=10)
    vector = _unit(1, 0, 0)
    index.add("k1", "q", "fp|docA", vector, {"answer": "scoped"})
    assert index.search(vector, "fp|docB", threshold=0.9, ttl_seconds=3600) is None
    assert index.search(vector, "fp|docA", threshold=0.9, ttl_seconds=3600) is not None


def test_expired_entries_are_purged_and_not_served():
    index = _SemanticIndex(capacity=10)
    vector = _unit(1, 0, 0)
    index.add("k1", "q", "fp|", vector, {"answer": "old"})
    # Back-date rather than sleeping: asserting on a 0-second TTL would race the
    # clock resolution and flake.
    index._entries["k1"].created_at -= 600

    assert index.search(vector, "fp|", threshold=0.9, ttl_seconds=300) is None
    assert len(index) == 0


def test_capacity_evicts_oldest_entry_first():
    index = _SemanticIndex(capacity=2)
    index.add("k1", "q1", "fp|", _unit(1, 0, 0), {"answer": "first"})
    index.add("k2", "q2", "fp|", _unit(0, 1, 0), {"answer": "second"})
    index.add("k3", "q3", "fp|", _unit(0, 0, 1), {"answer": "third"})

    assert len(index) == 2
    assert index.search(_unit(1, 0, 0), "fp|", threshold=0.9, ttl_seconds=3600) is None
    assert index.search(_unit(0, 0, 1), "fp|", threshold=0.9, ttl_seconds=3600) is not None


def test_returned_value_is_isolated_from_the_cached_entry():
    """Downstream stages mutate sources (quarantine, PII redaction, packing)."""
    index = _SemanticIndex(capacity=10)
    vector = _unit(1, 0, 0)
    index.add("k1", "q", "fp|", vector, {"sources": [{"doc_id": "a", "text": "original"}]})

    _, first = index.search(vector, "fp|", threshold=0.9, ttl_seconds=3600)
    first["sources"][0]["text"] = "MUTATED"
    first["sources"].append({"doc_id": "injected"})

    _, second = index.search(vector, "fp|", threshold=0.9, ttl_seconds=3600)
    assert second["sources"] == [{"doc_id": "a", "text": "original"}]


def test_stored_value_is_isolated_from_the_callers_object():
    index = _SemanticIndex(capacity=10)
    vector = _unit(1, 0, 0)
    payload = {"sources": [{"doc_id": "a", "text": "original"}]}
    index.add("k1", "q", "fp|", vector, payload)

    payload["sources"][0]["text"] = "MUTATED_AFTER_WRITE"

    _, cached = index.search(vector, "fp|", threshold=0.9, ttl_seconds=3600)
    assert cached["sources"][0]["text"] == "original"


# ── corpus-fingerprint invalidation ──────────────────────────────────────────

def test_corpus_change_drops_every_tier():
    cache = QueryCache()
    session = _FakeSession(count=2, latest=datetime(2026, 1, 1))
    vector = _unit(1, 0, 0)
    value = {"answer": "a", "sources": [{"doc_id": "d1"}]}

    cache.set(session, "q", 5, value)
    cache.semantic_set(session, "q", 5, value, embedding=vector)
    cache.retrieval_set(session, "q", 5, {"sources": [{"doc_id": "d1"}]}, embedding=vector)

    assert cache.get(session, "q", 5) is not None
    assert cache.semantic_get(session, "q", 5, embedding=vector) is not None
    assert cache.retrieval_get(session, "q", 5, embedding=vector) is not None

    # A document edit moves the fingerprint — every tier must go stale at once.
    edited = _FakeSession(count=2, latest=datetime(2026, 6, 1))
    assert cache.get(edited, "q", 5) is None
    assert cache.semantic_get(edited, "q", 5, embedding=vector) is None
    assert cache.retrieval_get(edited, "q", 5, embedding=vector) is None
    assert len(cache._answer_index) == 0
    assert len(cache._retrieval_index) == 0
    assert cache._store == {}


def test_semantic_hit_is_rejected_when_cached_sources_leave_the_requested_scope():
    cache = QueryCache()
    session = _FakeSession(count=1, latest=None)
    vector = _unit(1, 0, 0)
    cache.semantic_set(
        session, "q", 5, {"answer": "a", "sources": [{"doc_id": "d1"}]}, doc_ids=["d1"], embedding=vector
    )
    # Same corpus, same vector, but the caller now scopes to a different document.
    assert cache.semantic_get(session, "q", 5, doc_ids=["d2"], embedding=vector) is None


# ── request-scoped metrics must not leak through the fragment cache ──────────

def test_fragment_metrics_drop_request_scoped_fields():
    """`retrieve_only` writes into the caller's live `qm`, so persisting it whole
    would replay a prior request's status/guard/cache state into the next one."""
    from app.pipeline.retrieval import _retrieval_fragment_metrics

    live_qm = {
        "status": "error",
        "failure_stage": "llm",
        "cache_type": "semantic",
        "prompt_injection_question_flagged": True,
        "retry_attempt_count": 1,
        "citation_valid": False,
        "candidate_count": 12,
        "reranker_relevance_proxy": 0.81,
    }
    persisted = _retrieval_fragment_metrics(live_qm)

    assert persisted == {"candidate_count": 12, "reranker_relevance_proxy": 0.81}
    for leaky in ("status", "failure_stage", "cache_type", "citation_valid",
                  "prompt_injection_question_flagged", "retry_attempt_count"):
        assert leaky not in persisted


# ── mutation isolation on the exact and fragment tiers ───────────────────────

def test_exact_tier_isolates_caller_mutation_on_write_and_read():
    cache = QueryCache()
    session = _FakeSession(count=1, latest=None)
    payload = {"answer": "a", "sources": [{"doc_id": "d1", "text": "original"}]}

    cache.set(session, "q", 5, payload)
    payload["sources"][0]["text"] = "MUTATED_AFTER_WRITE"
    served = cache.get(session, "q", 5)
    assert served["sources"][0]["text"] == "original"

    served["sources"][0]["text"] = "MUTATED_AFTER_READ"
    assert cache.get(session, "q", 5)["sources"][0]["text"] == "original"


def test_fragment_tier_survives_downstream_source_mutation():
    """Cached chunks are fed back into the pipeline, where quarantine, PII
    redaction, and `context_chunks[:] = packed_chunks` all mutate in place."""
    cache = QueryCache()
    session = _FakeSession(count=1, latest=None)
    cache.retrieval_set(
        session, "q", 5,
        {"sources": [{"doc_id": "d1", "text": "original"}], "metrics": {"candidate_count": 3}},
    )

    served = cache.retrieval_get(session, "q", 5)
    served["sources"][0]["text"] = "[REDACTED]"   # PII / quarantine rewrite
    served["sources"][:] = []                     # in-place truncation by the packer

    again = cache.retrieval_get(session, "q", 5)
    assert again["sources"] == [{"doc_id": "d1", "text": "original"}]
    assert again["metrics"] == {"candidate_count": 3}


def test_semantic_hit_reports_its_similarity():
    cache = QueryCache()
    session = _FakeSession(count=1, latest=None)
    cache.semantic_set(session, "q", 5, {"answer": "a", "sources": []}, embedding=_unit(1, 0, 0))
    hit = cache.semantic_get(session, "q", 5, embedding=_unit(0.99, 0.14, 0))
    assert hit is not None
    assert 0.92 <= hit["_cache_similarity"] <= 1.0
