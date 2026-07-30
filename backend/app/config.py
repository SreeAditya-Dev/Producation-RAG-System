from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
import json
from pathlib import Path


class Settings(BaseSettings):
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    llm_model: str = "meta/llama-3.1-70b-instruct"
    embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    embedding_dimension: int = 1024

    # Pinecone vector DB (serverless)
    pinecone_api_key: str = ""
    pinecone_index_name: str = "rag-system"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    # NVIDIA NIM reranker.
    # The hosted catalog serves reranking from its own host (not `nvidia_base_url`,
    # which is the OpenAI-compatible chat/embeddings surface). The per-model paths
    # (`/v1/retrieval/nvidia/{model}/reranking`) were retired on 2026-05-18 — the
    # surviving endpoint is the shared one below, which selects via the `model` field.
    reranker_url: str = "https://ai.api.nvidia.com/v1/retrieval/nvidia/reranking"
    reranker_model: str = "nvidia/rerank-qa-mistral-4b"
    # Measured 3.6-16 s for a 40-passage batch on the hosted endpoint (cold starts
    # sit at the top of that range), so a short timeout means silently degrading to
    # unranked retrieval on most calls rather than occasionally.
    reranker_timeout_seconds: float = 20.0

    # PDF image / chart handling
    # Leave empty to disable vision descriptions (OCR still runs if Tesseract is installed)
    pdf_vision_model: str = ""
    # Fetch this many candidates before reranking, then return top_k
    reranker_candidates_multiplier: int = 4

    # Hybrid search: BM25 lexical candidates are merged into the dense-retrieval
    # pool to catch exact-match terms (numbers, IDs, codes) dense embeddings miss.
    # They're given a fixed floor score (just above the 0.25 relevance cutoff) so
    # the cross-encoder reranker — not raw retrieval score — decides real relevance.
    bm25_hybrid_enabled: bool = True
    bm25_floor_score: float = 0.3

    # Security: shared API key gate (X-API-Key header) for all sensitive REST +
    # WebSocket endpoints. Fails closed (503) if unset — misconfiguration should
    # never silently mean "no auth".
    api_key: str = ""

    # Cost guardrails: per-client rate limiting + a hard daily token budget,
    # enforced before invoking the LLM so a runaway client/retry bug can't
    # silently rack up spend.
    rate_limit_per_minute: int = 20
    daily_token_budget: int = 2_000_000

    # Query result cache: avoids re-running the full pipeline for a repeated
    # question. Keyed to a corpus fingerprint (doc count + latest update time)
    # so it's invalidated the moment any document is ingested/deleted/updated —
    # never serves a stale answer past a real corpus change.
    query_cache_enabled: bool = True
    query_cache_ttl_seconds: int = 3600
    query_cache_capacity: int = 500
    # Tier 2 semantic cache: dense cosine over cached query embeddings (same
    # embedding model as retrieval), so paraphrases hit. Threshold is strict on
    # purpose — this replays a canned answer, so a false positive is a wrong
    # answer. 0.90-0.95 is the usable band; below ~0.90 unrelated intents merge.
    semantic_cache_enabled: bool = True
    semantic_cache_threshold: float = 0.92
    # Tier 2b fragment cache: reuses retrieved+reranked chunks only. Generation
    # still runs, so a near-miss costs a slightly-off context rather than a wrong
    # canned answer — hence the looser threshold.
    retrieval_cache_enabled: bool = True
    retrieval_cache_threshold: float = 0.90

    # CRAG (Corrective RAG): an LLM grader classifies the reranked+compressed
    # context as correct / incorrect / ambiguous. "incorrect" discards internal
    # knowledge and falls back to web search; "ambiguous" combines both.
    crag_enabled: bool = True
    crag_web_max_results: int = 3

    # Tavily web search (CRAG's external-knowledge fallback). Gracefully skipped
    # (falls back to internal-only, standard-RAG behavior) if unset.
    tavily_api_key: str = ""

    # LangSmith observability — disabled unless both flag and API key are set.
    # When enabled, every ingestion + query pipeline run is traced end-to-end
    # (embed / retrieve / bm25 / rerank / compress / generate) in LangSmith.
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "rag-system"
    langsmith_endpoint: str = "https://api.smith.langchain.com"

    # Supabase PostgreSQL
    database_url: str = "sqlite:///./rag_system.db"

    # Supabase S3 storage
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "ap-south-1"
    s3_bucket_name: str = "rag-documents"
    local_storage_path: str = str((Path(__file__).resolve().parents[1] / "uploads"))

    max_chunk_size: int = 512
    chunk_overlap: int = 50
    top_k: int = 5
    max_tokens: int = 1024
    temperature: float = 0.2

    # Total prompt budgeting. Reserve generation capacity before packing history
    # and retrieved context so requests cannot exceed the model context window.
    context_window_tokens: int = 8192
    reserved_completion_tokens: int = 1024
    max_history_tokens: int = 1200
    max_context_tokens: int = 3000
    mmr_enabled: bool = False
    mmr_lambda: float = 0.7
    retrieval_retry_enabled: bool = True
    retrieval_retry_max_attempts: int = 1
    retrieval_retry_token_budget: int = 400
    citation_validation_enabled: bool = True
    citation_verifier_enabled: bool = True
    pii_redaction_enabled: bool = False
    evaluator_model: str = ""
    evaluator_timeout_seconds: int = 10
    evaluator_max_retries: int = 0
    # Decompose/translate are tiny (≤128-token) helper calls, but the provider
    # intermittently stalls a request for the full client timeout before the
    # SDK retry succeeds in ~1 s. A tight per-request timeout converts that
    # 30 s stall into a ~10 s worst case per call; the SDK retries after it.
    query_rewrite_timeout_seconds: float = 10.0

    cors_origins: str = '["http://localhost:3000","http://localhost:5173"]'

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
