import logging
from typing import List, Dict, Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class RerankerService:
    """
    Cross-encoder reranker via NVIDIA NIM's /v1/ranking endpoint.

    Flow: receive N candidate chunks → send (query, passages) to the API →
    receive logit scores → return top-K re-sorted by relevance.

    Falls back to returning the first top_k candidates unmodified if the
    API key is missing or the call fails, so the pipeline stays functional.
    """

    @property
    def _url(self) -> str:
        base = settings.nvidia_base_url.rstrip("/")
        return f"{base}/ranking"

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int,
        text_key: str = "text",
    ) -> List[Dict[str, Any]]:
        """
        Re-rank `candidates` against `query`.

        Parameters
        ----------
        query      : the user's question
        candidates : list of source-chunk dicts, each with a `text_key` field
        top_k      : how many to keep after reranking
        text_key   : key that holds the passage text inside each candidate dict

        Returns
        -------
        Up to `top_k` candidates sorted by reranker score (descending).
        Each returned dict gets an extra `rerank_score` key.
        """
        if not candidates:
            return []

        # Graceful degradation when NIM key is absent
        if not settings.nvidia_api_key:
            logger.warning("NVIDIA_API_KEY not set — skipping reranker, returning top-%d as-is", top_k)
            return candidates[:top_k]

        passages = [{"text": c.get(text_key, "")} for c in candidates]

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    self._url,
                    headers={
                        "Authorization": f"Bearer {settings.nvidia_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.reranker_model,
                        "query": {"text": query},
                        "passages": passages,
                    },
                )
                resp.raise_for_status()
                rankings: List[Dict[str, Any]] = resp.json().get("rankings", [])

            # Sort by logit score descending
            scored = sorted(
                [(r["index"], float(r.get("logit", 0.0))) for r in rankings],
                key=lambda x: x[1],
                reverse=True,
            )

            reranked: List[Dict[str, Any]] = []
            for idx, logit in scored[:top_k]:
                if idx < len(candidates):
                    item = dict(candidates[idx])
                    item["rerank_score"] = round(logit, 4)
                    reranked.append(item)

            logger.debug("Reranked %d → %d results", len(candidates), len(reranked))
            return reranked

        except Exception as exc:
            logger.warning("Reranker call failed (%s) — falling back to top-%d unranked", exc, top_k)
            return candidates[:top_k]


reranker_service = RerankerService()
