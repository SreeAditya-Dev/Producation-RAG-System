import asyncio
import json
import logging
from typing import Any, Dict, List, Tuple

from app.services.llm_service import llm_service
from app.config import settings
from app.observability import traceable

logger = logging.getLogger(__name__)

VALID_LABELS = ("correct", "incorrect", "ambiguous")


class CRAGEvaluator:
    """
    Corrective-RAG (CRAG, Yan et al. 2024) retrieval evaluator. After the standard
    retrieve -> rerank -> compress pipeline produces its context, this grades that
    context against the question as CORRECT / INCORRECT / AMBIGUOUS, driving
    conditional branching in retrieval.py:

      - CORRECT   -> use the refined internal knowledge as-is (standard path).
      - INCORRECT -> discard internal knowledge, fall back to web search alone.
      - AMBIGUOUS -> combine refined internal knowledge with web search results.

    Fails open to "correct" on any error so a grader outage never blocks answers —
    it can only make retrieval *more* corrective, never a hard dependency.
    """

    @traceable(name="crag_evaluate", run_type="chain")
    async def grade(self, question: str, sources: List[Dict[str, Any]]) -> Tuple[str, float]:
        if not sources:
            return "incorrect", 0.0
        try:
            return await self._call_evaluator_llm(question, sources)
        except Exception as e:
            logger.warning("CRAG evaluation failed, failing open to 'correct': %s", e)
            return "correct", 0.5

    async def evaluate_context(self, question: str, sources: List[Dict[str, Any]]) -> Tuple[str, float]:
        """Evaluate retrieved context against question (alias for grade)."""
        return await self.grade(question, sources)

    async def _call_evaluator_llm(self, question: str, sources: List[Dict[str, Any]]) -> Tuple[str, float]:
        context_block = "\n\n".join(
            f"[{i + 1}] {s.get('text', '')[:400]}" for i, s in enumerate(sources[:5])
        )

        prompt = f"""You are a strict retrieval quality grader for a RAG system.
Given a user question and the retrieved context passages, decide whether the context is sufficient to answer the question accurately and completely.

Respond with a JSON object ONLY, no markdown, no explanation, in exactly this shape:
{{"label": "correct" | "incorrect" | "ambiguous", "confidence": <float between 0 and 1>}}

Grading rules:
- "correct": the context directly and fully answers the question.
- "incorrect": the context is irrelevant, off-topic, or does not contain the answer at all.
- "ambiguous": the context is partially relevant, touches the topic, or only partially answers the question.

Question: {question}

Retrieved Context:
{context_block}

JSON Output:"""

        messages = [
            {"role": "system", "content": "You are a retrieval quality grader that outputs strict JSON and nothing else."},
            {"role": "user", "content": prompt},
        ]

        def call_api():
            client = llm_service.client
            # The evaluator is independently configurable and deliberately
            # bounded. Provider outages are handled by grade()'s fail-open path.
            model = settings.evaluator_model or llm_service.model
            return client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.0,
                max_tokens=64,
                stream=False,
            )

        loop = asyncio.get_event_loop()
        response = None
        last_error = None
        for attempt in range(max(1, settings.evaluator_max_retries + 1)):
            try:
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, call_api),
                    timeout=settings.evaluator_timeout_seconds,
                )
                break
            except Exception as exc:
                last_error = exc
                if attempt + 1 < max(1, settings.evaluator_max_retries + 1):
                    logger.warning("CRAG evaluator attempt %d failed: %r", attempt + 1, exc)
        if response is None:
            # repr, not str: asyncio.TimeoutError stringifies to "" and would
            # otherwise log an unactionable blank reason.
            raise RuntimeError(f"CRAG evaluator unavailable: {last_error!r}") from last_error
        content = (response.choices[0].message.content or "").strip()

        if content.startswith("```"):
            content = content.strip("`").strip()
            if content.startswith("json"):
                content = content[4:].strip()

        try:
            parsed = json.loads(content)
            label = parsed.get("label", "correct")
            confidence = float(parsed.get("confidence", 0.5))
            if label not in VALID_LABELS:
                label = "correct"
            confidence = max(0.0, min(1.0, confidence))
            logger.info("CRAG grade for '%s': %s (confidence=%.2f)", question, label, confidence)
            return label, confidence
        except Exception:
            logger.debug("Failed to parse CRAG evaluator output: %s", content)
            return "correct", 0.5


crag_evaluator = CRAGEvaluator()
