from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


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
    failed_queries: int
    failed_ingestions: int
    index_stats: dict


class WSEvent(BaseModel):
    event: str
    query_id: Optional[str] = None
    document_id: Optional[str] = None
    data: Any = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class HealthResponse(BaseModel):
    status: str
    qdrant: str
    nvidia: str
    version: str = "1.0.0"


# ── Observability ─────────────────────────────────────────────────────────────

class LatencyStats(BaseModel):
    avg_total_ms: Optional[float] = None
    p95_total_ms: Optional[float] = None
    avg_embed_ms: Optional[float] = None
    avg_retrieve_ms: Optional[float] = None
    avg_rerank_ms: Optional[float] = None
    avg_llm_ms: Optional[float] = None


class TokenStats(BaseModel):
    avg_prompt_tokens: Optional[float] = None
    avg_completion_tokens: Optional[float] = None
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    avg_embed_tokens: Optional[float] = None
    total_embed_tokens: int = 0


class RetrievalStats(BaseModel):
    avg_score_mean: Optional[float] = None
    avg_score_max: Optional[float] = None
    avg_rerank_top: Optional[float] = None
    avg_faithfulness: Optional[float] = None
    low_faithfulness_count: int = 0   # faithfulness < 0.4


class FailureStats(BaseModel):
    total_queries: int = 0
    failed_queries: int = 0
    query_failure_rate: float = 0.0
    total_ingestions: int = 0
    failed_ingestions: int = 0
    ingestion_failure_rate: float = 0.0
    by_stage: Dict[str, int] = {}
    recent: List[Dict[str, Any]] = []


class IngestionLatencyStats(BaseModel):
    avg_total_ms: Optional[float] = None
    avg_download_ms: Optional[float] = None
    avg_parse_ms: Optional[float] = None
    avg_chunk_ms: Optional[float] = None
    avg_embed_ms: Optional[float] = None
    avg_store_ms: Optional[float] = None


class ObservabilityResponse(BaseModel):
    latency: LatencyStats
    ingestion_latency: IngestionLatencyStats
    tokens: TokenStats
    retrieval: RetrievalStats
    failures: FailureStats
