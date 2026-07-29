import copy
import hashlib
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class _Entry:
    created_at: float
    question: str
    scope_key: str
    vector: np.ndarray  # unit-normalized, so cosine == dot product
    value: Dict[str, Any]


class _SemanticIndex:
    """
    Bounded in-memory ANN index over *query embeddings*.

    Similarity is true dense-vector cosine, not term overlap: vectors are stored
    unit-normalized so cosine reduces to a dot product, and the whole index is
    scored in one vectorized numpy matmul rather than a Python loop. A full scan
    at the default capacity (500 x 1024) measures ~1.3 ms — negligible next to
    the ~50-100 ms embedding call that precedes it, which is the real floor on a
    semantic lookup.

    Brute force is deliberate — a real ANN structure (HNSW/IVF) only starts to
    pay off in the 10k+ vector range, and at that point this belongs in Redis or
    the vector DB rather than in process memory.
    """

    def __init__(self, capacity: int):
        self._capacity = capacity
        self._entries: "OrderedDict[str, _Entry]" = OrderedDict()
        self._matrix: Optional[np.ndarray] = None  # rebuilt lazily after writes
        self._order: List[str] = []

    def clear(self) -> None:
        self._entries.clear()
        self._matrix = None
        self._order = []

    def __len__(self) -> int:
        return len(self._entries)

    def add(self, key: str, question: str, scope_key: str, vector: np.ndarray, value: Dict[str, Any]) -> None:
        # Stored as a private deep copy: callers mutate sources downstream
        # (quarantine, PII redaction, context packing), and a shared reference
        # would let those edits silently rewrite the cached entry.
        self._entries[key] = _Entry(time.time(), question, scope_key, vector, copy.deepcopy(value))
        self._entries.move_to_end(key)
        while len(self._entries) > self._capacity:
            self._entries.popitem(last=False)
        self._matrix = None

    def search(
        self, vector: np.ndarray, scope_key: str, threshold: float, ttl_seconds: int
    ) -> Optional[Tuple[float, Dict[str, Any]]]:
        now = time.time()
        expired = [k for k, e in self._entries.items() if now - e.created_at > ttl_seconds]
        for key in expired:
            self._entries.pop(key, None)
        if expired:
            self._matrix = None
        if not self._entries:
            return None

        if self._matrix is None:
            self._order = list(self._entries.keys())
            self._matrix = np.stack([self._entries[k].vector for k in self._order])

        sims = self._matrix @ vector

        best_key: Optional[str] = None
        best_score = threshold  # only accept hits at or above the threshold
        for key, score in zip(self._order, sims):
            entry = self._entries.get(key)
            # Scope must match exactly. A hit under a different corpus
            # fingerprint or document scope is not interchangeable, no matter
            # how similar the two questions read.
            if entry is None or entry.scope_key != scope_key:
                continue
            if score >= best_score:
                best_key, best_score = key, float(score)

        if best_key is None:
            return None
        return best_score, copy.deepcopy(self._entries[best_key].value)


class QueryCache:
    """
    Three-tier cache in front of the retrieve/rerank/generate pipeline.

      Tier 1  exact answer      — sha256 of (corpus fingerprint, question, top_k, scope).
                                  Free, zero false positives, catches literal repeats.
      Tier 2  semantic answer   — dense cosine over cached query embeddings, using the
                                  *same* embedding model as retrieval. Catches paraphrases
                                  ("reset my password" / "forgot my login") that a term-set
                                  overlap score cannot.
      Tier 2b retrieval fragment— caches the retrieved+reranked chunks only, so a near-miss
                                  question skips embed/BM25/rerank but still generates a
                                  fresh answer. Cheaper to be wrong here than in Tier 2,
                                  so it runs at a slightly looser threshold.

    Every tier is bound to a corpus fingerprint (ready-document count + latest update
    timestamp), not just a TTL. When that fingerprint moves, every cached entry is stale
    by construction, so the whole cache is dropped — a document edit can never be served
    a pre-edit answer. TTL is only a secondary safety net.

    Only applied to stateless queries (no session_id): an answer compiled with
    conversation history in scope can't be safely replayed for a different session/turn.
    """

    def __init__(self):
        self._store: "OrderedDict[str, Tuple[float, Dict[str, Any]]]" = OrderedDict()
        self._retrieval_store: "OrderedDict[str, Tuple[float, Dict[str, Any]]]" = OrderedDict()
        self._answer_index = _SemanticIndex(settings.query_cache_capacity)
        self._retrieval_index = _SemanticIndex(settings.query_cache_capacity)
        self._fingerprint: Optional[str] = None
        self._lock = threading.Lock()

    # ── keys / fingerprints ──────────────────────────────────────────────────

    def _corpus_fingerprint(self, db_session) -> str:
        from sqlalchemy import func
        from app.database import Document

        count, latest = (
            db_session.query(func.count(Document.id), func.max(Document.updated_at))
            .filter(Document.status == "ready")
            .first()
        )
        return f"{count}:{latest.isoformat() if latest else 'none'}"

    def _sync_fingerprint(self, fingerprint: str) -> None:
        """Drop everything when the corpus changes. Caller must hold the lock.

        Strict version-aware invalidation: the fingerprint is global, so a single
        ingest/replace/delete invalidates every entry regardless of scope. Purging
        eagerly (rather than letting stale rows linger until TTL) also keeps the
        semantic index from scoring vectors that can never legally be served.
        """
        if self._fingerprint != fingerprint:
            self._store.clear()
            self._retrieval_store.clear()
            self._answer_index.clear()
            self._retrieval_index.clear()
            self._fingerprint = fingerprint

    def _scope_key(self, fingerprint: str, doc_ids: Optional[List[str]]) -> str:
        return f"{fingerprint}|{','.join(sorted(doc_ids)) if doc_ids else ''}"

    def _make_key(self, db_session, question: str, top_k: int, doc_ids: Optional[List[str]]) -> str:
        fingerprint = self._corpus_fingerprint(db_session)
        scope = ",".join(sorted(doc_ids)) if doc_ids else ""
        raw = f"{fingerprint}|{question.strip().lower()}|{top_k}|{scope}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # ── embedding helper ─────────────────────────────────────────────────────

    def embed_question(self, question: str) -> Optional[np.ndarray]:
        """Embed a raw question for semantic lookup, or None if unavailable.

        Uses the same model and the same ``input_type="query"`` space as the
        retrieval pipeline, so no second model is loaded and query-to-query
        comparisons stay in-distribution. Returns None (rather than raising) on
        any provider failure: a cache outage must degrade to a normal pipeline
        run, never block an answer.
        """
        if not (settings.semantic_cache_enabled or settings.retrieval_cache_enabled):
            return None
        try:
            from app.services.embedding_service import embedding_service

            raw, _tokens = embedding_service.embed_query_tracked(question)
            vector = np.asarray(raw, dtype=np.float32)
            norm = float(np.linalg.norm(vector))
            if norm == 0.0:
                return None
            return vector / norm
        except Exception as exc:
            logger.warning("Semantic cache embedding failed, bypassing semantic tiers: %s", exc)
            return None

    # ── Tier 1: exact answer cache ───────────────────────────────────────────

    def get(
        self, db_session, question: str, top_k: int, doc_ids: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        if not settings.query_cache_enabled:
            return None
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            key = self._make_key(db_session, question, top_k, doc_ids)
        except Exception as exc:
            logger.warning("Query cache key computation failed, skipping cache: %s", exc)
            return None

        with self._lock:
            self._sync_fingerprint(fingerprint)
            entry = self._store.get(key)
            if not entry:
                return None
            cached_at, value = entry
            if time.time() - cached_at > settings.query_cache_ttl_seconds:
                self._store.pop(key, None)
                return None
            return copy.deepcopy(value)

    def set(
        self,
        db_session,
        question: str,
        top_k: int,
        value: Dict[str, Any],
        doc_ids: Optional[List[str]] = None,
    ) -> None:
        if not settings.query_cache_enabled:
            return
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            key = self._make_key(db_session, question, top_k, doc_ids)
        except Exception as exc:
            logger.warning("Query cache key computation failed, skipping cache write: %s", exc)
            return
        with self._lock:
            self._sync_fingerprint(fingerprint)
            self._store[key] = (time.time(), copy.deepcopy(value))
            self._store.move_to_end(key)
            while len(self._store) > settings.query_cache_capacity:
                self._store.popitem(last=False)

    # ── Tier 2: semantic answer cache ────────────────────────────────────────

    def semantic_get(
        self,
        db_session,
        question: str,
        top_k: int,
        doc_ids: Optional[List[str]] = None,
        *,
        embedding: Optional[np.ndarray] = None,
    ) -> Optional[Dict[str, Any]]:
        """Return a paraphrase-level cache hit, validated against corpus + scope.

        `embedding` should be the vector already computed for this request so the
        question is embedded once, not once per tier.
        """
        if not settings.semantic_cache_enabled:
            return None
        if embedding is None:
            embedding = self.embed_question(question)
        if embedding is None:
            return None
        try:
            fingerprint = self._corpus_fingerprint(db_session)
        except Exception as exc:
            logger.warning("Semantic cache key computation failed, bypassing cache: %s", exc)
            return None

        scope_key = self._scope_key(fingerprint, doc_ids)
        with self._lock:
            self._sync_fingerprint(fingerprint)
            hit = self._answer_index.search(
                embedding, scope_key, settings.semantic_cache_threshold, settings.query_cache_ttl_seconds
            )
        if hit is None:
            return None
        score, value = hit
        # Second gate: the cached answer's own sources must still sit inside the
        # requested document scope. Similarity alone is not authorization.
        if not self._sources_match_scope(value.get("sources", []), doc_ids):
            return None
        return {**value, "_cache_similarity": round(score, 4)}

    def semantic_set(
        self,
        db_session,
        question: str,
        top_k: int,
        value: Dict[str, Any],
        doc_ids: Optional[List[str]] = None,
        *,
        embedding: Optional[np.ndarray] = None,
    ) -> None:
        if not settings.semantic_cache_enabled:
            return
        if embedding is None:
            embedding = self.embed_question(question)
        if embedding is None:
            return
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            scope_key = self._scope_key(fingerprint, doc_ids)
            key = hashlib.sha256(f"{scope_key}|{question.strip().lower()}|{top_k}".encode()).hexdigest()
            with self._lock:
                self._sync_fingerprint(fingerprint)
                self._answer_index.add(key, question, scope_key, embedding, value)
        except Exception as exc:
            logger.warning("Semantic cache write failed, bypassing cache: %s", exc)

    # ── Tier 2b: retrieval fragment cache ────────────────────────────────────

    def retrieval_get(
        self,
        db_session,
        question: str,
        top_k: int,
        doc_ids: Optional[List[str]] = None,
        *,
        embedding: Optional[np.ndarray] = None,
    ) -> Optional[Dict[str, Any]]:
        """Reuse retrieved+reranked chunks for a repeat/paraphrase question.

        Skips embedding, BM25, and the (expensive) cross-encoder rerank while
        still running generation fresh — so the answer is never a canned replay,
        only the evidence-gathering work is amortized.
        """
        if not settings.retrieval_cache_enabled:
            return None
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            key = self._make_key(db_session, question, top_k, doc_ids)
        except Exception as exc:
            logger.warning("Retrieval cache key computation failed, bypassing cache: %s", exc)
            return None

        scope_key = self._scope_key(fingerprint, doc_ids)
        with self._lock:
            self._sync_fingerprint(fingerprint)
            entry = self._retrieval_store.get(key)
            if entry and time.time() - entry[0] <= settings.query_cache_ttl_seconds:
                value = copy.deepcopy(entry[1])
                if self._sources_match_scope(value.get("sources", []), doc_ids):
                    return {**value, "_cache_similarity": 1.0}
            elif entry:
                self._retrieval_store.pop(key, None)

            if embedding is None:
                return None
            hit = self._retrieval_index.search(
                embedding, scope_key, settings.retrieval_cache_threshold, settings.query_cache_ttl_seconds
            )
        if hit is None:
            return None
        score, value = hit
        if not self._sources_match_scope(value.get("sources", []), doc_ids):
            return None
        return {**value, "_cache_similarity": round(score, 4)}

    def retrieval_set(
        self,
        db_session,
        question: str,
        top_k: int,
        value: Dict[str, Any],
        doc_ids: Optional[List[str]] = None,
        *,
        embedding: Optional[np.ndarray] = None,
    ) -> None:
        if not settings.retrieval_cache_enabled:
            return
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            scope_key = self._scope_key(fingerprint, doc_ids)
            key = self._make_key(db_session, question, top_k, doc_ids)
            with self._lock:
                self._sync_fingerprint(fingerprint)
                self._retrieval_store[key] = (time.time(), copy.deepcopy(value))
                self._retrieval_store.move_to_end(key)
                while len(self._retrieval_store) > settings.query_cache_capacity:
                    self._retrieval_store.popitem(last=False)
                if embedding is not None:
                    self._retrieval_index.add(key, question, scope_key, embedding, value)
        except Exception as exc:
            logger.warning("Retrieval cache write failed, bypassing cache: %s", exc)

    # ── validation helpers ───────────────────────────────────────────────────

    @staticmethod
    def _sources_match_scope(sources: List[Dict[str, Any]], doc_ids: Optional[List[str]]) -> bool:
        allowed = set(doc_ids or [])
        return not allowed or all(source.get("doc_id") in allowed for source in sources if not str(source.get("doc_id", "")).startswith("web:"))

    @staticmethod
    def _cosine(left: np.ndarray, right: np.ndarray) -> float:
        left_norm = float(np.linalg.norm(left))
        right_norm = float(np.linalg.norm(right))
        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0
        return float(np.dot(left, right) / (left_norm * right_norm))


query_cache = QueryCache()
