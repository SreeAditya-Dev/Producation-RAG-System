import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, Any

from app.config import settings

logger = logging.getLogger("startup_checks")


class StartupHealthTracker:
    def __init__(self):
        self.is_running: bool = False
        self.completed: bool = False
        self.started_at: str = ""
        self.completed_at: str = ""
        self.results: Dict[str, Any] = {}

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "completed": self.completed,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "services": self.results,
        }


health_tracker = StartupHealthTracker()


def _check_db() -> Dict[str, Any]:
    try:
        from app.database import engine, text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result == 1:
                return {
                    "status": "ok",
                    "connected": True,
                    "message": "Database connected successfully (SELECT 1).",
                }
            return {
                "status": "error",
                "connected": False,
                "message": "Database query returned unexpected result.",
            }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": f"Database connection failed: {str(e)}",
        }


def _check_pinecone() -> Dict[str, Any]:
    try:
        from app.services.pinecone_service import pinecone_service
        if not pinecone_service.is_configured():
            return {
                "status": "skipped",
                "connected": False,
                "message": "Pinecone API key not configured in environment.",
            }
        ok = pinecone_service.test_connection()
        if ok:
            stats = pinecone_service.get_stats()
            vector_count = stats.get("total_vector_count", 0)
            return {
                "status": "ok",
                "connected": True,
                "index": settings.pinecone_index_name,
                "total_vector_count": vector_count,
                "message": f"Pinecone connected successfully (index='{settings.pinecone_index_name}', vectors={vector_count}).",
            }
        return {
            "status": "error",
            "connected": False,
            "message": "Pinecone connection probe failed.",
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": f"Pinecone connection error: {str(e)}",
        }


def _check_s3_storage() -> Dict[str, Any]:
    try:
        from app.services.storage_service import storage_service
        if not storage_service.is_configured():
            return {
                "status": "ok",
                "connected": True,
                "mode": "local",
                "message": f"Supabase S3 not configured. Using local fallback storage at '{settings.local_storage_path}'.",
            }
        client = storage_service._get_client()
        bucket = settings.s3_bucket_name
        client.head_bucket(Bucket=bucket)
        return {
            "status": "ok",
            "connected": True,
            "mode": "s3",
            "bucket": bucket,
            "message": f"Supabase S3 connected successfully (bucket='{bucket}').",
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": f"Supabase S3 storage probe failed: {str(e)}",
        }


def _check_embeddings() -> Dict[str, Any]:
    try:
        from app.services.embedding_service import embedding_service
        if not settings.nvidia_api_key:
            return {
                "status": "skipped",
                "connected": False,
                "message": "NVIDIA API key not set.",
            }
        emb, tokens = embedding_service.embed_query_tracked("Startup service connection check probe")
        if emb and len(emb) == settings.embedding_dimension:
            return {
                "status": "ok",
                "connected": True,
                "dimension": len(emb),
                "message": f"NVIDIA Embeddings service operational (dimension={len(emb)}).",
            }
        return {
            "status": "error",
            "connected": False,
            "message": "NVIDIA Embeddings returned unexpected vector format.",
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": f"NVIDIA Embeddings check failed: {str(e)}",
        }


def _check_llm() -> Dict[str, Any]:
    try:
        from app.services.llm_service import llm_service
        if not settings.nvidia_api_key:
            return {
                "status": "skipped",
                "connected": False,
                "message": "NVIDIA API key not set.",
            }
        ok = llm_service.test_connection()
        if ok:
            return {
                "status": "ok",
                "connected": True,
                "model": settings.llm_model,
                "message": f"NVIDIA LLM service connected (model='{settings.llm_model}').",
            }
        return {
            "status": "error",
            "connected": False,
            "message": "NVIDIA LLM connection test returned False.",
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": f"NVIDIA LLM check failed: {str(e)}",
        }


async def run_async_startup_checks():
    """Runs connection tests for all non-DB (Pinecone, S3, LLM, Embeddings)
    and DB services asynchronously in background worker threads upon startup.
    Does NOT block the main FastAPI thread or server startup flow."""
    logger.info("======================================================================")
    logger.info("⚡ STARTING ASYNC BACKGROUND SERVICE CONNECTION & HEALTH CHECKS...")
    logger.info("   (Probing Database, Pinecone, S3 Storage, Embeddings, LLM)")
    logger.info("======================================================================")

    health_tracker.is_running = True
    health_tracker.completed = False
    health_tracker.started_at = datetime.now(timezone.utc).isoformat()
    start_time = time.time()

    loop = asyncio.get_running_loop()

    # Execute all non-blocking probes concurrently in thread pool
    check_tasks = {
        "database": loop.run_in_executor(None, _check_db),
        "pinecone": loop.run_in_executor(None, _check_pinecone),
        "s3_storage": loop.run_in_executor(None, _check_s3_storage),
        "embeddings": loop.run_in_executor(None, _check_embeddings),
        "llm": loop.run_in_executor(None, _check_llm),
    }

    results = {}
    for name, task in check_tasks.items():
        try:
            res = await task
            results[name] = res
            status_flag = res.get("status", "error")
            if status_flag == "ok":
                logger.info("  [OK] %-12s : %s", name.upper(), res.get("message"))
            elif status_flag == "skipped":
                logger.info("  [SKIP] %-10s : %s", name.upper(), res.get("message"))
            else:
                logger.warning("  [WARN] %-10s : %s", name.upper(), res.get("message"))
        except Exception as exc:
            results[name] = {"status": "error", "connected": False, "message": str(exc)}
            logger.error("  [ERR] %-12s : Exception during check: %s", name.upper(), exc)

    duration = round(time.time() - start_time, 2)
    health_tracker.results = results
    health_tracker.is_running = False
    health_tracker.completed = True
    health_tracker.completed_at = datetime.now(timezone.utc).isoformat()

    logger.info("======================================================================")
    logger.info("✨ ASYNC SERVICE CHECKS COMPLETED IN %s SECONDS.", duration)
    logger.info("======================================================================")
    return results
