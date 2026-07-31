import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.auth import require_api_key, verify_ws_key
from app.database import Document, QueryHistory, QueryMetrics, QueryFeedback, IngestionMetrics, Chunk, create_tables, get_db
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
    FeedbackRequest,
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
from app.services.rate_limiter import rate_limiter
from app.services.prompt_guard import PromptPolicyBlockedError
from app.services.cost_guard import check_daily_budget
from app.services.ingestion_queue import ingestion_queue, IngestionTask
from app.services.startup_checks import run_async_startup_checks, health_tracker
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
    # A wildcard origin combined with allow_credentials=True lets any website
    # make credentialed requests to this API from a victim's browser — the
    # browser itself blocks this combination per-spec, but relying on browser
    # enforcement rather than a correct server config is not a real boundary.
    # Explicit configured origins only.
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    create_tables()
    ingestion_queue.start()
    # Non-blocking async background connection check pass (Pinecone, S3, Redis, Database, LLM, Embeddings)
    asyncio.create_task(run_async_startup_checks())
    logger.info("RAG System started. Tables ready. Ingestion queue active. Async service checks initiated in background.")


@app.on_event("shutdown")
async def shutdown():
    await ingestion_queue.stop()
    logger.info("RAG System shut down. Ingestion queue stopped.")


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("client_id")
    key = websocket.query_params.get("key")

    if not verify_ws_key(key) or not client_id:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, client_id)
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
        manager.disconnect(websocket, client_id)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    status_data = health_tracker.get_status()
    services = status_data.get("services", {})
    pinecone_check = services.get("pinecone", {})
    pinecone_status = pinecone_check.get("status", "checking" if status_data.get("is_running") else "unknown")

    return HealthResponse(
        status="ok",
        pinecone="connected" if pinecone_status == "ok" else pinecone_status,
        nvidia="configured" if settings.nvidia_api_key else "not configured",
        version="2.1.0",
        startup_checks_completed=status_data.get("completed", False),
        details=services if status_data.get("completed") else None,
    )


# ── Documents ────────────────────────────────────────────────────────────────

@app.post("/api/documents/upload", response_model=DocumentResponse, status_code=202)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
    x_client_id: Optional[str] = Header(default=None),
):
    identity = x_client_id or (request.client.host if request.client else "unknown")
    if not rate_limiter.allow(identity):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")

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

    # Determine initial status: "processing" if queue is empty, "queued" if others are ahead
    queue_status = ingestion_queue.get_queue_status()
    initial_status = "queued" if queue_status["is_processing"] or queue_status["queue_depth"] > 0 else "processing"

    doc = Document(
        id=doc_id,
        original_name=original_name,
        filename=s3_key,
        file_type=file_type,
        status=initial_status,
        chunk_count=0,
        file_size=file_size,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Enqueue for serial processing instead of fire-and-forget BackgroundTask
    task = IngestionTask(
        doc_id=doc_id,
        s3_key=s3_key,
        original_name=original_name,
        file_type=file_type,
        client_id=x_client_id,
    )
    position = await ingestion_queue.enqueue(task)

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


@app.get("/api/queue")
async def get_queue_status(_api_key: str = Depends(require_api_key)):
    """Returns the current ingestion queue state: depth, current task, pending tasks."""
    return ingestion_queue.get_queue_status()


@app.get("/api/documents", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
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
def get_document(doc_id: str, db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
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
async def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
    x_client_id: Optional[str] = Header(default=None),
):
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
    await manager.broadcast("document_deleted", {"doc_id": doc_id}, client_id=x_client_id)


# ── Query ─────────────────────────────────────────────────────────────────────

@app.post("/api/query", response_model=QueryResponse)
async def query(
    req: QueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
    x_client_id: Optional[str] = Header(default=None),
):
    identity = x_client_id or (request.client.host if request.client else "unknown")
    if not rate_limiter.allow(identity):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")
    if not check_daily_budget(db):
        raise HTTPException(status_code=429, detail="Daily LLM token budget exceeded. Try again tomorrow.")

    from app.database import SessionLocal
    session = SessionLocal()
    try:
        try:
            result = await retrieve_and_generate(
                question=req.question,
                top_k=req.top_k,
                db_session=session,
                session_id=req.session_id,
                # Use the same fallback identity used for rate limiting and
                # feedback authorization when the browser did not send a header.
                client_id=identity,
                doc_ids=req.doc_ids,
            )
        except PromptPolicyBlockedError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
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
def get_query_history(
    request: Request,
    limit: int = 20,
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
    x_client_id: Optional[str] = Header(default=None),
):
    queries = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )

    # The caller's own rating rides along with each row so a reload can restore
    # which answers they already voted on. Without it the UI re-offers the
    # buttons on an answer the user already rated. Scoped to this client's
    # identity — the same one the POST writes under — so one user's vote is
    # never shown to another.
    identity = x_client_id or (request.client.host if request.client else "unknown")
    feedback_by_query = {
        row.query_id: row
        for row in db.query(QueryFeedback).filter(
            QueryFeedback.client_id == identity,
            QueryFeedback.query_id.in_([q.id for q in queries]),
        ).all()
    } if queries else {}

    result = []
    for q in queries:
        sources = []
        if q.sources_json:
            try:
                sources = json.loads(q.sources_json)
            except Exception:
                pass
        feedback = feedback_by_query.get(q.id)
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
            "feedback_rating": feedback.rating if feedback else None,
            "feedback_reason": feedback.reason if feedback else None,
        })
    return {"queries": result, "total": len(result)}


@app.post("/api/queries/{query_id}/feedback", status_code=201)
def submit_query_feedback(
    query_id: str,
    payload: FeedbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
    x_client_id: Optional[str] = Header(default=None),
):
    """Persist one up/down rating per client and query; corrections are review data."""
    identity = x_client_id or (request.client.host if request.client else "unknown")
    if not rate_limiter.allow(identity):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")
    if not db.query(QueryHistory.id).filter(QueryHistory.id == query_id, QueryHistory.client_id == identity).first():
        raise HTTPException(status_code=404, detail="Query not found")

    feedback = db.query(QueryFeedback).filter(
        QueryFeedback.query_id == query_id,
        QueryFeedback.client_id == identity,
    ).first()
    if feedback:
        feedback.rating = payload.rating
        feedback.correction = payload.correction
        feedback.reason = payload.reason
    else:
        feedback = QueryFeedback(
            query_id=query_id,
            client_id=identity,
            rating=payload.rating,
            correction=payload.correction,
            reason=payload.reason,
        )
        db.add(feedback)
    db.commit()
    return {"query_id": query_id, "rating": feedback.rating, "saved": True}


@app.get("/api/feedback/aggregates")
def feedback_aggregates(db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
    """Operational feedback/citation/cache aggregates; feedback never mutates retrieval."""
    total = db.query(QueryFeedback).count()
    up = db.query(QueryFeedback).filter(QueryFeedback.rating == "up").count()
    reasons = dict(db.query(QueryFeedback.reason, func.count(QueryFeedback.id)).filter(QueryFeedback.reason.isnot(None)).group_by(QueryFeedback.reason).all())
    cache_types = dict(db.query(QueryMetrics.cache_type, func.count(QueryMetrics.id)).group_by(QueryMetrics.cache_type).all())
    retry_count = db.query(QueryMetrics).filter(QueryMetrics.retry_attempt_count > 0).count()
    query_count = db.query(QueryMetrics).count()
    citation_failures = db.query(QueryMetrics).filter(QueryMetrics.citation_valid.is_(False)).count()
    token_values = [row[0] for row in db.query(QueryMetrics.prompt_tokens).filter(QueryMetrics.prompt_tokens.isnot(None)).all()]
    def percentile(value: float):
        ordered = sorted(token_values)
        return ordered[max(0, int((len(ordered) - 1) * value))] if ordered else None
    return {
        "feedback_count": total, "positive_feedback_rate": round(up / total, 4) if total else None,
        "negative_feedback_reasons": reasons, "cache_types": cache_types,
        "retry_rate": round(retry_count / query_count, 4) if query_count else 0.0,
        "citation_failures": citation_failures, "prompt_token_percentiles": {"p50": percentile(.50), "p95": percentile(.95)},
    }


@app.get("/api/queries/validation-metrics")
def get_validation_metrics(
    page: int = QueryParam(1, ge=1),
    limit: int = QueryParam(10, ge=1, le=100),
    status: Optional[str] = None,
    crag_grade: Optional[str] = None,
    citation_valid: Optional[bool] = None,
    feedback: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _api_key: str = Depends(require_api_key),
):
    """
    Paginated observability and validation metrics endpoint for RAG query auditing.
    """
    import math

    # Base query joining QueryHistory with QueryMetrics
    query = (
        db.query(QueryHistory, QueryMetrics, QueryFeedback)
        .outerjoin(QueryMetrics, QueryHistory.id == QueryMetrics.id)
        .outerjoin(QueryFeedback, QueryHistory.id == QueryFeedback.query_id)
    )

    if status:
        query = query.filter(QueryHistory.status == status)
    if crag_grade:
        query = query.filter(QueryMetrics.crag_grade == crag_grade)
    if citation_valid is not None:
        query = query.filter(QueryMetrics.citation_valid == citation_valid)
    if feedback:
        query = query.filter(QueryFeedback.rating == feedback)
    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (QueryHistory.question.ilike(search_filter)) | (QueryHistory.answer.ilike(search_filter))
        )

    total_count = query.count()
    pages = math.ceil(total_count / limit) if total_count > 0 else 1
    page = min(page, max(1, pages))

    # Summary KPI aggregation across matching dataset
    all_metrics = db.query(QueryMetrics).all()
    all_history = db.query(QueryHistory).all()
    all_feedback = db.query(QueryFeedback).all()

    avg_total_ms = sum(m.total_ms or 0 for m in all_metrics if m.total_ms) / max(1, len([m for m in all_metrics if m.total_ms]))
    avg_score = sum(m.retrieval_score_max or 0 for m in all_metrics if m.retrieval_score_max) / max(1, len([m for m in all_metrics if m.retrieval_score_max]))

    crag_counts = {
        "correct": sum(1 for m in all_metrics if m.crag_grade == "correct"),
        "ambiguous": sum(1 for m in all_metrics if m.crag_grade == "ambiguous"),
        "incorrect": sum(1 for m in all_metrics if m.crag_grade == "incorrect"),
    }
    valid_citations = sum(1 for m in all_metrics if m.citation_valid is True)
    total_citation_records = sum(1 for m in all_metrics if m.citation_valid is not None)
    citation_valid_pct = (valid_citations / total_citation_records * 100) if total_citation_records > 0 else 100.0

    pos_feedback = sum(1 for f in all_feedback if f.rating == "up")
    neg_feedback = sum(1 for f in all_feedback if f.rating == "down")

    # Fetch paginated slice
    results = (
        query.order_by(QueryHistory.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = []
    for h, m, f in results:
        sources = []
        if h.sources_json:
            try:
                sources = json.loads(h.sources_json)
            except Exception:
                pass

        items.append({
            "query_id": h.id,
            "session_id": h.session_id,
            "question": h.question,
            "answer": h.answer,
            "sources": sources,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "status": h.status,
            "failure_stage": h.failure_stage,
            "error_type": h.error_type,
            "processing_time": h.processing_time,
            # Telemetry Metrics
            "total_ms": m.total_ms if m else None,
            "embed_ms": m.embed_ms if m else None,
            "retrieve_ms": m.retrieve_ms if m else None,
            "rerank_ms": m.rerank_ms if m else None,
            "llm_ms": m.llm_ms if m else None,
            "prompt_tokens": m.prompt_tokens if m else None,
            "completion_tokens": m.completion_tokens if m else None,
            "candidate_count": m.candidate_count if m else None,
            "returned_count": m.returned_count if m else None,
            "retrieval_score_max": m.retrieval_score_max if m else None,
            "retrieval_score_mean": m.retrieval_score_mean if m else None,
            "crag_grade": m.crag_grade if m else None,
            "crag_confidence": m.crag_confidence if m else None,
            "crag_web_results_used": m.crag_web_results_used if m else None,
            "citation_valid": m.citation_valid if m else None,
            "citation_cited_source_count": m.citation_cited_source_count if m else None,
            "citation_invalid_citations": m.citation_invalid_citations if m else None,
            "cache_type": m.cache_type if m else None,
            "retry_attempt_count": m.retry_attempt_count if m else 0,
            "retry_reason": m.retry_reason if m else None,
            # Feedback
            "feedback_rating": f.rating if f else None,
            "feedback_reason": f.reason if f else None,
            "feedback_correction": f.correction if f else None,
        })

    return {
        "summary": {
            "total_queries": len(all_history),
            "avg_total_ms": round(avg_total_ms, 2),
            "avg_retrieval_score": round(avg_score, 4),
            "crag_grades": crag_counts,
            "citation_valid_pct": round(citation_valid_pct, 1),
            "positive_feedback": pos_feedback,
            "negative_feedback": neg_feedback,
        },
        "items": items,
        "page": page,
        "limit": limit,
        "total": total_count,
        "pages": pages,
    }




@app.get("/api/feedback/review-candidates")
def feedback_review_candidates(limit: int = 100, db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
    """Export candidate benchmark cases for human review only.

    This route has no write path to benchmark fixtures, indexes, or models;
    approved cases must be reviewed and committed to the versioned fixture.
    """
    rows = (
        db.query(QueryFeedback, QueryHistory)
        .join(QueryHistory, QueryHistory.id == QueryFeedback.query_id)
        .filter((QueryFeedback.rating == "down") | QueryFeedback.correction.isnot(None))
        .order_by(QueryFeedback.created_at.desc()).limit(min(max(limit, 1), 500)).all()
    )
    return {"requires_human_approval": True, "candidates": [{
        "query_id": feedback.query_id, "question": history.question, "answer": history.answer,
        "rating": feedback.rating, "correction": feedback.correction, "reason": feedback.reason,
    } for feedback, history in rows]}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
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
async def get_observability(db: Session = Depends(get_db), _api_key: str = Depends(require_api_key)):
    """
    Returns aggregate observability metrics across all queries and ingestions.
    Covers latency, token usage, retrieval relevance proxy, and failures.
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
    low_proxy = db.query(QueryMetrics).filter(
        QueryMetrics.reranker_relevance_proxy.isnot(None),
        QueryMetrics.reranker_relevance_proxy < 0.4,
    ).count()

    retrieval = RetrievalStats(
        avg_score_mean=_avg4(QueryMetrics.retrieval_score_mean),
        avg_score_max=_avg4(QueryMetrics.retrieval_score_max),
        avg_rerank_top=_avg4(QueryMetrics.rerank_score_top),
        avg_reranker_relevance_proxy=_avg4(QueryMetrics.reranker_relevance_proxy),
        low_reranker_relevance_proxy_count=low_proxy,
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
