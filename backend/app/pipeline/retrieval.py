import asyncio
import json
import logging
import math
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.pinecone_service import pinecone_service
from app.services.reranker_service import reranker_service
from app.services.llm_service import llm_service
from app.ws_manager import manager
from app.services.query_translator import QueryTranslator
from app.services.query_decomposer import query_decomposer
from app.services.context_compressor import context_compressor
from app.services.bm25_service import bm25_service
from app.services.crag_evaluator import crag_evaluator
from app.services.web_search_service import web_search_service
from app.observability import traceable

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


def _bm25_hits_to_candidates(db_session, bm25_hits: List[Tuple[str, float]]) -> List[Dict[str, Any]]:
    """
    Turn BM25 (chunk_id, score) hits into Pinecone-shaped candidate dicts by looking
    up the full chunk row in SQL. Score is replaced with a fixed floor just above the
    relevance cutoff — BM25 rank only decides *inclusion* in the pool; the
    cross-encoder reranker decides real relevance.
    """
    from app.database import Chunk

    if not bm25_hits:
        return []

    parsed = []
    for chunk_id, _ in bm25_hits:
        if "-chunk-" not in chunk_id:
            continue
        doc_id, _, idx_str = chunk_id.rpartition("-chunk-")
        try:
            parsed.append((chunk_id, doc_id, int(idx_str)))
        except ValueError:
            continue
    if not parsed:
        return []

    rows = (
        db_session.query(Chunk)
        .filter(Chunk.doc_id.in_({p[1] for p in parsed}))
        .all()
    )
    row_lookup = {(r.doc_id, r.chunk_index): r for r in rows}

    candidates = []
    for chunk_id, doc_id, idx in parsed:
        row = row_lookup.get((doc_id, idx))
        if not row:
            continue
        candidates.append({
            "id": chunk_id,
            "score": settings.bm25_floor_score,
            "metadata": {
                "doc_id": row.doc_id,
                "original_name": row.original_name,
                "file_type": row.file_type,
                "chunk_index": row.chunk_index,
                "char_start": row.char_start,
                "char_end": row.char_end,
                "boundary_level": row.boundary_level,
                "text": row.text[:1000],
            },
        })
    return candidates


@traceable(name="hybrid_retrieve", run_type="retriever")
async def _embed_and_retrieve_subqueries(
    translated_queries: List[str],
    top_k: int,
    qm: Dict[str, Any],
    db_session,
) -> List[Dict[str, Any]]:
    """
    Embed sub-queries in parallel and retrieve candidate matches from both dense
    (Pinecone cosine) and lexical (BM25) search, merging both into one candidate pool
    (hybrid search). BM25 catches exact-match terms — numbers, IDs, currency figures —
    that dense embeddings are known to under-rank.
    """
    candidates_k = max(20, top_k * settings.reranker_candidates_multiplier)

    async def _retrieve_single(t_q: str) -> List[Dict[str, Any]]:
        t = time.perf_counter()
        q_vector, embed_tokens = await asyncio.get_event_loop().run_in_executor(
            None, embedding_service.embed_query_tracked, t_q
        )
        qm["embed_ms"] = qm.get("embed_ms", 0.0) + _ms(t)
        qm["embed_tokens"] = qm.get("embed_tokens", 0) + embed_tokens

        t = time.perf_counter()
        raw_matches = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pinecone_service.query(
                vector=q_vector,
                top_k=candidates_k,
                include_values=False,
            ),
        )
        qm["retrieve_ms"] = qm.get("retrieve_ms", 0.0) + _ms(t)
        return raw_matches

    async def _bm25_single(t_q: str) -> List[Dict[str, Any]]:
        if not settings.bm25_hybrid_enabled:
            return []
        t = time.perf_counter()
        hits = await asyncio.get_event_loop().run_in_executor(
            None, lambda: bm25_service.search(db_session, t_q, candidates_k)
        )
        qm["bm25_ms"] = qm.get("bm25_ms", 0.0) + _ms(t)
        return _bm25_hits_to_candidates(db_session, hits)

    dense_tasks = [_retrieve_single(q) for q in translated_queries]
    bm25_tasks = [_bm25_single(q) for q in translated_queries]
    dense_results, bm25_results = await asyncio.gather(
        asyncio.gather(*dense_tasks), asyncio.gather(*bm25_tasks)
    )

    # Merge and deduplicate candidates by unique vector ID. Dense matches take
    # priority (real cosine score); BM25-only hits are appended with a floor score.
    seen_chunk_ids = set()
    merged_candidates = []
    for raw_matches in dense_results:
        for m in raw_matches:
            chunk_id = m["id"]
            if chunk_id not in seen_chunk_ids:
                seen_chunk_ids.add(chunk_id)
                merged_candidates.append(m)

    bm25_added = 0
    for raw_matches in bm25_results:
        for m in raw_matches:
            chunk_id = m["id"]
            if chunk_id not in seen_chunk_ids:
                seen_chunk_ids.add(chunk_id)
                merged_candidates.append(m)
                bm25_added += 1
    qm["bm25_candidates_added"] = qm.get("bm25_candidates_added", 0) + bm25_added

    return merged_candidates


def _verify_active_documents(db_session, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Verify document active status in the database to ensure zero stale chunks."""
    from app.database import Document
    active_docs = {
        doc_id[0] for doc_id in db_session.query(Document.id).filter(Document.status == "ready").all()
    }
    
    filtered = [
        m for m in candidates
        if m["score"] >= 0.25 and m["metadata"].get("doc_id") in active_docs
    ]
    
    # Fallback to keep at least some chunks from ready documents if filtered is empty
    if not filtered and candidates:
        filtered = [
            m for m in candidates
            if m["metadata"].get("doc_id") in active_docs
        ][:5]

    return [
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


def _web_results_to_sources(web_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map Tavily web results into the same source-chunk shape used internally."""
    return [
        {
            "doc_id": f"web:{r.get('url', '')}",
            "original_name": r.get("title") or r.get("url") or "Web Result",
            "chunk_index": 0,
            "text": r.get("content", ""),
            "score": r.get("score", 0.0),
            "file_type": "web",
            "url": r.get("url"),
        }
        for r in web_results
    ]


@traceable(name="rag_query", run_type="chain")
async def retrieve_and_generate(
    question: str,
    top_k: int,
    db_session,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full RAG pipeline: Decompose → Parallel Embed/Retrieve → DB Filter → Rerank → Compress → Generate.
    Tracks per-stage latency, token usage, retrieval scores, and faithfulness.
    Persists both successful AND failed queries to QueryHistory + QueryMetrics.
    """
    from app.database import QueryHistory, QueryMetrics
    from app.services.session_episodic_memory import SessionEpisodicMemory
    from app.services.hybrid_memory_coordinator import HybridMemoryCoordinator
    from app.services.llm_service import SYSTEM_PROMPT

    episodic_memory = SessionEpisodicMemory(db_session)
    memory_coordinator = HybridMemoryCoordinator(episodic_memory, SYSTEM_PROMPT)

    query_id = str(uuid.uuid4())
    pipeline_start = time.perf_counter()
    current_stage = "embed"

    async def emit(event: str, data: Any = None):
        await manager.broadcast(event=event, data=data, query_id=query_id)

    # Accumulated metrics
    qm: Dict[str, Any] = {"status": "success", "failure_stage": None, "error_type": None}

    try:
        await emit("query_started", {"query_id": query_id, "question": question})

        # ── 1. Decompose Query (Multi-document support) ──────────────────────────
        await emit("query_embedding_started", {"question": question})
        sub_queries = await query_decomposer.decompose(question)
        if not sub_queries:
            sub_queries = [question]

        # ── 2. Translate Sub-queries ──────────────────────────────────────────
        translator = QueryTranslator()
        translated_queries = []
        for sq in sub_queries:
            t_sq = await translator.translate_query(sq)
            translated_queries.append(t_sq)

        # ── 3. Embed & Retrieve in Parallel ──────────────────────────────────
        raw_candidates = await _embed_and_retrieve_subqueries(translated_queries, top_k, qm, db_session)

        # ── 4. Verify Active Documents (No stale chunks) ──────────────────────
        current_stage = "retrieve"
        candidates = _verify_active_documents(db_session, raw_candidates)

        qm["candidate_count"] = len(candidates)
        scores = [c["score"] for c in candidates]
        qm["retrieval_score_mean"] = _safe_mean(scores)
        qm["retrieval_score_max"] = round(max(scores), 4) if scores else None

        await emit("chunks_retrieved", {
            "count": len(candidates),
            "elapsed_ms": qm.get("retrieve_ms", 0.0),
            "bm25_elapsed_ms": qm.get("bm25_ms", 0.0),
            "bm25_candidates_added": qm.get("bm25_candidates_added", 0),
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

        # ── 5. Rerank ─────────────────────────────────────────────────────────
        current_stage = "rerank"
        await emit("reranking_started", {"candidate_count": len(candidates)})
        t = time.perf_counter()
        
        # Rerank against original question to pull exact target match (e.g. chunk #12)
        reranked_sources = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: reranker_service.rerank(question, candidates, top_k=top_k * 2),
        )
        qm["rerank_ms"] = _ms(t)

        # ── 6. Context Compression ────────────────────────────────────────────
        # Extract only the relevant sentences to fit into the context window
        compressed_sources = context_compressor.compress_chunks(
            reranked_sources,
            translated_queries,
            max_chunk_tokens=settings.max_chunk_size // 2,
        )
        sources = compressed_sources[:top_k]

        qm["returned_count"] = len(sources)
        qm["rerank_score_top"] = sources[0].get("rerank_score") if sources else None
        qm["faithfulness_score"] = _faithfulness(sources)

        await emit("reranking_completed", {
            "ranked_count": len(sources),
            "elapsed_ms": qm["rerank_ms"],
            "top_score": qm["rerank_score_top"],
            "faithfulness": qm["faithfulness_score"],
        })

        # ── 6.5 CRAG: Corrective Retrieval Evaluation ─────────────────────────
        # An LLM grader classifies the refined internal context as correct /
        # incorrect / ambiguous. "incorrect" discards it for a web search fallback;
        # "ambiguous" combines internal knowledge with web results. Fails open to
        # "correct" (standard RAG behavior) on any grader/web-search error.
        qm["crag_grade"] = None
        qm["crag_confidence"] = None
        qm["crag_web_results_used"] = 0

        if settings.crag_enabled:
            current_stage = "crag_evaluate"
            await emit("crag_evaluation_started", {"source_count": len(sources)})
            t = time.perf_counter()
            grade, confidence = await crag_evaluator.grade(question, sources)
            qm["crag_ms"] = _ms(t)
            qm["crag_grade"] = grade
            qm["crag_confidence"] = confidence

            await emit("crag_evaluation_completed", {
                "grade": grade,
                "confidence": confidence,
                "elapsed_ms": qm["crag_ms"],
            })

            if grade in ("incorrect", "ambiguous"):
                current_stage = "web_search"
                await emit("web_search_started", {"grade": grade, "question": question})
                t = time.perf_counter()
                web_query = await web_search_service.rewrite_query(question)
                web_results = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: web_search_service.search(web_query, settings.crag_web_max_results)
                )
                qm["web_search_ms"] = _ms(t)
                qm["crag_web_results_used"] = len(web_results)
                web_sources = _web_results_to_sources(web_results)

                if grade == "incorrect":
                    # Internal knowledge graded irrelevant. Replace it with web
                    # results — falling back to the original sources only if web
                    # search itself came back empty (e.g. no TAVILY_API_KEY set),
                    # so the pipeline never returns zero context.
                    sources = web_sources or sources
                else:
                    # Ambiguous: combine refined internal knowledge with the web.
                    sources = sources + web_sources

                await emit("web_search_completed", {
                    "result_count": len(web_results),
                    "elapsed_ms": qm["web_search_ms"],
                    "web_query": web_query,
                })

        # ── 7. LLM generation ─────────────────────────────────────────────────
        current_stage = "llm"
        await emit("generation_started", {"model": settings.llm_model})
        t = time.perf_counter()

        # Compile messages from hybrid memory systems (System Prompt, Chat History, retrieved context chunks + current question)
        working_messages = memory_coordinator.compile_working_memory(
            session_id=session_id,
            user_query=question,
            context_chunks=sources
        )

        def stream_sync():
            return llm_service.generate_messages_stream_tracked(working_messages)

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
                "crag_grade": qm.get("crag_grade"),
                "crag_confidence": qm.get("crag_confidence"),
                "crag_web_results_used": qm.get("crag_web_results_used", 0),
            },
        })

        # ── 8. Persist ────────────────────────────────────────────────────────
        history = QueryHistory(
            id=query_id,
            session_id=session_id,
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
            "Query %s (Session: %s): %.0f ms total | embed %.0f | retrieve %.0f | rerank %.0f | llm %.0f | faith=%.2f",
            query_id[:8],
            session_id,
            qm["total_ms"], qm.get("embed_ms", 0), qm.get("retrieve_ms", 0),
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

        try:
            history = QueryHistory(
                id=query_id,
                session_id=session_id,
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
            crag_grade=m.get("crag_grade"),
            crag_confidence=m.get("crag_confidence"),
            crag_web_results_used=m.get("crag_web_results_used"),
            status=m.get("status", "success"),
            failure_stage=m.get("failure_stage"),
            error_type=m.get("error_type"),
            created_at=datetime.utcnow(),
        )
        db_session.add(record)
    except Exception as e:
        logger.warning("Failed to save QueryMetrics: %s", e)
