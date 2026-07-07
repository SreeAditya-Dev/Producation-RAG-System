import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import List

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Document, QueryHistory, QueryMetrics, IngestionMetrics, Chunk, create_tables, get_db
from app.models import (
    DocumentListResponse,
    DocumentResponse,
    HealthResponse,
    ObservabilityResponse,
    LatencyStats,
    IngestionLatencyStats,
    TokenStats,
    RetrievalStats,
    FailureStats,
    QueryRequest,
    QueryResponse,
    SourceChunk,
    StatsResponse,
)
from app.pipeline.ingestion import ingest_document
from app.pipeline.retrieval import retrieve_and_generate
from app.services.pinecone_service import pinecone_service
from app.services.llm_service import llm_service
from app.services.storage_service import storage_service, CONTENT_TYPES
from app.utils.file_parsers import detect_file_type
from app.ws_manager import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG System API",
    description="Production-ready RAG with NVIDIA NIM + Pinecone + full observability",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    create_tables()
    logger.info("RAG System started. Tables ready.")


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await manager.send_personal(websocket, "pong", {})
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    pinecone_ok = await asyncio.get_event_loop().run_in_executor(
        None, pinecone_service.test_connection
    )
    return HealthResponse(
        status="ok",
        pinecone="connected" if pinecone_ok else "error",
        nvidia="configured" if settings.nvidia_api_key else "not configured",
    )


# ── Documents ────────────────────────────────────────────────────────────────

@app.post("/api/documents/upload", response_model=DocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    file_type = detect_file_type(file.filename or "")
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Supported: pdf, txt, docx, md",
        )

    doc_id = str(uuid.uuid4())
    s3_key = f"{doc_id}.{file_type}"
    original_name = file.filename or s3_key

    # Purge any existing document with same name to handle 5-minute live updates idempotently
    existing_doc = db.query(Document).filter(Document.original_name == original_name).first()
    if existing_doc:
        logger.info("Found existing document '%s' (%s). Purging stale data.", original_name, existing_doc.id)
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, pinecone_service.delete_by_document, existing_doc.id
            )
        except Exception as exc:
            logger.warning("Failed to delete stale Pinecone vectors for %s: %s", existing_doc.id, exc)
        await asyncio.get_event_loop().run_in_executor(
            None, storage_service.delete, existing_doc.filename
        )
        db.query(Chunk).filter(Chunk.doc_id == existing_doc.id).delete()
        db.delete(existing_doc)
        db.commit()

    content = await file.read()
    file_size = len(content)

    content_type = CONTENT_TYPES.get(file_type, "application/octet-stream")
    await asyncio.get_event_loop().run_in_executor(
        None, storage_service.upload, content, s3_key, content_type
    )

    doc = Document(
        id=doc_id,
        original_name=original_name,
        filename=s3_key,
        file_type=file_type,
        status="processing",
        chunk_count=0,
        file_size=file_size,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    from app.database import SessionLocal

    def _run_ingestion():
        session = SessionLocal()
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                ingest_document(doc_id, s3_key, original_name, file_type, session)
            )
        finally:
            session.close()

    background_tasks.add_task(_run_ingestion)

    return DocumentResponse(
        id=doc.id,
        original_name=doc.original_name,
        file_type=doc.file_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        file_size=doc.file_size,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@app.get("/api/documents", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=d.id,
                original_name=d.original_name,
                file_type=d.file_type,
                status=d.status,
                chunk_count=d.chunk_count,
                file_size=d.file_size,
                created_at=d.created_at,
                updated_at=d.updated_at,
                error_message=d.error_message,
            )
            for d in docs
        ],
        total=len(docs),
    )


@app.get("/api/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(
        id=doc.id,
        original_name=doc.original_name,
        file_type=doc.file_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        file_size=doc.file_size,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        error_message=doc.error_message,
    )


@app.delete("/api/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, pinecone_service.delete_by_document, doc_id
        )
    except Exception as e:
        logger.warning("Could not delete vectors for %s: %s", doc_id, e)
    await asyncio.get_event_loop().run_in_executor(
        None, storage_service.delete, doc.filename
    )
    db.query(Chunk).filter(Chunk.doc_id == doc_id).delete()
    db.delete(doc)
    db.commit()
    await manager.broadcast("document_deleted", {"doc_id": doc_id})


# ── Query ─────────────────────────────────────────────────────────────────────

@app.post("/api/query", response_model=QueryResponse)
async def query(req: QueryRequest, db: Session = Depends(get_db)):
    from app.database import SessionLocal
    session = SessionLocal()
    try:
        result = await retrieve_and_generate(
            question=req.question,
            top_k=req.top_k,
            db_session=session,
            session_id=req.session_id
        )
    finally:
        session.close()

    return QueryResponse(
        query_id=result["query_id"],
        question=result["question"],
        answer=result["answer"],
        sources=[
            SourceChunk(
                doc_id=s.get("doc_id", ""),
                original_name=s.get("original_name", ""),
                chunk_index=s.get("chunk_index", 0),
                text=s.get("text", ""),
                score=s.get("score", 0.0),
                file_type=s.get("file_type", ""),
                url=s.get("url"),
            )
            for s in result["sources"]
        ],
        processing_time=result["processing_time"],
        created_at=result["created_at"],
    )


@app.get("/api/queries", response_model=dict)
def get_query_history(limit: int = 20, db: Session = Depends(get_db)):
    queries = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for q in queries:
        sources = []
        if q.sources_json:
            try:
                sources = json.loads(q.sources_json)
            except Exception:
                pass
        result.append({
            "query_id": q.id,
            "session_id": q.session_id,
            "question": q.question,
            "answer": q.answer,
            "sources": sources,
            "processing_time": q.processing_time,
            "status": getattr(q, "status", "success"),
            "failure_stage": getattr(q, "failure_stage", None),
            "created_at": q.created_at.isoformat(),
        })
    return {"queries": result, "total": len(result)}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(db: Session = Depends(get_db)):
    total_documents = db.query(Document).filter(Document.status == "ready").count()
    chunk_rows = (
        db.query(Document.chunk_count)
        .filter(Document.status == "ready")
        .all()
    )
    chunk_sum = sum(r[0] or 0 for r in chunk_rows)
    total_queries = db.query(QueryHistory).count()

    failed_queries = db.query(QueryHistory).filter(
        QueryHistory.status == "error"
    ).count() if hasattr(QueryHistory, "status") else 0

    failed_ingestions = db.query(IngestionMetrics).filter(
        IngestionMetrics.status == "error"
    ).count()

    index_stats = await asyncio.get_event_loop().run_in_executor(
        None, pinecone_service.get_stats
    )

    return StatsResponse(
        total_documents=total_documents,
        total_chunks=chunk_sum,
        total_queries=total_queries,
        failed_queries=failed_queries,
        failed_ingestions=failed_ingestions,
        index_stats=index_stats,
    )


# ── Observability ─────────────────────────────────────────────────────────────

@app.get("/api/observability", response_model=ObservabilityResponse)
async def get_observability(db: Session = Depends(get_db)):
    """
    Returns aggregate observability metrics across all queries and ingestions.
    Covers: latency (per-stage), token usage, retrieval quality, faithfulness, failures.
    """

    def _avg(col) -> float | None:
        """Return rounded average or None (never 0.0) when no rows exist."""
        v = db.query(func.avg(col)).filter(col.isnot(None)).scalar()
        return round(float(v), 1) if v is not None else None

    def _avg4(col) -> float | None:
        v = db.query(func.avg(col)).filter(col.isnot(None)).scalar()
        return round(float(v), 4) if v is not None else None

    def _sum(col) -> int:
        v = db.query(func.sum(col)).filter(col.isnot(None)).scalar()
        return int(v) if v is not None else 0

    def _percentile95(values):
        if not values:
            return None
        s = sorted(v for v in values if v is not None)
        if not s:
            return None
        idx = max(0, int(len(s) * 0.95) - 1)
        return round(s[idx], 1)

    # ── Query latency ─────────────────────────────────────────────────────────
    all_total_ms = [
        r[0] for r in db.query(QueryMetrics.total_ms)
        .filter(QueryMetrics.total_ms.isnot(None)).all()
    ]

    latency = LatencyStats(
        avg_total_ms=_avg(QueryMetrics.total_ms),
        p95_total_ms=_percentile95(all_total_ms),
        avg_embed_ms=_avg(QueryMetrics.embed_ms),
        avg_retrieve_ms=_avg(QueryMetrics.retrieve_ms),
        avg_rerank_ms=_avg(QueryMetrics.rerank_ms),
        avg_llm_ms=_avg(QueryMetrics.llm_ms),
    )

    # ── Ingestion latency ─────────────────────────────────────────────────────
    ingestion_latency = IngestionLatencyStats(
        avg_total_ms=_avg(IngestionMetrics.total_ms),
        avg_download_ms=_avg(IngestionMetrics.download_ms),
        avg_parse_ms=_avg(IngestionMetrics.parse_ms),
        avg_chunk_ms=_avg(IngestionMetrics.chunk_ms),
        avg_embed_ms=_avg(IngestionMetrics.embed_ms),
        avg_store_ms=_avg(IngestionMetrics.store_ms),
    )

    # ── Token usage ───────────────────────────────────────────────────────────
    tokens = TokenStats(
        avg_prompt_tokens=_avg(QueryMetrics.prompt_tokens),
        avg_completion_tokens=_avg(QueryMetrics.completion_tokens),
        total_prompt_tokens=_sum(QueryMetrics.prompt_tokens),
        total_completion_tokens=_sum(QueryMetrics.completion_tokens),
        avg_embed_tokens=_avg(QueryMetrics.embed_tokens),
        total_embed_tokens=_sum(QueryMetrics.embed_tokens),
    )

    # ── Retrieval quality ─────────────────────────────────────────────────────
    low_faith = db.query(QueryMetrics).filter(
        QueryMetrics.faithfulness_score.isnot(None),
        QueryMetrics.faithfulness_score < 0.4,
    ).count()

    retrieval = RetrievalStats(
        avg_score_mean=_avg4(QueryMetrics.retrieval_score_mean),
        avg_score_max=_avg4(QueryMetrics.retrieval_score_max),
        avg_rerank_top=_avg4(QueryMetrics.rerank_score_top),
        avg_faithfulness=_avg4(QueryMetrics.faithfulness_score),
        low_faithfulness_count=low_faith,
    )

    # ── Failures ──────────────────────────────────────────────────────────────
    total_queries = db.query(QueryHistory).count()
    failed_queries = db.query(QueryHistory).filter(
        QueryHistory.status == "error"
    ).count() if hasattr(QueryHistory, "status") else 0

    total_ingestions = db.query(IngestionMetrics).count()
    failed_ingestions = db.query(IngestionMetrics).filter(
        IngestionMetrics.status == "error"
    ).count()

    # Failure breakdown by stage
    stage_rows = (
        db.query(QueryMetrics.failure_stage, func.count(QueryMetrics.id))
        .filter(QueryMetrics.status == "error", QueryMetrics.failure_stage.isnot(None))
        .group_by(QueryMetrics.failure_stage)
        .all()
    )
    ing_stage_rows = (
        db.query(IngestionMetrics.failure_stage, func.count(IngestionMetrics.id))
        .filter(IngestionMetrics.status == "error", IngestionMetrics.failure_stage.isnot(None))
        .group_by(IngestionMetrics.failure_stage)
        .all()
    )
    by_stage = {row[0]: row[1] for row in stage_rows}
    for row in ing_stage_rows:
        key = f"ingest:{row[0]}"
        by_stage[key] = row[1]

    # Recent 10 failures (query + ingestion)
    recent_q = (
        db.query(QueryHistory)
        .filter(QueryHistory.status == "error")
        .order_by(QueryHistory.created_at.desc())
        .limit(5)
        .all()
    )
    recent_i = (
        db.query(IngestionMetrics)
        .filter(IngestionMetrics.status == "error")
        .order_by(IngestionMetrics.created_at.desc())
        .limit(5)
        .all()
    )
    recent = [
        {
            "type": "query",
            "id": r.id,
            "question": r.question[:80] if r.question else None,
            "stage": getattr(r, "failure_stage", None),
            "error_type": getattr(r, "error_type", None),
            "at": r.created_at.isoformat(),
        }
        for r in recent_q
    ] + [
        {
            "type": "ingestion",
            "id": r.doc_id,
            "stage": r.failure_stage,
            "error_type": r.error_type,
            "at": r.created_at.isoformat(),
        }
        for r in recent_i
    ]
    recent.sort(key=lambda x: x["at"], reverse=True)

    failures = FailureStats(
        total_queries=total_queries,
        failed_queries=failed_queries,
        query_failure_rate=round(failed_queries / total_queries, 4) if total_queries else 0.0,
        total_ingestions=total_ingestions,
        failed_ingestions=failed_ingestions,
        ingestion_failure_rate=round(failed_ingestions / total_ingestions, 4) if total_ingestions else 0.0,
        by_stage=by_stage,
        recent=recent[:10],
    )

    return ObservabilityResponse(
        latency=latency,
        ingestion_latency=ingestion_latency,
        tokens=tokens,
        retrieval=retrieval,
        failures=failures,
    )
