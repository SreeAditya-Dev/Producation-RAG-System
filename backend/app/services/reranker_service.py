import logging
from typing import List, Dict, Any

import httpx

from app.config import settings
from app.observability import traceable

logger = logging.getLogger(__name__)


class RerankerService:
    """
    Cross-encoder reranker via NVIDIA's hosted reranking API.

    Flow: receive N candidate chunks → send (query, passages) to the API →
    receive logit scores → return top-K re-sorted by relevance.

    Falls back to returning the first top_k candidates unmodified if the
    API key is missing or the call fails, so the pipeline stays functional.

    Note: this is a different product surface than the OpenAI-compatible
    chat/embeddings endpoints under `nvidia_base_url`. NVIDIA's hosted
    catalog serves reranking at ai.api.nvidia.com from a single shared path
    (`/v1/retrieval/nvidia/reranking`) that picks the model from the request
    body; the per-model paths it used to expose are gone (HTTP 410), and the
    generic `/v1/ranking` path only exists on self-hosted NIM containers.
    """

    @traceable(name="cross_encoder_rerank", run_type="retriever")
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

        # The API rejects the whole batch (422) if any passage is empty, so blank
        # chunks are dropped here and `positions` maps each sent passage back to
        # its index in `candidates`.
        passages, positions = [], []
        for i, c in enumerate(candidates):
            text = (c.get(text_key) or "").strip()
            if text:
                passages.append({"text": text})
                positions.append(i)

        if not passages:
            logger.warning("All %d candidates had empty '%s' — skipping reranker", len(candidates), text_key)
            return candidates[:top_k]

        try:
            with httpx.Client(timeout=settings.reranker_timeout_seconds) as client:
                resp = client.post(
                    settings.reranker_url,
                    headers={
                        "Authorization": f"Bearer {settings.nvidia_api_key}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={
                        "model": settings.reranker_model,
                        "query": {"text": query},
                        "passages": passages,
                        "truncate": "END",
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
                if 0 <= idx < len(positions):
                    item = dict(candidates[positions[idx]])
                    item["rerank_score"] = round(logit, 4)
                    reranked.append(item)

            logger.debug("Reranked %d → %d results", len(candidates), len(reranked))
            return reranked

        except Exception as exc:
            logger.warning("Reranker call failed (%s) — falling back to top-%d unranked", exc, top_k)
            return candidates[:top_k]


reranker_service = RerankerService()
