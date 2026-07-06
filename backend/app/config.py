from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
import json
from pathlib import Path


class Settings(BaseSettings):
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    llm_model: str = "meta/llama-3.3-70b-instruct"
    embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    embedding_dimension: int = 1024

    # Pinecone vector DB (serverless)
    pinecone_api_key: str = ""
    pinecone_index_name: str = "rag-system"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    # NVIDIA NIM reranker
    reranker_model: str = "nvidia/llama-3.2-nv-rerankqa-1b-v2"

    # PDF image / chart handling
    # Leave empty to disable vision descriptions (OCR still runs if Tesseract is installed)
    pdf_vision_model: str = ""
    # Fetch this many candidates before reranking, then return top_k
    reranker_candidates_multiplier: int = 4

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
