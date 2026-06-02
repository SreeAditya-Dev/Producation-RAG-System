from openai import OpenAI
from typing import Generator, List, Dict, Any
import logging
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a highly accurate AI assistant that answers questions based exclusively on the provided context.

Rules:
- Answer ONLY based on the provided context
- If the context doesn't contain enough information, say so clearly
- Be concise but thorough
- Cite which source document your information comes from when relevant
- Use markdown formatting for better readability
- Never make up information not present in the context"""


class LLMService:
    def __init__(self):
        self.client = OpenAI(
            base_url=settings.nvidia_base_url,
            api_key=settings.nvidia_api_key,
        )
        self.model = settings.llm_model

    def generate(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
        """Generate a non-streaming response."""
        context = self._format_context(context_chunks)
        messages = self._build_messages(question, context)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=settings.temperature,
                top_p=0.7,
                max_tokens=settings.max_tokens,
                stream=False,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            raise

    def generate_stream(
        self, question: str, context_chunks: List[Dict[str, Any]]
    ) -> Generator[str, None, None]:
        """Generate a streaming response, yielding tokens."""
        context = self._format_context(context_chunks)
        messages = self._build_messages(question, context)

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=settings.temperature,
                top_p=0.7,
                max_tokens=settings.max_tokens,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            raise

    def _format_context(self, chunks: List[Dict[str, Any]]) -> str:
        if not chunks:
            return "No relevant context found."

        parts = []
        for i, chunk in enumerate(chunks, 1):
            source = chunk.get("original_name", "Unknown")
            text = chunk.get("text", "")
            parts.append(f"[Source {i}: {source}]\n{text}")

        return "\n\n---\n\n".join(parts)

    def _build_messages(self, question: str, context: str) -> List[Dict[str, str]]:
        return [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ]

    def test_connection(self) -> bool:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'ok' in one word."}],
                max_tokens=5,
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"LLM connection test failed: {e}")
            return False


llm_service = LLMService()
