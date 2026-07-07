import hashlib
import logging
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


query_cache = QueryCache()
