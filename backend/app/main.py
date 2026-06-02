import asyncio
import json
import logging
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

import aiofiles
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
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Document, QueryHistory, create_tables, get_db
from app.models import (
    DocumentListResponse,
    DocumentResponse,
    HealthResponse,
    QueryRequest,
    QueryResponse,
    SourceChunk,
    StatsResponse,
)
from app.pipeline.ingestion import ingest_document
from app.pipeline.retrieval import retrieve_and_generate
from app.services.pinecone_service import pinecone_service
from app.services.llm_service import llm_service
from app.utils.file_parsers import detect_file_type
from app.ws_manager import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG System API",
    description="Production-ready Retrieval-Augmented Generation with NVIDIA NIM + Pinecone",
    version="1.0.0",
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
    os.makedirs(settings.upload_dir, exist_ok=True)
    logger.info("RAG System started. DB and upload dir ready.")


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong
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
    pinecone_ok = pinecone_service.test_connection()
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
            detail=f"Unsupported file type. Supported: pdf, txt, docx, md",
        )

    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}.{file_type}"
    file_path = os.path.join(settings.upload_dir, safe_name)

    # Save file
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    file_size = len(content)

    # Create DB record
    doc = Document(
        id=doc_id,
        original_name=file.filename or safe_name,
        filename=safe_name,
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

    # Background ingestion (needs its own DB session)
    from app.database import SessionLocal

    def _run_ingestion():
        session = SessionLocal()
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                ingest_document(doc_id, file_path, file.filename or safe_name, file_type, session)
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

    # Delete from Pinecone
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, pinecone_service.delete_by_document, doc_id
        )
    except Exception as e:
        logger.warning(f"Could not delete vectors for {doc_id}: {e}")

    # Delete file
    file_path = os.path.join(settings.upload_dir, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()

    await manager.broadcast("document_deleted", {"doc_id": doc_id})


# ── Query ─────────────────────────────────────────────────────────────────────

@app.post("/api/query", response_model=QueryResponse)
async def query(req: QueryRequest, db: Session = Depends(get_db)):
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        result = await retrieve_and_generate(req.question, req.top_k, session)
    finally:
        session.close()

    return QueryResponse(
        query_id=result["query_id"],
        question=result["question"],
        answer=result["answer"],
        sources=[SourceChunk(**s) for s in result["sources"]],
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
        result.append(
            {
                "query_id": q.id,
                "question": q.question,
                "answer": q.answer,
                "sources": sources,
                "processing_time": q.processing_time,
                "created_at": q.created_at.isoformat(),
            }
        )
    return {"queries": result, "total": len(result)}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(db: Session = Depends(get_db)):
    total_documents = db.query(Document).filter(Document.status == "ready").count()
    total_chunks = db.query(Document).with_entities(
        Document.chunk_count
    ).filter(Document.status == "ready").all()
    chunk_sum = sum(r[0] or 0 for r in total_chunks)
    total_queries = db.query(QueryHistory).count()

    index_stats = await asyncio.get_event_loop().run_in_executor(
        None, pinecone_service.get_stats
    )

    return StatsResponse(
        total_documents=total_documents,
        total_chunks=chunk_sum,
        total_queries=total_queries,
        index_stats=index_stats,
    )
