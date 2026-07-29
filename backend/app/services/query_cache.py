import hashlib
import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)


class QueryCache:
    """
    In-memory cache of full query responses (answer + sources), used to avoid
    re-running the entire retrieve/rerank/generate pipeline for a repeated
    question.

    Keyed to a corpus fingerprint (ready-document count + latest update
    timestamp) rather than a bare TTL, so it is invalidated the instant any
    document is ingested, replaced, or deleted — it can never serve an answer
    that's gone stale relative to the actual document set. TTL is only a
    secondary safety net on top of that.

    Only applied to stateless queries (no session_id): an answer compiled with
    conversation history in scope can't be safely replayed for a different
    session/turn.
    """

    def __init__(self):
        self._store: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._semantic_store: Dict[str, Tuple[float, str, str, Dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def _corpus_fingerprint(self, db_session) -> str:
        from sqlalchemy import func
        from app.database import Document

        count, latest = (
            db_session.query(func.count(Document.id), func.max(Document.updated_at))
            .filter(Document.status == "ready")
            .first()
        )
        return f"{count}:{latest.isoformat() if latest else 'none'}"

    def _make_key(self, db_session, question: str, top_k: int, doc_ids: Optional[List[str]]) -> str:
        fingerprint = self._corpus_fingerprint(db_session)
        scope = ",".join(sorted(doc_ids)) if doc_ids else ""
        raw = f"{fingerprint}|{question.strip().lower()}|{top_k}|{scope}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(
        self, db_session, question: str, top_k: int, doc_ids: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        if not settings.query_cache_enabled:
            return None
        try:
            key = self._make_key(db_session, question, top_k, doc_ids)
        except Exception as exc:
            logger.warning("Query cache key computation failed, skipping cache: %s", exc)
            return None

        with self._lock:
            entry = self._store.get(key)
        if not entry:
            return None

        cached_at, value = entry
        if time.time() - cached_at > settings.query_cache_ttl_seconds:
            with self._lock:
                self._store.pop(key, None)
            return None
        return value

    def semantic_get(
        self, db_session, question: str, top_k: int, doc_ids: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """Return a bounded, corpus-and-scope validated approximate cache hit.

        The local backend uses normalized term-set cosine as a no-network fallback;
        deployments can replace this class with Redis/vector storage without
        changing request-path semantics. It is feature-flagged off by default.
        """
        if not settings.semantic_cache_enabled:
            return None
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            scope = ",".join(sorted(doc_ids)) if doc_ids else ""
        except Exception as exc:
            logger.warning("Semantic cache key computation failed, bypassing cache: %s", exc)
            return None
        now = time.time()
        best: Optional[Dict[str, Any]] = None
        best_score = settings.semantic_cache_threshold
        with self._lock:
            entries = list(self._semantic_store.items())
        for key, (created, cached_question, cached_scope, value) in entries:
            if now - created > settings.query_cache_ttl_seconds:
                with self._lock:
                    self._semantic_store.pop(key, None)
                continue
            if cached_scope != f"{fingerprint}|{scope}" or not self._sources_match_scope(value.get("sources", []), doc_ids):
                continue
            score = self._similarity(question, cached_question)
            if score >= best_score:
                best, best_score = value, score
        if best:
            return {**best, "_cache_similarity": round(best_score, 4)}
        return None

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
            key = self._make_key(db_session, question, top_k, doc_ids)
        except Exception as exc:
            logger.warning("Query cache key computation failed, skipping cache write: %s", exc)
            return
        with self._lock:
            self._store[key] = (time.time(), value)
            # Keep the cache bounded; insertion-order eviction is sufficient for
            # this in-process backend and failure-safe if storage is unavailable.
            while len(self._store) > settings.query_cache_capacity:
                self._store.pop(next(iter(self._store)))

    def semantic_set(
        self, db_session, question: str, top_k: int, value: Dict[str, Any], doc_ids: Optional[List[str]] = None
    ) -> None:
        if not settings.semantic_cache_enabled:
            return
        try:
            fingerprint = self._corpus_fingerprint(db_session)
            scope = ",".join(sorted(doc_ids)) if doc_ids else ""
            key = hashlib.sha256(f"{fingerprint}|{scope}|{question.strip().lower()}|{top_k}".encode()).hexdigest()
            with self._lock:
                self._semantic_store[key] = (time.time(), question, f"{fingerprint}|{scope}", value)
                while len(self._semantic_store) > settings.query_cache_capacity:
                    self._semantic_store.pop(next(iter(self._semantic_store)))
        except Exception as exc:
            logger.warning("Semantic cache write failed, bypassing cache: %s", exc)

    @staticmethod
    def _sources_match_scope(sources: List[Dict[str, Any]], doc_ids: Optional[List[str]]) -> bool:
        allowed = set(doc_ids or [])
        return not allowed or all(source.get("doc_id") in allowed for source in sources if not str(source.get("doc_id", "")).startswith("web:"))

    @staticmethod
    def _similarity(left: str, right: str) -> float:
        left_terms = set(re.findall(r"\w+", left.lower()))
        right_terms = set(re.findall(r"\w+", right.lower()))
        if not left_terms or not right_terms:
            return 0.0
        return len(left_terms & right_terms) / ((len(left_terms) * len(right_terms)) ** 0.5)


query_cache = QueryCache()
