from openai import OpenAI
from typing import List
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

    def embed_passages(self, texts: List[str]) -> List[List[float]]:
        """Embed document passages (chunks)."""
        if not texts:
            return []

        batch_size = 32
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                response = self.client.embeddings.create(
                    input=batch,
                    model=self.model,
                    encoding_format="float",
                    extra_body={"input_type": "passage", "truncate": "END"},
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                logger.error(f"Embedding error for batch {i}: {e}")
                raise

        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        """Embed a search query."""
        try:
            response = self.client.embeddings.create(
                input=[text],
                model=self.model,
                encoding_format="float",
                extra_body={"input_type": "query", "truncate": "END"},
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Query embedding error: {e}")
            raise

    def embed_single(self, text: str, input_type: str = "passage") -> List[float]:
        """Embed a single text with specified input type."""
        try:
            response = self.client.embeddings.create(
                input=[text],
                model=self.model,
                encoding_format="float",
                extra_body={"input_type": input_type, "truncate": "END"},
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Single embedding error: {e}")
            raise


embedding_service = EmbeddingService()
