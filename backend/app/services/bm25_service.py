import logging
import math
import re
import threading
from collections import Counter
from typing import List, Optional, Tuple

from app.observability import traceable

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


class _BM25Index:
    """Okapi BM25 over an in-memory chunk corpus (k1/b are the standard defaults)."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_ids: List[str] = []
        self.doc_freqs: List[Counter] = []
        self.doc_lens: List[int] = []
        self.avg_doc_len = 0.0
        self.df: Counter = Counter()
        self.n_docs = 0

    def build(self, chunks: List[Tuple[str, str]]) -> None:
        """chunks: list of (chunk_id, text)."""
        self.doc_ids = []
        self.doc_freqs = []
        self.doc_lens = []
        self.df = Counter()

        for chunk_id, text in chunks:
            freqs = Counter(_tokenize(text))
            self.doc_ids.append(chunk_id)
            self.doc_freqs.append(freqs)
            self.doc_lens.append(sum(freqs.values()))
            for term in freqs:
                self.df[term] += 1

        self.n_docs = len(self.doc_ids)
        self.avg_doc_len = (sum(self.doc_lens) / self.n_docs) if self.n_docs else 0.0

    def search(self, query: str, top_k: int) -> List[Tuple[str, float]]:
        if not self.n_docs:
            return []
        query_terms = set(_tokenize(query))
        if not query_terms:
            return []

        scores = [0.0] * self.n_docs
        for term in query_terms:
            df = self.df.get(term)
            if not df:
                continue
            idf = math.log(1 + (self.n_docs - df + 0.5) / (df + 0.5))
            for i, freqs in enumerate(self.doc_freqs):
                f = freqs.get(term)
                if not f:
                    continue
                dl = self.doc_lens[i]
                denom = f + self.k1 * (1 - self.b + self.b * dl / (self.avg_doc_len or 1))
                scores[i] += idf * (f * (self.k1 + 1)) / (denom or 1)

        ranked = sorted(
            ((self.doc_ids[i], s) for i, s in enumerate(scores) if s > 0),
            key=lambda x: x[1],
            reverse=True,
        )
        return ranked[:top_k]


class BM25SearchService:
    """
    Lexical (keyword) search companion to the dense Pinecone retriever, used to catch
    exact-match terms — numbers, currency figures, IDs, codes — that dense embeddings
    are known to under-rank. Maintains an in-memory BM25 index over the SQL Chunk
    corpus for all 'ready' documents, and rebuilds it whenever that set changes.
    """

    def __init__(self):
        self._index = _BM25Index()
        self._cache_key = None
        self._lock = threading.Lock()

    def _load_corpus(self, db_session, doc_ids: Optional[List[str]] = None):
        from app.database import Chunk, Document

        q = db_session.query(Document.id, Document.updated_at).filter(Document.status == "ready")
        if doc_ids:
            q = q.filter(Document.id.in_(doc_ids))
        ready_docs = q.all()
        if not ready_docs:
            return None, []

        ready_doc_ids = [d[0] for d in ready_docs]
        # Latest update timestamp across the scoped doc set — included in the cache
        # key so an in-place document edit (same chunk count, new content) still
        # invalidates the index, not just an add/delete that changes the doc count.
        latest_update = max((d[1] for d in ready_docs if d[1] is not None), default=None)

        rows = (
            db_session.query(Chunk.doc_id, Chunk.chunk_index, Chunk.text)
            .filter(Chunk.doc_id.in_(ready_doc_ids))
            .all()
        )
        cache_key = (tuple(sorted(ready_doc_ids)), len(rows), latest_update)
        corpus = [(f"{doc_id}-chunk-{chunk_index}", text) for doc_id, chunk_index, text in rows]
        return cache_key, corpus

    @traceable(name="bm25_lexical_search", run_type="retriever")
    def search(
        self,
        db_session,
        query: str,
        top_k: int,
        doc_ids: Optional[List[str]] = None,
    ) -> List[Tuple[str, float]]:
        """
        `doc_ids`, if given, scopes the lexical search to that document subset —
        builds a small throwaway index over just those chunks rather than the
        full corpus, so a query already scoped to a relevant subset (e.g. by
        access control or a coarse routing step) doesn't pay to index everything.
        """
        try:
            cache_key, corpus = self._load_corpus(db_session, doc_ids=doc_ids)
        except Exception as exc:
            logger.warning("BM25 corpus load failed, skipping lexical search: %s", exc)
            return []
        if not corpus:
            return []

        if doc_ids:
            scoped_index = _BM25Index()
            scoped_index.build(corpus)
            return scoped_index.search(query, top_k)

        with self._lock:
            if cache_key != self._cache_key:
                self._index.build(corpus)
                self._cache_key = cache_key
            return self._index.search(query, top_k)


bm25_service = BM25SearchService()
