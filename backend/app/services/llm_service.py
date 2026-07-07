from openai import OpenAI
from typing import Generator, List, Dict, Any, Tuple
import logging
from app.config import settings
from app.observability import traceable, wrap_openai

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
        self.client = wrap_openai(OpenAI(
            base_url=settings.nvidia_base_url,
            api_key=settings.nvidia_api_key,
            timeout=30.0,
        ))
        self.model = settings.llm_model

    # ── Public API (backward-compatible) ─────────────────────────────────────

    def generate(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
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
            logger.error("LLM generation error: %s", e)
            raise

    def generate_stream(
        self, question: str, context_chunks: List[Dict[str, Any]]
    ) -> Generator[str, None, None]:
        tokens, _ = self._stream_with_usage(question, context_chunks)
        yield from tokens

    # ── Tracked variant (returns tokens + usage dict) ─────────────────────────

    def generate_stream_tracked(
        self, question: str, context_chunks: List[Dict[str, Any]]
    ) -> Tuple[List[str], Dict[str, int]]:
        """
        Returns (token_list, {"prompt_tokens": N, "completion_tokens": M}).
        Usage dict may be empty if NVIDIA NIM does not return it.
        """
        return self._stream_with_usage(question, context_chunks)

    def generate_messages_stream_tracked(
        self, messages: List[Dict[str, str]]
    ) -> Tuple[List[str], Dict[str, int]]:
        """
        Executes generation over a pre-compiled list of chat messages (e.g. system, history, user query).
        Returns (token_list, {"prompt_tokens": N, "completion_tokens": M}).
        """
        usage: Dict[str, int] = {}
        tokens: List[str] = []

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=settings.temperature,
                top_p=0.7,
                max_tokens=settings.max_tokens,
                stream=True,
                stream_options={"include_usage": True},
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    tokens.append(chunk.choices[0].delta.content)
                if getattr(chunk, "usage", None):
                    usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens or 0,
                        "completion_tokens": chunk.usage.completion_tokens or 0,
                    }
            return tokens, usage
        except Exception as e:
            logger.error("LLM streaming messages error: %s", e)
            raise

    # ── Internal ──────────────────────────────────────────────────────────────

    def _stream_with_usage(
        self, question: str, context_chunks: List[Dict[str, Any]]
    ) -> Tuple[List[str], Dict[str, int]]:
        context = self._format_context(context_chunks)
        messages = self._build_messages(question, context)
        usage: Dict[str, int] = {}
        tokens: List[str] = []

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=settings.temperature,
                top_p=0.7,
                max_tokens=settings.max_tokens,
                stream=True,
                stream_options={"include_usage": True},
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    tokens.append(chunk.choices[0].delta.content)
                # Final chunk carries usage when stream_options.include_usage=True
                if getattr(chunk, "usage", None):
                    usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens or 0,
                        "completion_tokens": chunk.usage.completion_tokens or 0,
                    }
            return tokens, usage
        except Exception as e:
            logger.error("LLM streaming error: %s", e)
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
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
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
            logger.error("LLM connection test failed: %s", e)
            return False


llm_service = LLMService()
