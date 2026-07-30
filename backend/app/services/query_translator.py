import logging
from app.config import settings
from app.services.llm_service import llm_service
from app.observability import traceable

logger = logging.getLogger(__name__)


class QueryTranslator:
    """
    Service to translate/rewrite code-mixed queries (e.g. Hindi-English / Hinglish)
    into standard formal English queries to improve embedding match quality.
    """

    def __init__(self):
        self.client = llm_service.client
        self.model = llm_service.model

    @traceable(name="query_translate", run_type="chain")
    async def translate_query(self, raw_query: str) -> str:
        """
        Translates Hinglish or code-mixed user questions into standard English.
        If it's already standard English, returns it unchanged.
        """
        if not raw_query or not raw_query.strip():
            return raw_query

        # Skip translation if not configured or if we fail to connect
        try:
            return await self._call_translation_llm(raw_query)
        except Exception as e:
            logger.warning("Query translation failed, falling back to raw query: %s", e)
            return raw_query

    async def _call_translation_llm(self, query: str) -> str:
        import asyncio

        prompt = f"""You are a professional query translator for search engines.
Translate the following user question into a formal English search query.
If the question is written in a Hindi-English (Hinglish) code-mixed style, slang, or informal language, translate it fully to English.
If it is already in standard English, output it exactly as is.

Do not include explanations, prefixes, quotes, or conversational preamble.
Output ONLY the clean, translated English query.

User Question: {query}
English Query:"""

        messages = [
            {"role": "system", "content": "You are a translator that outputs translations and nothing else."},
            {"role": "user", "content": prompt}
        ]

        def call_api():
            return self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=64,
                stream=False,
                # Per-request override of the client's 30 s default; the SDK
                # retries a timed-out call, and retries after a stall
                # consistently succeed fast.
                timeout=settings.query_rewrite_timeout_seconds,
            )

        # Run blocking OpenAI call in a separate thread
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, call_api)
        
        translated = response.choices[0].message.content
        if not translated:
            return query
            
        translated = translated.strip().strip('"').strip("'")
        logger.info("Query rewrite: '%s' -> '%s'", query, translated)
        return translated
