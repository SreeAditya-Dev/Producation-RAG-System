from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
import uuid


class DocumentResponse(BaseModel):
    id: str
    original_name: str
    file_type: str
    status: str
    chunk_count: int
    file_size: int
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class SourceChunk(BaseModel):
    doc_id: str
    original_name: str
    chunk_index: int
    text: str
    score: float
    file_type: str


class QueryResponse(BaseModel):
    query_id: str
    question: str
    answer: str
    sources: List[SourceChunk]
    processing_time: float
    created_at: datetime


class QueryHistoryResponse(BaseModel):
    queries: List[QueryResponse]
    total: int


class StatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    total_queries: int
    index_stats: dict


class WSEvent(BaseModel):
    event: str
    query_id: Optional[str] = None
    document_id: Optional[str] = None
    data: Any = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class HealthResponse(BaseModel):
    status: str
    pinecone: str
    nvidia: str
    version: str = "1.0.0"
