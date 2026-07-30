import logging
import json
import asyncio
from typing import List
from app.config import settings
from app.services.llm_service import llm_service
from app.observability import traceable

logger = logging.getLogger(__name__)


class QueryDecomposer:
    """
    Decomposes a complex, multi-document query into simpler sub-queries.
    Allows retrieval of distinct pieces of information from different sources.
    """

    def __init__(self):
        self.client = llm_service.client
        self.model = llm_service.model

    @traceable(name="query_decompose", run_type="chain")
    async def decompose(self, query: str) -> List[str]:
        """
        Analyzes the user's question and breaks it down into up to 3 sub-queries.
        Returns a list of search queries. Falls back to [query] if it fails.
        """
        if not query or not query.strip():
            return []

        try:
            return await self._call_decomposer_llm(query)
        except Exception as e:
            logger.warning("Query decomposition failed, falling back to original query: %s", e)
            return [query]

    async def _call_decomposer_llm(self, query: str) -> List[str]:
        prompt = f"""You are a RAG search query planner.
Your job is to analyze the user's question and determine if it requires combining information from multiple different documents, sources, or sections (e.g. comparing two things, listing multiple steps, or bringing together different facts).

If it does, decompose it into 2 to 3 simpler, distinct search queries that can be used to search a vector database.
If it is a simple query that only needs a single search, return it as the only query.

Output your response strictly as a JSON array of strings, for example:
["query 1", "query 2"]

Do not include any conversational preamble, markdown code blocks (like ```json), or explanation. Output ONLY the JSON array.

User Question: {query}
JSON Output:"""

        messages = [
            {"role": "system", "content": "You are a database query planner that outputs JSON arrays of search queries and nothing else."},
            {"role": "user", "content": prompt}
        ]

        def call_api():
            return self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=128,
                stream=False,
                # Same rationale as the translator: don't let a helper call
                # ride the 30 s client default when a retry succeeds in ~1 s.
                timeout=settings.query_rewrite_timeout_seconds,
            )

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, call_api)
        
        content = response.choices[0].message.content
        if not content:
            return [query]

        content = content.strip()
        # Clean potential markdown wrapping
        if content.startswith("```"):
            content = content.strip("`").strip()
            if content.startswith("json"):
                content = content[4:].strip()

        try:
            queries = json.loads(content)
            if isinstance(queries, list) and all(isinstance(q, str) for q in queries):
                logger.info("Decomposed '%s' into: %s", query, queries)
                return queries
        except Exception as json_err:
            logger.debug("Failed to parse decomposer JSON output '%s': %s", content, json_err)

        return [query]


query_decomposer = QueryDecomposer()
