import asyncio
import logging
import os
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.config import settings
from app.utils.file_parsers import parse_file
from app.pipeline.table_splitter import TableAwareSplitter
from app.services.embedding_service import embedding_service
from app.services.pinecone_service import pinecone_service
from app.services.storage_service import storage_service
from app.ws_manager import manager
from app.observability import traceable

logger = logging.getLogger(__name__)


def _ms(t0: float) -> float:
    """Milliseconds elapsed since perf_counter snapshot t0."""
    return round((time.perf_counter() - t0) * 1000, 1)


@traceable(name="document_ingestion", run_type="chain")
async def ingest_document(
    doc_id: str,
    s3_key: str,
    original_name: str,
    file_type: str,
    db_session,
    client_id: Optional[str] = None,
) -> int:
    """
    Full ingestion pipeline: download → parse → chunk → embed → upsert to Pinecone.
    Records per-stage latency, token usage, and failure info in IngestionMetrics.
    Returns the number of chunks created.
    """
    from app.database import Document, IngestionMetrics, Chunk

    pipeline_start = time.perf_counter()

    async def emit(event: str, data: Any = None):
        await manager.broadcast(event=event, data=data, document_id=doc_id, client_id=client_id)

    # Accumulated metrics
    metrics: Dict[str, Any] = {
        "doc_id": doc_id,
        "status": "success",
        "failure_stage": None,
        "error_type": None,
    }

    temp_path: Optional[str] = None
    current_stage = "download"

    try:
        await emit("ingestion_started", {"doc_id": doc_id, "filename": original_name})

        # ── Stage 0: Download ─────────────────────────────────────────────────
        t = time.perf_counter()
        temp_path = await asyncio.get_event_loop().run_in_executor(
            None, storage_service.download_to_temp, s3_key
        )
        metrics["download_ms"] = _ms(t)

        # ── Stage 1: Parse ────────────────────────────────────────────────────
        current_stage = "parse"
        await emit("parsing_started", {"filename": original_name})
        t = time.perf_counter()
        raw_text = await asyncio.get_event_loop().run_in_executor(
            None, parse_file, temp_path, file_type
        )
        metrics["parse_ms"] = _ms(t)

        if not raw_text.strip():
            raise ValueError("Document appears to be empty after parsing.")

        char_count = len(raw_text)
        metrics["char_count"] = char_count
        await emit("parsing_completed", {
            "char_count": char_count,
            "elapsed_ms": metrics["parse_ms"],
        })

        # ── Stage 2: Chunk ────────────────────────────────────────────────────
        current_stage = "chunk"
        await emit("chunking_started", {})
        t = time.perf_counter()
        splitter = TableAwareSplitter(
            chunk_size=settings.max_chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        chunk_metas = await asyncio.get_event_loop().run_in_executor(
            None, splitter.split_document, raw_text
        )
        metrics["chunk_ms"] = _ms(t)

        if not chunk_metas:
            raise ValueError("No chunks produced from document.")

        total_chunks = len(chunk_metas)
        metrics["chunk_count"] = total_chunks
        await emit("chunking_completed", {
            "total_chunks": total_chunks,
            "chunk_size": settings.max_chunk_size,
            "chunk_overlap": settings.chunk_overlap,
            "elapsed_ms": metrics["chunk_ms"],
        })

        # Persist full (untruncated) chunk text for BM25 lexical search — Pinecone's
        # metadata copy of chunk text is capped at 1000 chars and dense-vector only.
        db_session.query(Chunk).filter(Chunk.doc_id == doc_id).delete()
        db_session.bulk_save_objects([
            Chunk(
                doc_id=doc_id,
                original_name=original_name,
                file_type=file_type,
                chunk_index=meta.chunk_index,
                text=meta.text,
                char_start=meta.char_start,
                char_end=meta.char_end,
                boundary_level=meta.boundary_level,
            )
            for meta in chunk_metas
        ])
        db_session.commit()

        # ── Stage 3: Embed ────────────────────────────────────────────────────
        current_stage = "embed"
        await emit("embedding_started", {"total_chunks": total_chunks})
        t = time.perf_counter()

        batch_size = 16
        vectors_to_upsert: List[Dict[str, Any]] = []
        total_embed_tokens = 0

        for i in range(0, total_chunks, batch_size):
            batch_metas = chunk_metas[i : i + batch_size]
            batch_texts = [m.text for m in batch_metas]

            embeddings, batch_tokens = await asyncio.get_event_loop().run_in_executor(
                None, embedding_service.embed_passages_tracked, batch_texts
            )
            total_embed_tokens += batch_tokens

            for meta, embedding in zip(batch_metas, embeddings):
                vector_id = f"{doc_id}-chunk-{meta.chunk_index}"
                vectors_to_upsert.append({
                    "id": vector_id,
                    "values": embedding,
                    "metadata": {
                        "doc_id": doc_id,
                        "original_name": original_name,
                        "file_type": file_type,
                        "chunk_index": meta.chunk_index,
                        "char_start": meta.char_start,
                        "char_end": meta.char_end,
                        "boundary_level": meta.boundary_level,
                        "text": meta.text[:1000],
                        "chunk_size": len(meta.text),
                    },
                })
                await emit("chunk_embedded", {
                    "chunk_index": meta.chunk_index,
                    "total_chunks": total_chunks,
                    "chunk_preview": meta.text[:120] + "..." if len(meta.text) > 120 else meta.text,
                    "boundary_level": meta.boundary_level,
                    "progress": round((meta.chunk_index + 1) / total_chunks * 100, 1),
                })

        metrics["embed_ms"] = _ms(t)
        metrics["embed_tokens"] = total_embed_tokens

        # ── Stage 4: Store ────────────────────────────────────────────────────
        current_stage = "store"
        await emit("storing_started", {"vector_count": len(vectors_to_upsert)})
        t = time.perf_counter()
        upserted = await asyncio.get_event_loop().run_in_executor(
            None, pinecone_service.upsert_vectors, vectors_to_upsert
        )
        metrics["store_ms"] = _ms(t)
        await emit("storing_completed", {
            "upserted": upserted,
            "elapsed_ms": metrics["store_ms"],
        })

        # ── Finalise ──────────────────────────────────────────────────────────
        metrics["total_ms"] = _ms(pipeline_start)

        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "ready"
            doc.chunk_count = total_chunks
            doc.updated_at = datetime.utcnow()

        _save_ingestion_metrics(db_session, metrics)
        db_session.commit()

        await emit("ingestion_completed", {
            "doc_id": doc_id,
            "filename": original_name,
            "chunk_count": total_chunks,
            "status": "ready",
            "metrics": {
                "total_ms": metrics["total_ms"],
                "embed_tokens": total_embed_tokens,
                "stages": {
                    "download_ms": metrics.get("download_ms"),
                    "parse_ms": metrics.get("parse_ms"),
                    "chunk_ms": metrics.get("chunk_ms"),
                    "embed_ms": metrics.get("embed_ms"),
                    "store_ms": metrics.get("store_ms"),
                },
            },
        })

        logger.info("Ingested doc %s: %d chunks, %d embed tokens, %.0f ms total",
                    doc_id, total_chunks, total_embed_tokens, metrics["total_ms"])
        return total_chunks

    except Exception as exc:
        metrics["status"] = "error"
        metrics["failure_stage"] = current_stage
        metrics["error_type"] = type(exc).__name__
        metrics["total_ms"] = _ms(pipeline_start)

        logger.error("Ingestion failed for %s at stage=%s: %s", doc_id, current_stage, exc)

        from app.database import Document
        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = f"[{current_stage}] {exc}"
            doc.updated_at = datetime.utcnow()

        _save_ingestion_metrics(db_session, metrics)
        db_session.commit()

        await emit("ingestion_failed", {
            "doc_id": doc_id,
            "error": str(exc),
            "stage": current_stage,
            "error_type": type(exc).__name__,
        })
        raise

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _save_ingestion_metrics(db_session, m: Dict[str, Any]) -> None:
    from app.database import IngestionMetrics
    try:
        record = IngestionMetrics(
            doc_id=m["doc_id"],
            download_ms=m.get("download_ms"),
            parse_ms=m.get("parse_ms"),
            chunk_ms=m.get("chunk_ms"),
            embed_ms=m.get("embed_ms"),
            store_ms=m.get("store_ms"),
            total_ms=m.get("total_ms"),
            char_count=m.get("char_count"),
            chunk_count=m.get("chunk_count"),
            embed_tokens=m.get("embed_tokens"),
            status=m.get("status", "success"),
            failure_stage=m.get("failure_stage"),
            error_type=m.get("error_type"),
            created_at=datetime.utcnow(),
        )
        db_session.add(record)
    except Exception as e:
        logger.warning("Failed to save IngestionMetrics: %s", e)
