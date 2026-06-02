from openai import OpenAI
from typing import List, Tuple
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self.client = OpenAI(
            base_url=settings.nvidia_base_url,
            api_key=settings.nvidia_api_key,
        )
        self.model = settings.embedding_model
        self.dimension = settings.embedding_dimension

    # ── Public API (backward-compatible) ─────────────────────────────────────

    def embed_passages(self, texts: List[str]) -> List[List[float]]:
        embeddings, _ = self.embed_passages_tracked(texts)
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        embedding, _ = self.embed_query_tracked(text)
        return embedding

    def embed_single(self, text: str, input_type: str = "passage") -> List[float]:
        try:
            response = self.client.embeddings.create(
                input=[text],
                model=self.model,
                encoding_format="float",
                extra_body={"input_type": input_type, "truncate": "END"},
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error("Single embedding error: %s", e)
            raise

    # ── Tracked variants (return token count alongside embeddings) ────────────

    def embed_passages_tracked(self, texts: List[str]) -> Tuple[List[List[float]], int]:
        """Returns (embeddings, total_tokens_used)."""
        if not texts:
            return [], 0

        batch_size = 32
        all_embeddings: List[List[float]] = []
        total_tokens = 0

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                response = self.client.embeddings.create(
                    input=batch,
                    model=self.model,
                    encoding_format="float",
                    extra_body={"input_type": "passage", "truncate": "END"},
                )
                all_embeddings.extend(item.embedding for item in response.data)
                if response.usage:
                    total_tokens += response.usage.total_tokens or response.usage.prompt_tokens or 0
            except Exception as e:
                logger.error("Embedding error for batch %d: %s", i, e)
                raise

        return all_embeddings, total_tokens

    def embed_query_tracked(self, text: str) -> Tuple[List[float], int]:
        """Returns (embedding, tokens_used)."""
        try:
            response = self.client.embeddings.create(
                input=[text],
                model=self.model,
                encoding_format="float",
                extra_body={"input_type": "query", "truncate": "END"},
            )
            tokens = 0
            if response.usage:
                tokens = response.usage.total_tokens or response.usage.prompt_tokens or 0
            return response.data[0].embedding, tokens
        except Exception as e:
            logger.error("Query embedding error: %s", e)
            raise


embedding_service = EmbeddingService()
