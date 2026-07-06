import asyncio
import json
import logging
import math
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.pinecone_service import pinecone_service
from app.services.reranker_service import reranker_service
from app.services.llm_service import llm_service
from app.ws_manager import manager

logger = logging.getLogger(__name__)


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 1)


def _safe_mean(vals: List[float]) -> Optional[float]:
    return round(sum(vals) / len(vals), 4) if vals else None


def _faithfulness(sources: List[Dict]) -> Optional[float]:
    """
    Proxy faithfulness score: sigmoid(mean rerank logit across returned sources).
    Range 0-1. Higher = sources were more relevant to the question (answer likely grounded).
    """
    logits = [s.get("rerank_score") for s in sources if s.get("rerank_score") is not None]
    if not logits:
        return None
    mean_logit = sum(logits) / len(logits)
    return round(1.0 / (1.0 + math.exp(-mean_logit)), 4)


async def retrieve_and_generate(
    question: str,
    top_k: int,
    db_session,
) -> Dict[str, Any]:
    """
    Full RAG pipeline: embed → HNSW search → rerank → generate.
    Tracks per-stage latency, token usage, retrieval scores, and faithfulness.
    Persists both successful AND failed queries to QueryHistory + QueryMetrics.
    """
    from app.database import QueryHistory, QueryMetrics

    query_id = str(uuid.uuid4())
    pipeline_start = time.perf_counter()
    current_stage = "embed"

    async def emit(event: str, data: Any = None):
        await manager.broadcast(event=event, data=data, query_id=query_id)

    # Accumulated metrics — written on both success and failure
    qm: Dict[str, Any] = {"status": "success", "failure_stage": None, "error_type": None}

    try:
        await emit("query_started", {"query_id": query_id, "question": question})

        # ── 1. Embed query ────────────────────────────────────────────────────
        await emit("query_embedding_started", {"question": question})
        t = time.perf_counter()
        query_vector, embed_tokens = await asyncio.get_event_loop().run_in_executor(
            None, embedding_service.embed_query_tracked, question
        )
        qm["embed_ms"] = _ms(t)
        qm["embed_tokens"] = embed_tokens
        await emit("query_embedded", {
            "dimension": len(query_vector),
            "elapsed_ms": qm["embed_ms"],
            "tokens": embed_tokens,
        })

        # ── 2. HNSW search (over-fetch) ───────────────────────────────────────
        current_stage = "retrieve"
        candidates_k = top_k * settings.reranker_candidates_multiplier
        await emit("retrieval_started", {"top_k": candidates_k})
        t = time.perf_counter()

        raw_matches = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pinecone_service.query(vector=query_vector, top_k=candidates_k),
        )
        qm["retrieve_ms"] = _ms(t)

        filtered = [m for m in raw_matches if m["score"] >= 0.3]
        if not filtered and raw_matches:
            filtered = raw_matches[:3]

        candidates = [
            {
                "doc_id": m["metadata"].get("doc_id", ""),
                "original_name": m["metadata"].get("original_name", "Unknown"),
                "chunk_index": m["metadata"].get("chunk_index", 0),
                "text": m["metadata"].get("text", ""),
                "score": round(m["score"], 4),
                "file_type": m["metadata"].get("file_type", ""),
                "char_start": m["metadata"].get("char_start"),
                "char_end": m["metadata"].get("char_end"),
                "boundary_level": m["metadata"].get("boundary_level"),
            }
            for m in filtered
        ]

        scores = [c["score"] for c in candidates]
        qm["candidate_count"] = len(candidates)
        qm["retrieval_score_mean"] = _safe_mean(scores)
        qm["retrieval_score_max"] = round(max(scores), 4) if scores else None

        await emit("chunks_retrieved", {
            "count": len(candidates),
            "elapsed_ms": qm["retrieve_ms"],
            "score_mean": qm["retrieval_score_mean"],
            "sources": [
                {
                    "original_name": s["original_name"],
                    "score": s["score"],
                    "preview": s["text"][:100] + "..." if len(s["text"]) > 100 else s["text"],
                }
                for s in candidates
            ],
        })

        # ── 3. Rerank ─────────────────────────────────────────────────────────
        current_stage = "rerank"
        await emit("reranking_started", {"candidate_count": len(candidates)})
        t = time.perf_counter()
        sources = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: reranker_service.rerank(question, candidates, top_k=top_k),
        )
        qm["rerank_ms"] = _ms(t)
        qm["returned_count"] = len(sources)
        qm["rerank_score_top"] = sources[0].get("rerank_score") if sources else None

        # Faithfulness proxy from rerank logits
        qm["faithfulness_score"] = _faithfulness(sources)

        await emit("reranking_completed", {
            "ranked_count": len(sources),
            "elapsed_ms": qm["rerank_ms"],
            "top_score": qm["rerank_score_top"],
            "faithfulness": qm["faithfulness_score"],
        })

        # ── 4. LLM generation ─────────────────────────────────────────────────
        current_stage = "llm"
        await emit("generation_started", {"model": settings.llm_model})
        t = time.perf_counter()

        def stream_sync():
            return llm_service.generate_stream_tracked(question, sources)

        tokens, llm_usage = await asyncio.get_event_loop().run_in_executor(None, stream_sync)
        full_answer = "".join(tokens)
        qm["llm_ms"] = _ms(t)
        qm["prompt_tokens"] = llm_usage.get("prompt_tokens")
        qm["completion_tokens"] = llm_usage.get("completion_tokens")

        for token in tokens:
            await emit("generation_token", {"token": token})

        qm["total_ms"] = _ms(pipeline_start)
        processing_time = round(qm["total_ms"] / 1000, 3)

        await emit("generation_completed", {
            "query_id": query_id,
            "answer": full_answer,
            "sources": sources,
            "processing_time": processing_time,
            "metrics": {
                "total_ms": qm["total_ms"],
                "embed_ms": qm["embed_ms"],
                "retrieve_ms": qm["retrieve_ms"],
                "rerank_ms": qm["rerank_ms"],
                "llm_ms": qm["llm_ms"],
                "prompt_tokens": qm["prompt_tokens"],
                "completion_tokens": qm["completion_tokens"],
                "faithfulness": qm["faithfulness_score"],
            },
        })

        # ── 5. Persist ────────────────────────────────────────────────────────
        history = QueryHistory(
            id=query_id,
            question=question,
            answer=full_answer,
            sources_json=json.dumps(sources),
            processing_time=processing_time,
            status="success",
            created_at=datetime.utcnow(),
        )
        db_session.add(history)
        _save_query_metrics(db_session, query_id, qm)
        db_session.commit()

        logger.info(
            "Query %s: %.0f ms total | embed %.0f | retrieve %.0f | rerank %.0f | llm %.0f | faith=%.2f",
            query_id[:8],
            qm["total_ms"], qm["embed_ms"], qm["retrieve_ms"],
            qm["rerank_ms"], qm["llm_ms"],
            qm["faithfulness_score"] or 0,
        )

        return {
            "query_id": query_id,
            "question": question,
            "answer": full_answer,
            "sources": sources,
            "processing_time": processing_time,
            "created_at": datetime.utcnow(),
        }

    except Exception as exc:
        qm["status"] = "error"
        qm["failure_stage"] = current_stage
        qm["error_type"] = type(exc).__name__
        qm["total_ms"] = _ms(pipeline_start)

        logger.error("Query %s failed at stage=%s: %s", query_id[:8], current_stage, exc)
        await emit("query_failed", {
            "query_id": query_id,
            "error": str(exc),
            "stage": current_stage,
            "error_type": type(exc).__name__,
        })

        # Persist failed query so it appears in failure stats
        try:
            history = QueryHistory(
                id=query_id,
                question=question,
                answer=None,
                sources_json=None,
                processing_time=round(qm["total_ms"] / 1000, 3),
                status="error",
                failure_stage=current_stage,
                error_type=type(exc).__name__,
                created_at=datetime.utcnow(),
            )
            db_session.add(history)
            _save_query_metrics(db_session, query_id, qm)
            db_session.commit()
        except Exception as db_exc:
            logger.warning("Could not persist failed query %s: %s", query_id[:8], db_exc)

        raise


def _save_query_metrics(db_session, query_id: str, m: Dict[str, Any]) -> None:
    from app.database import QueryMetrics
    try:
        record = QueryMetrics(
            id=query_id,
            embed_ms=m.get("embed_ms"),
            retrieve_ms=m.get("retrieve_ms"),
            rerank_ms=m.get("rerank_ms"),
            llm_ms=m.get("llm_ms"),
            total_ms=m.get("total_ms"),
            prompt_tokens=m.get("prompt_tokens"),
            completion_tokens=m.get("completion_tokens"),
            embed_tokens=m.get("embed_tokens"),
            candidate_count=m.get("candidate_count"),
            returned_count=m.get("returned_count"),
            retrieval_score_mean=m.get("retrieval_score_mean"),
            retrieval_score_max=m.get("retrieval_score_max"),
            rerank_score_top=m.get("rerank_score_top"),
            faithfulness_score=m.get("faithfulness_score"),
            status=m.get("status", "success"),
            failure_stage=m.get("failure_stage"),
            error_type=m.get("error_type"),
            created_at=datetime.utcnow(),
        )
        db_session.add(record)
    except Exception as e:
        logger.warning("Failed to save QueryMetrics: %s", e)
