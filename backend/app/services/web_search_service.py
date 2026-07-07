import asyncio
import logging
from typing import Any, Dict, List

import httpx

from app.config import settings
from app.services.llm_service import llm_service
from app.observability import traceable

logger = logging.getLogger(__name__)


class WebSearchService:
    """
    External web search — CRAG's corrective fallback when internal retrieval is
    graded "incorrect" or "ambiguous" by CRAGEvaluator. Uses Tavily's search API,
    the standard choice in CRAG/agentic-RAG reference implementations.

    Gracefully degrades (returns []) if TAVILY_API_KEY isn't configured, so the
    pipeline keeps running on internal-only (standard RAG) results rather than
    failing the query.
    """

    @traceable(name="web_query_rewrite", run_type="chain")
    async def rewrite_query(self, question: str) -> str:
        """
        Reformulates a natural-language RAG question into a concise, keyword-dense
        web search query (CRAG's "query rewriting for web search" step) — chat
        questions are often too conversational/long for a search engine to match well.
        """
        prompt = f"""Rewrite the following question into a short, keyword-focused web search query.
Remove filler words and conversational phrasing. Output ONLY the rewritten query, nothing else.

Question: {question}
Search Query:"""

        messages = [
            {"role": "system", "content": "You rewrite questions into concise web search queries and output nothing else."},
            {"role": "user", "content": prompt},
        ]

        def call_api():
            return llm_service.client.chat.completions.create(
                model=llm_service.model,
                messages=messages,
                temperature=0.0,
                max_tokens=48,
                stream=False,
            )

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, call_api)
            rewritten = (response.choices[0].message.content or "").strip().strip('"').strip("'")
            return rewritten or question
        except Exception as e:
            logger.warning("Web query rewrite failed, using original question: %s", e)
            return question

    @traceable(name="web_search_fallback", run_type="retriever")
    def search(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        if not settings.tavily_api_key:
            logger.warning("TAVILY_API_KEY not set — skipping CRAG web search fallback")
            return []
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "max_results": max_results,
                        "search_depth": "basic",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", ""),
                    "score": float(r.get("score", 0.0) or 0.0),
                }
                for r in data.get("results", [])
            ]
        except Exception as e:
            logger.warning("Tavily web search failed: %s", e)
            return []


web_search_service = WebSearchService()
