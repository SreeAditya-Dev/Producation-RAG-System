import uuid
import logging
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    HnswConfigDiff,
    OptimizersConfigDiff,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchParams,
)

from app.config import settings

logger = logging.getLogger(__name__)

# Stable UUID namespace for deterministic point-ID generation
_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _point_id(vector_id: str) -> str:
    """Convert an arbitrary string ID to a deterministic UUID for Qdrant."""
    return str(uuid.uuid5(_NS, vector_id))


class QdrantService:
    def __init__(self) -> None:
        self._client: Optional[QdrantClient] = None
        self.collection = settings.qdrant_collection_name
        self._ready = False

    # ── Connection ────────────────────────────────────────────────────────────

    def _client_get(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(
                host=settings.qdrant_host,
                port=settings.qdrant_port,
                timeout=30,
            )
        return self._client

    # ── Collection bootstrap ──────────────────────────────────────────────────

    def _ensure_collection(self) -> None:
        if self._ready:
            return
        client = self._client_get()
        names = [c.name for c in client.get_collections().collections]
        if self.collection not in names:
            logger.info(
                "Creating Qdrant collection '%s' with HNSW(m=%d, ef_construct=%d)…",
                self.collection,
                settings.qdrant_hnsw_m,
                settings.qdrant_hnsw_ef_construct,
            )
            client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=settings.embedding_dimension,
                    distance=Distance.COSINE,
                    hnsw_config=HnswConfigDiff(
                        m=settings.qdrant_hnsw_m,
                        ef_construct=settings.qdrant_hnsw_ef_construct,
                        full_scan_threshold=10_000,
                    ),
                ),
                optimizers_config=OptimizersConfigDiff(
                    indexing_threshold=20_000,
                ),
            )
            # Keyword index on doc_id for O(1) filter-based deletion
            client.create_payload_index(
                collection_name=self.collection,
                field_name="doc_id",
                field_schema="keyword",
            )
            logger.info("Collection '%s' created.", self.collection)
        else:
            logger.info("Collection '%s' already exists.", self.collection)
        self._ready = True

    # ── Write ─────────────────────────────────────────────────────────────────

    def upsert_vectors(self, vectors: List[Dict[str, Any]]) -> int:
        """
        Upsert vectors into Qdrant.
        Each item: {"id": str, "values": List[float], "metadata": dict}
        Returns the number of vectors upserted.
        """
        if not vectors:
            return 0
        self._ensure_collection()
        client = self._client_get()
        batch_size = 100
        total = 0

        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            points = [
                PointStruct(
                    id=_point_id(v["id"]),
                    vector=v["values"],
                    payload={**v["metadata"], "_orig_id": v["id"]},
                )
                for v in batch
            ]
            try:
                client.upsert(
                    collection_name=self.collection,
                    points=points,
                    wait=True,
                )
                total += len(batch)
            except Exception as exc:
                logger.error("Qdrant upsert error at batch %d: %s", i, exc)
                raise RuntimeError(f"Failed to store embeddings in Qdrant: {exc}") from exc

        return total

    # ── Read ──────────────────────────────────────────────────────────────────

    def query(
        self,
        vector: List[float],
        top_k: int = 5,
        filter: Optional[Dict[str, Any]] = None,
        ef: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        ANN search with HNSW.
        Returns [{id, score, metadata}, …] sorted by cosine similarity (desc).
        """
        self._ensure_collection()
        client = self._client_get()

        qdrant_filter: Optional[Filter] = None
        if filter:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter.items()
                ]
            )

        try:
            results = client.search(
                collection_name=self.collection,
                query_vector=vector,
                limit=top_k,
                query_filter=qdrant_filter,
                search_params=SearchParams(
                    hnsw_ef=ef or settings.qdrant_hnsw_ef,
                    exact=False,
                ),
                with_payload=True,
            )
            return [
                {
                    "id": r.payload.get("_orig_id", str(r.id)),
                    "score": r.score,
                    "metadata": {k: v for k, v in r.payload.items() if k != "_orig_id"},
                }
                for r in results
            ]
        except Exception as exc:
            logger.error("Qdrant search error: %s", exc)
            raise RuntimeError(f"Failed to query Qdrant: {exc}") from exc

    # ── Delete ────────────────────────────────────────────────────────────────

    def delete_by_document(self, doc_id: str) -> None:
        """Delete all vectors belonging to a document (payload filter on doc_id)."""
        self._ensure_collection()
        client = self._client_get()
        try:
            client.delete(
                collection_name=self.collection,
                points_selector=Filter(
                    must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
                ),
                wait=True,
            )
            logger.info("Deleted vectors for doc_id=%s", doc_id)
        except Exception as exc:
            logger.error("Qdrant delete error: %s", exc)
            raise RuntimeError(f"Failed to delete vectors from Qdrant: {exc}") from exc

    # ── Stats / health ────────────────────────────────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        try:
            client = self._client_get()
            self._ensure_collection()
            info = client.get_collection(self.collection)
            return {
                "total_vector_count": getattr(info, "points_count", 0) or getattr(info, "vectors_count", 0) or 0,
                "indexed_vectors_count": getattr(info, "indexed_vectors_count", 0) or 0,
                "dimension": settings.embedding_dimension,
                "status": str(info.status),
                "hnsw": {
                    "m": settings.qdrant_hnsw_m,
                    "ef_construct": settings.qdrant_hnsw_ef_construct,
                    "ef": settings.qdrant_hnsw_ef,
                },
            }
        except Exception as exc:
            logger.error("Qdrant stats error: %s", exc)
            return {"error": str(exc)}

    def test_connection(self) -> bool:
        try:
            self._client_get().get_collections()
            return True
        except Exception as exc:
            logger.error("Qdrant connection test failed: %s", exc)
            return False


qdrant_service = QdrantService()
