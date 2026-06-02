import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any

from app.config import settings
from app.utils.file_parsers import parse_file
from app.utils.chunking import RecursiveTextSplitter
from app.services.embedding_service import embedding_service
from app.services.pinecone_service import pinecone_service
from app.services.storage_service import storage_service
from app.ws_manager import manager

logger = logging.getLogger(__name__)


async def ingest_document(
    doc_id: str,
    s3_key: str,
    original_name: str,
    file_type: str,
    db_session,
) -> int:
    """
    Full ingestion pipeline: download → parse → chunk → embed → upsert.
    Emits WebSocket events at each stage.
    Returns the number of chunks created.
    """
    from app.database import Document

    async def emit(event: str, data: Any = None):
        await manager.broadcast(event=event, data=data, document_id=doc_id)

    temp_path = None
    try:
        await emit("ingestion_started", {"doc_id": doc_id, "filename": original_name})

        # 0. Download from S3 to temp file
        temp_path = await asyncio.get_event_loop().run_in_executor(
            None, storage_service.download_to_temp, s3_key
        )

        # 1. Parse
        await emit("parsing_started", {"filename": original_name})
        raw_text = await asyncio.get_event_loop().run_in_executor(
            None, parse_file, temp_path, file_type
        )
        if not raw_text.strip():
            raise ValueError("Document appears to be empty after parsing.")
        await emit("parsing_completed", {"char_count": len(raw_text)})

        # 2. Chunk
        await emit("chunking_started", {})
        splitter = RecursiveTextSplitter(
            chunk_size=settings.max_chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        chunks = await asyncio.get_event_loop().run_in_executor(
            None, splitter.split, raw_text
        )
        if not chunks:
            raise ValueError("No chunks produced from document.")

        total_chunks = len(chunks)
        await emit("chunking_completed", {"total_chunks": total_chunks})

        # 3. Embed + Upsert (in batches for real-time feedback)
        await emit("embedding_started", {"total_chunks": total_chunks})

        batch_size = 16
        vectors_to_upsert: List[Dict[str, Any]] = []

        for i in range(0, total_chunks, batch_size):
            batch_texts = chunks[i : i + batch_size]
            batch_indices = list(range(i, min(i + batch_size, total_chunks)))

            embeddings = await asyncio.get_event_loop().run_in_executor(
                None, embedding_service.embed_passages, batch_texts
            )

            for j, (text, embedding, idx) in enumerate(
                zip(batch_texts, embeddings, batch_indices)
            ):
                vector_id = f"{doc_id}-chunk-{idx}"
                vectors_to_upsert.append(
                    {
                        "id": vector_id,
                        "values": embedding,
                        "metadata": {
                            "doc_id": doc_id,
                            "original_name": original_name,
                            "file_type": file_type,
                            "chunk_index": idx,
                            "text": text[:1000],  # Pinecone metadata limit
                            "chunk_size": len(text),
                        },
                    }
                )

                await emit(
                    "chunk_embedded",
                    {
                        "chunk_index": idx,
                        "total_chunks": total_chunks,
                        "chunk_preview": text[:120] + "..." if len(text) > 120 else text,
                        "progress": round((idx + 1) / total_chunks * 100, 1),
                    },
                )

        # 4. Upsert all to Pinecone
        await emit("storing_started", {"vector_count": len(vectors_to_upsert)})
        upserted = await asyncio.get_event_loop().run_in_executor(
            None, pinecone_service.upsert_vectors, vectors_to_upsert
        )
        await emit("storing_completed", {"upserted": upserted})

        # 5. Update DB
        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "ready"
            doc.chunk_count = total_chunks
            doc.updated_at = datetime.utcnow()
            db_session.commit()

        await emit(
            "ingestion_completed",
            {
                "doc_id": doc_id,
                "filename": original_name,
                "chunk_count": total_chunks,
                "status": "ready",
            },
        )

        logger.info(f"Ingested doc {doc_id}: {total_chunks} chunks")
        return total_chunks

    except Exception as e:
        logger.error(f"Ingestion failed for {doc_id}: {e}")

        from app.database import Document
        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(e)
            doc.updated_at = datetime.utcnow()
            db_session.commit()

        await emit(
            "ingestion_failed",
            {"doc_id": doc_id, "error": str(e)},
        )
        raise

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
