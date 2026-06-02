from pinecone import Pinecone, ServerlessSpec
from typing import List, Dict, Any, Optional
import logging
import time
from app.config import settings

logger = logging.getLogger(__name__)


class PineconeService:
    def __init__(self):
        self.pc = Pinecone(api_key=settings.pinecone_api_key)
        self.index_name = settings.pinecone_index_name
        self._index = None

    def get_index(self):
        if self._index is None:
            self._ensure_index()
            self._index = self.pc.Index(self.index_name)
        return self._index

    def _ensure_index(self):
        existing = [idx.name for idx in self.pc.list_indexes()]
        if self.index_name not in existing:
            logger.info(f"Creating Pinecone index '{self.index_name}'...")
            self.pc.create_index(
                name=self.index_name,
                dimension=settings.embedding_dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud=settings.pinecone_cloud,
                    region=settings.pinecone_region,
                ),
            )
            # Wait for index to be ready
            for _ in range(30):
                status = self.pc.describe_index(self.index_name).status
                if status.get("ready"):
                    break
                time.sleep(2)
            logger.info(f"Index '{self.index_name}' is ready.")
        else:
            logger.info(f"Index '{self.index_name}' already exists.")

    def upsert_vectors(self, vectors: List[Dict[str, Any]], namespace: str = "") -> int:
        """Upsert vectors in batches of 100. Returns count upserted."""
        index = self.get_index()
        batch_size = 100
        total = 0

        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            try:
                result = index.upsert(vectors=batch, namespace=namespace)
                total += result.upserted_count
            except Exception as e:
                logger.error(f"Pinecone upsert error at batch {i}: {e}")
                raise

        return total

    def query(
        self,
        vector: List[float],
        top_k: int = 5,
        filter: Optional[Dict] = None,
        namespace: str = "",
    ) -> List[Dict[str, Any]]:
        """Query Pinecone and return matches with metadata."""
        index = self.get_index()
        try:
            response = index.query(
                vector=vector,
                top_k=top_k,
                include_metadata=True,
                filter=filter,
                namespace=namespace,
            )
            return [
                {
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata or {},
                }
                for match in response.matches
            ]
        except Exception as e:
            logger.error(f"Pinecone query error: {e}")
            raise

    def delete_by_document(self, doc_id: str, namespace: str = ""):
        """Delete all vectors belonging to a document."""
        index = self.get_index()
        try:
            index.delete(filter={"doc_id": {"$eq": doc_id}}, namespace=namespace)
            logger.info(f"Deleted vectors for doc_id={doc_id}")
        except Exception as e:
            logger.error(f"Pinecone delete error: {e}")
            raise

    def get_stats(self) -> Dict[str, Any]:
        """Return index statistics."""
        try:
            index = self.get_index()
            stats = index.describe_index_stats()
            return {
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension,
                "namespaces": {k: v.vector_count for k, v in (stats.namespaces or {}).items()},
                "index_fullness": stats.index_fullness,
            }
        except Exception as e:
            logger.error(f"Pinecone stats error: {e}")
            return {}

    def test_connection(self) -> bool:
        try:
            self.pc.list_indexes()
            return True
        except Exception as e:
            logger.error(f"Pinecone connection test failed: {e}")
            return False


pinecone_service = PineconeService()
