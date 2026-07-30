import asyncio
import json
import logging
import math
import threading
import time
import uuid
import re
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
from app.services.query_cache import query_cache
from app.services import prompt_guard
from app.services.diversity_filter import MaximalMarginalRelevanceFilter
from app.services.citation_validator import validate as validate_citations, insufficient_evidence_answer
from app.services.pii_policy import redact as redact_pii
from app.observability import traceable

logger = logging.getLogger(__name__)


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 1)


def _safe_mean(vals: List[float]) -> Optional[float]:
    return round(sum(vals) / len(vals), 4) if vals else None


# Retrieval-quality metrics that stay true when cached chunks are replayed.
# `retrieve_only` writes into the caller's live `qm` dict, so the fragment cache
# must persist this allowlist only — storing the whole dict would replay a prior
# request's status/guard/cache fields into the next one.
_RETRIEVAL_METRIC_KEYS = (
    "candidate_count", "returned_count", "retrieval_score_mean", "retrieval_score_max",
    "rerank_score_top", "reranker_relevance_proxy", "mmr_applied", "bm25_candidates_added",
)


def _retrieval_fragment_metrics(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Strip a live `qm` dict down to the fields safe to replay from cache."""
    return {key: metrics[key] for key in _RETRIEVAL_METRIC_KEYS if key in metrics}


def _reranker_relevance_proxy(sources: List[Dict]) -> Optional[float]:
    """
    A retrieval-only score, deliberately not an answer-faithfulness metric.
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
    doc_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Embed sub-queries in parallel and retrieve candidate matches from both dense
    (Pinecone cosine) and lexical (BM25) search, merging both into one candidate pool
    (hybrid search). BM25 catches exact-match terms — numbers, IDs, currency figures —
    that dense embeddings are known to under-rank.

    `doc_ids`, if given, scopes both searches to that document subset via a Pinecone
    metadata filter (rather than a full-corpus ANN scan) — the lever that keeps
    per-query cost/latency flat as the corpus grows into the millions of documents:
    scope to the relevant subset *before* searching, don't search everything.
    """
    candidates_k = max(20, top_k * settings.reranker_candidates_multiplier)
    pinecone_filter = {"doc_id": {"$in": doc_ids}} if doc_ids else None
    # `db_session` is a single SQLAlchemy Session (not thread-safe). Decomposed
    # questions run multiple sub-query BM25 lookups concurrently via
    # run_in_executor (real OS threads); without this lock they race on the
    # same session and SQLAlchemy raises "concurrent operations are not
    # permitted", silently dropping lexical search for the whole request.
    db_session_lock = threading.Lock()

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
                filter=pinecone_filter,
                include_values=settings.mmr_enabled,
            ),
        )
        qm["retrieve_ms"] = qm.get("retrieve_ms", 0.0) + _ms(t)
        return raw_matches

    def _bm25_lookup_sync(t_q: str) -> List[Dict[str, Any]]:
        # Both the search and the chunk-row lookup touch db_session, so both
        # must happen inside the same lock hold to stay serialized against
        # concurrent sub-query lookups.
        with db_session_lock:
            hits = bm25_service.search(db_session, t_q, candidates_k, doc_ids=doc_ids)
            return _bm25_hits_to_candidates(db_session, hits)

    async def _bm25_single(t_q: str) -> List[Dict[str, Any]]:
        if not settings.bm25_hybrid_enabled:
            return []
        t = time.perf_counter()
        candidates = await asyncio.get_event_loop().run_in_executor(
            None, _bm25_lookup_sync, t_q
        )
        qm["bm25_ms"] = qm.get("bm25_ms", 0.0) + _ms(t)
        return candidates

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
            "id": m.get("id"),
            "doc_id": m["metadata"].get("doc_id", ""),
            "original_name": m["metadata"].get("original_name", "Unknown"),
            "chunk_index": m["metadata"].get("chunk_index", 0),
            "text": m["metadata"].get("text", ""),
            "score": round(m["score"], 4),
            "file_type": m["metadata"].get("file_type", ""),
            "char_start": m["metadata"].get("char_start"),
            "char_end": m["metadata"].get("char_end"),
            "boundary_level": m["metadata"].get("boundary_level"),
            "values": m.get("values"),
        }
        for m in filtered
    ]


def _source_quality(sources: List[Dict[str, Any]]) -> float:
    scores = [float(s.get("rerank_score", s.get("score", 0.0))) for s in sources]
    return sum(scores) / len(scores) if scores else float("-inf")


async def _plan_sub_queries(question: str) -> List[str]:
    """Decompose into sub-queries and rewrite each, under one stage-wide deadline.

    Decompose must run first (it produces the sub-queries), but the per-sub-query
    rewrites are independent LLM calls — run them concurrently so one stalled
    provider request delays the stage by one timeout, not one timeout per
    sub-query. Neither helper raises (both fall back to the raw query), so only
    the budget can cut this short, and it exists because the provider SDK retries
    every stalled call: three sub-queries can otherwise serialize into 30 s+ of
    backoff. On timeout we keep whatever the decomposer produced and retrieve on
    the user's own wording — worse recall, not a failed query.
    """
    planned: List[str] = [question]

    async def _plan() -> List[str]:
        nonlocal planned
        sub_queries = await query_decomposer.decompose(question) or [question]
        planned = sub_queries  # usable on its own if the rewrites run out of budget
        translator = QueryTranslator()
        return list(await asyncio.gather(*(translator.translate_query(q) for q in sub_queries)))

    try:
        return await asyncio.wait_for(_plan(), timeout=settings.query_planning_budget_seconds)
    except asyncio.TimeoutError:
        logger.warning(
            "Query planning exceeded its %.0fs budget; retrieving on un-rewritten sub-queries: %s",
            settings.query_planning_budget_seconds, planned,
        )
        return planned


async def retrieve_only(
    question: str, top_k: int, db_session, doc_ids: Optional[List[str]] = None,
    *, evaluation_mode: bool = False, metrics: Optional[Dict[str, Any]] = None,
    plan_query: bool = True,
) -> Dict[str, Any]:
    """Callable retrieval contract: ordered chunks and stage metadata, no generation.

    Evaluation mode avoids decomposition/translation LLM calls so mocked and CI
    runs are deterministic for a fixed vector/reranker fixture. `plan_query=False`
    skips the same LLM calls for callers whose `question` is already a machine-built
    search string that decomposition can only blur.
    """
    qm = metrics if metrics is not None else {}
    translate_start = time.perf_counter()
    if evaluation_mode or not plan_query:
        translated = [question]
    else:
        translated = await _plan_sub_queries(question)
    qm["translate_ms"] = _ms(translate_start)
    raw = await _embed_and_retrieve_subqueries(translated, top_k, qm, db_session, doc_ids=doc_ids)
    candidates = _verify_active_documents(db_session, raw)
    rerank_start = time.perf_counter()
    reranked = await asyncio.get_event_loop().run_in_executor(
        None, lambda: reranker_service.rerank(question, candidates, top_k=top_k * 2)
    )
    qm["rerank_ms"] = _ms(rerank_start)
    if settings.mmr_enabled and len(reranked) > top_k:
        reranked = MaximalMarginalRelevanceFilter(settings.mmr_lambda).filter_candidates(None, reranked, top_k)
        qm["mmr_applied"] = True
    else:
        qm["mmr_applied"] = False
    sources = context_compressor.compress_chunks(reranked, translated, max_chunk_tokens=settings.max_chunk_size // 2)[:top_k]
    for source in sources:
        source.pop("values", None)
    qm.update({
        "candidate_count": len(candidates), "returned_count": len(sources),
        "retrieval_score_mean": _safe_mean([c["score"] for c in candidates]),
        "retrieval_score_max": round(max((c["score"] for c in candidates), default=0), 4) if candidates else None,
        "rerank_score_top": sources[0].get("rerank_score") if sources else None,
        "reranker_relevance_proxy": _reranker_relevance_proxy(sources),
    })
    return {"chunk_ids": [s.get("id") or f"{s.get('doc_id')}-chunk-{s.get('chunk_index')}" for s in sources], "sources": sources, "translated_queries": translated, "metrics": qm}


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
    client_id: Optional[str] = None,
    doc_ids: Optional[List[str]] = None,
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
        await manager.broadcast(event=event, data=data, query_id=query_id, client_id=client_id)

    # Accumulated metrics
    qm: Dict[str, Any] = {"status": "success", "failure_stage": None, "error_type": None}

    try:
        await emit("query_started", {"query_id": query_id, "question": question})

        # Enforce question policy before decomposition, retrieval, or grading.
        policy = prompt_guard.screen_question(question)
        qm["prompt_injection_question_flagged"] = bool(policy["hits"])
        if policy["action"] == "block":
            raise prompt_guard.PromptPolicyBlockedError("Question was blocked by prompt-safety policy")
        if policy["action"] == "sanitize":
            await emit("prompt_injection_flagged", {"flagged": True, "action": "sanitize", "question_hits": policy["hits"], "context_hits": {}})
            question = policy["text"]
        if settings.pii_redaction_enabled:
            question = redact_pii(question)

        # ── 0. Query cache check (history-free queries only) ──────────────────
        # Three tiers, cheapest first: exact hash → semantic (dense cosine over
        # cached query embeddings) → retrieval fragment. All are keyed to a
        # corpus fingerprint, not just a TTL, so any ingest/replace/delete drops
        # the whole cache and a hit can never predate a document change.
        #
        # Eligibility is "no conversation history", not "no session": the UI
        # sends a session_id on every query, but a session's FIRST turn has no
        # episodic history yet (memory_coordinator packs prior successful
        # QueryHistory rows), so its answer cannot depend on the thread — it is
        # cache-equivalent to a stateless call. Turn 2+ still bypasses all
        # tiers: those answers are conditioned on history, and replaying one
        # keyed only on question text could contradict the conversation.
        cache_embedding = None
        cacheable = not session_id or db_session.query(QueryHistory.id).filter(
            QueryHistory.session_id == session_id,
            QueryHistory.status == "success",
        ).first() is None
        if cacheable:
            cached = await asyncio.get_event_loop().run_in_executor(
                None, lambda: query_cache.get(db_session, question, top_k, doc_ids)
            )
            if cached is not None:
                qm.update({"cache_type": "exact", "stream_completed": True, "total_ms": _ms(pipeline_start)})
                # Keep the real session_id: a first-turn hit must still anchor
                # its thread so the next turn sees this exchange as history.
                history = QueryHistory(id=query_id, session_id=session_id, client_id=client_id, question=question, answer=cached["answer"], sources_json=json.dumps(cached["sources"]), processing_time=0.0, status="success", created_at=datetime.utcnow())
                db_session.add(history)
                _save_query_metrics(db_session, query_id, qm)
                db_session.commit()
                await emit("cache_hit", {"query_id": query_id})
                processing_time = 0.0
                await emit("generation_completed", {
                    "query_id": query_id,
                    "answer": cached["answer"],
                    "sources": cached["sources"],
                    "processing_time": processing_time,
                    "metrics": {"cache_hit": True},
                })
                logger.info("Query %s served from cache (question=%r)", query_id[:8], question[:60])
                return {
                    "query_id": query_id,
                    "question": question,
                    "answer": cached["answer"],
                    "sources": cached["sources"],
                    "processing_time": processing_time,
                    "created_at": datetime.utcnow(),
                }
            # One embedding of the raw question serves every approximate tier
            # below (semantic answer + retrieval fragment). Computing it here
            # rather than inside each tier keeps the miss-path overhead at a
            # single embed call. None means the provider failed — the semantic
            # tiers then no-op and the full pipeline runs.
            cache_embedding = await asyncio.get_event_loop().run_in_executor(
                None, lambda: query_cache.embed_question(question)
            )
            cached = await asyncio.get_event_loop().run_in_executor(
                None, lambda: query_cache.semantic_get(db_session, question, top_k, doc_ids, embedding=cache_embedding)
            )
            if cached is not None:
                qm["cache_type"] = "semantic"
                qm["cache_similarity"] = cached.get("_cache_similarity")
                qm.update({"stream_completed": True, "total_ms": _ms(pipeline_start)})
                db_session.add(QueryHistory(id=query_id, session_id=session_id, client_id=client_id, question=question, answer=cached["answer"], sources_json=json.dumps(cached["sources"]), processing_time=0.0, status="success", created_at=datetime.utcnow()))
                _save_query_metrics(db_session, query_id, qm)
                db_session.commit()
                await emit("cache_hit", {"query_id": query_id, "type": "semantic", "similarity": cached.get("_cache_similarity")})
                return {"query_id": query_id, "question": question, "answer": cached["answer"], "sources": cached["sources"], "processing_time": 0.0, "created_at": datetime.utcnow()}

        # ── 1–6. Retrieval contract (decompose/translate/retrieve/rerank/compress) ──
        await emit("query_embedding_started", {"question": question})
        current_stage = "retrieve"
        retrieval_start = time.perf_counter()
        # Fragment cache: reuse the retrieved+reranked chunks for a repeat or
        # paraphrase, skipping decompose/embed/BM25/rerank. Generation still
        # runs on this turn, so the answer is fresh — only the evidence-gathering
        # work is amortized. History-bearing turns skip it (cache_embedding is
        # None and the keys were never populated for them).
        retrieval = None
        if cacheable:
            retrieval = await asyncio.get_event_loop().run_in_executor(
                None, lambda: query_cache.retrieval_get(db_session, question, top_k, doc_ids, embedding=cache_embedding)
            )
        if retrieval is not None:
            # Quality metrics describe the chunks actually in use, so they carry
            # over. Latency/token counters are zeroed: no work was done this turn,
            # and replaying the original run's timings would corrupt the p95s.
            qm.update(retrieval.get("metrics", {}))
            qm.update({"embed_ms": 0.0, "retrieve_ms": 0.0, "bm25_ms": 0.0, "embed_tokens": 0,
                       "translate_ms": 0.0, "rerank_ms": 0.0})
            qm["retrieval_cache_hit"] = True
            qm["cache_type"] = "retrieval"
            qm["cache_similarity"] = retrieval.get("_cache_similarity")
            await emit("cache_hit", {"query_id": query_id, "type": "retrieval", "similarity": retrieval.get("_cache_similarity")})
        else:
            retrieval = await retrieve_only(question, top_k, db_session, doc_ids=doc_ids, metrics=qm)
            qm["retrieval_cache_hit"] = False
            if cacheable:
                fragment = {
                    "sources": retrieval["sources"],
                    "translated_queries": retrieval["translated_queries"],
                    "metrics": _retrieval_fragment_metrics(retrieval["metrics"]),
                }
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: query_cache.retrieval_set(
                        db_session, question, top_k, fragment, doc_ids, embedding=cache_embedding
                    ),
                )
        sources = retrieval["sources"]
        translated_queries = retrieval["translated_queries"]
        # `rerank_ms` is set by the reranker stage itself; a fragment-cache hit
        # zeroes it. This only backstops callers that bypass both.
        qm.setdefault("rerank_ms", 0.0)
        qm["retrieval_ms"] = _ms(retrieval_start)
        candidates = [{"original_name": s["original_name"], "score": s["score"], "text": s["text"]} for s in sources]

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

        await emit("reranking_completed", {
            "ranked_count": len(sources),
            "elapsed_ms": qm["rerank_ms"],
            "top_score": qm["rerank_score_top"],
            "reranker_relevance_proxy": qm["reranker_relevance_proxy"],
        })

        # ── 6.1 Prompt injection scan (detection/telemetry only) ──────────────
        # Defense-in-depth alongside the hardened SYSTEM_PROMPT and the
        # untrusted-data delimiters in HybridMemoryCoordinator. Does not block
        # the query — logs and reports so injection attempts are visible.
        guard_result = prompt_guard.scan_question_and_context(question, sources)
        qm["prompt_injection_flagged"] = guard_result["flagged"]
        if guard_result["flagged"]:
            await emit("prompt_injection_flagged", guard_result)
        sources, quarantined = prompt_guard.quarantine_context(sources)
        if settings.pii_redaction_enabled:
            sources = [{**source, "text": redact_pii(source.get("text", ""))} for source in sources]
        qm["context_quarantined_count"] = len(quarantined)

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

            # One retrieval-only retry is deliberately bounded and happens
            # before the existing one-shot web fallback. It never calls CRAG or
            # web search recursively.
            qm["retry_attempt_count"] = 0
            if settings.retrieval_retry_enabled and grade in ("incorrect", "ambiguous"):
                qm.update({"retry_attempt_count": 1, "retry_reason": f"crag_{grade}"})
                context_hint = ", ".join(s.get("original_name", "") for s in sources[:2])
                rewritten = f"{question}\nRetrieve direct evidence; prioritize details related to: {context_hint}"[:settings.retrieval_retry_token_budget * 4]
                qm["retry_rewritten_query"] = rewritten
                retry_start = time.perf_counter()
                # `rewritten` is already a targeted English search string naming
                # the documents to prioritize. Decomposing and rewriting it again
                # is a second full round of planning LLM calls — the single
                # largest slice of retry latency — and it can only dilute the
                # hint this branch just added, so plan_query is off here.
                retry_result = await retrieve_only(
                    rewritten, top_k, db_session, doc_ids=doc_ids, metrics={}, plan_query=False
                )
                retry_sources = retry_result["sources"]
                original_ids = {s.get("id") for s in sources}
                retry_ids = {s.get("id") for s in retry_sources}
                qm["retry_candidate_overlap"] = round(len(original_ids & retry_ids) / max(1, len(original_ids | retry_ids)), 4)
                qm["retry_latency_ms"] = _ms(retry_start)
                qm["retry_chosen"] = _source_quality(retry_sources) > _source_quality(sources)
                if qm["retry_chosen"]:
                    sources = retry_sources
                await emit("retrieval_retry_completed", {"attempt_count": 1, "reason": qm["retry_reason"], "chosen": qm["retry_chosen"], "candidate_overlap": qm["retry_candidate_overlap"], "elapsed_ms": qm["retry_latency_ms"]})

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
        working_messages, budget_metrics = memory_coordinator.compile_working_memory(
            session_id=session_id,
            user_query=question,
            context_chunks=sources
        )
        qm.update(budget_metrics)

        # The provider client is synchronous. Bridge its callback into the async
        # WebSocket loop so clients receive tokens while generation is running.
        loop = asyncio.get_running_loop()
        token_queue: asyncio.Queue[str] = asyncio.Queue()
        tokens: List[str] = []

        def on_token(token: str) -> None:
            tokens.append(token)
            loop.call_soon_threadsafe(token_queue.put_nowait, token)

        stream_future = loop.run_in_executor(None, llm_service.stream_messages, working_messages, on_token)
        while not stream_future.done():
            try:
                token = await asyncio.wait_for(token_queue.get(), timeout=0.1)
                await emit("generation_token", {"token": token})
            except asyncio.TimeoutError:
                continue
        llm_usage = await stream_future
        while not token_queue.empty():
            await emit("generation_token", {"token": token_queue.get_nowait()})

        full_answer = "".join(tokens)
        # A stream that breaks mid-answer returns the tokens it managed to emit
        # rather than failing the query, so this is a real signal now — not every
        # run is a clean stream.
        qm["stream_completed"] = bool(llm_usage.get("stream_completed", 1))
        qm["llm_ms"] = _ms(t)
        qm["prompt_tokens"] = llm_usage.get("prompt_tokens")
        qm["completion_tokens"] = llm_usage.get("completion_tokens")
        citation_result = validate_citations(full_answer, sources) if settings.citation_validation_enabled else {
            "cited_source_count": 0, "invalid_citations": [], "valid": True,
        }
        # Citation-grounding failure can use the one allowed retrieval retry if
        # CRAG did not already consume it. The answer is then repaired only
        # against this new bounded source set; no web/tool recursion is possible.
        # A truncated answer is excluded: its citations are missing because the
        # stream was cut, not because retrieval was wrong, so another retrieval
        # round cannot repair it and would only add latency to a request that
        # has already degraded.
        if (not citation_result["valid"] and settings.retrieval_retry_enabled
                and qm["stream_completed"]
                and qm.get("retry_attempt_count", 0) < settings.retrieval_retry_max_attempts):
            qm.update({"retry_attempt_count": 1, "retry_reason": "citation_grounding"})
            retry_start = time.perf_counter()
            retry_result = await retrieve_only(question, top_k, db_session, doc_ids=doc_ids, metrics={})
            retry_sources = retry_result["sources"]
            prior_ids = {s.get("id") for s in sources}
            retry_ids = {s.get("id") for s in retry_sources}
            qm["retry_candidate_overlap"] = round(len(prior_ids & retry_ids) / max(1, len(prior_ids | retry_ids)), 4)
            qm["retry_latency_ms"] = _ms(retry_start)
            qm["retry_chosen"] = _source_quality(retry_sources) > _source_quality(sources)
            if qm["retry_chosen"]:
                sources = retry_sources
            await emit("retrieval_retry_completed", {"attempt_count": 1, "reason": "citation_grounding", "chosen": qm["retry_chosen"], "elapsed_ms": qm["retry_latency_ms"]})
        qm["citation_verifier_used"] = False
        qm["citation_repaired"] = False
        if not citation_result["valid"] and settings.citation_verifier_enabled:
            qm["citation_verifier_used"] = True
            packed_sources = "\n\n".join(f"[S{i}] {s.get('text', '')}" for i, s in enumerate(sources, 1))
            repair_messages = [
                {"role": "system", "content": "Repair citation formatting only. Use only supplied sources, cite factual claims as [S#], and return insufficient evidence if unsupported."},
                {"role": "user", "content": f"Answer to repair:\n{full_answer}\n\nSources:\n{packed_sources}"},
            ]
            repaired = await asyncio.get_running_loop().run_in_executor(None, lambda: llm_service.generate_messages(repair_messages, max_tokens=settings.retrieval_retry_token_budget))
            repaired_result = validate_citations(repaired, sources)
            if repaired_result["valid"]:
                full_answer, citation_result, qm["citation_repaired"] = repaired, repaired_result, True
        if not citation_result["valid"]:
            full_answer = insufficient_evidence_answer(sources)
            citation_result = validate_citations(full_answer, sources)
        qm.update({f"citation_{key}": value for key, value in citation_result.items()})

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
                "reranker_relevance_proxy": qm.get("reranker_relevance_proxy"),
                "crag_grade": qm.get("crag_grade"),
                "crag_confidence": qm.get("crag_confidence"),
                "crag_web_results_used": qm.get("crag_web_results_used", 0),
                "mmr_applied": qm["mmr_applied"],
                "context_tokens_estimated": qm["context_tokens_estimated"],
                "history_tokens_estimated": qm["history_tokens_estimated"],
                "citation_valid": citation_result["valid"],
                "citation_repaired": qm["citation_repaired"],
                "cache_type": qm.get("cache_type", "none"),
                "stream_completed": qm["stream_completed"],
            },
        })

        # ── 8. Persist ────────────────────────────────────────────────────────
        history = QueryHistory(
            id=query_id,
            session_id=session_id,
            client_id=client_id,
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

        # `cacheable` was computed before this turn's own history row was
        # committed, so it still means "generated with empty history" — safe
        # to serve to any other history-free asker of the same question.
        if (cacheable and citation_result["valid"] and qm["stream_completed"]
                and not any(s.get("file_type") == "web" for s in sources)):
            cache_value = {"answer": full_answer, "sources": sources}
            query_cache.set(db_session, question, top_k, cache_value, doc_ids=doc_ids)
            # Reuses the embedding already computed at lookup time — a cached
            # write costs no additional provider call.
            query_cache.semantic_set(db_session, question, top_k, cache_value, doc_ids=doc_ids, embedding=cache_embedding)

        logger.info(
            "Query %s (Session: %s): %.0f ms total | translate %.0f | embed %.0f | retrieve %.0f | "
            "rerank %.0f | llm %.0f | rerank_proxy=%.2f",
            query_id[:8],
            session_id,
            qm["total_ms"], qm.get("translate_ms", 0), qm.get("embed_ms", 0), qm.get("retrieve_ms", 0),
            qm["rerank_ms"], qm["llm_ms"],
            qm.get("reranker_relevance_proxy") or 0,
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
                client_id=client_id,
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
            faithfulness_score=m.get("faithfulness_score"),  # legacy installations only
            reranker_relevance_proxy=m.get("reranker_relevance_proxy"),
            crag_grade=m.get("crag_grade"),
            crag_confidence=m.get("crag_confidence"),
            crag_web_results_used=m.get("crag_web_results_used"),
            context_tokens_estimated=m.get("context_tokens_estimated"),
            history_tokens_estimated=m.get("history_tokens_estimated"),
            context_chunks_dropped=m.get("context_chunks_dropped"),
            mmr_applied=m.get("mmr_applied"),
            citation_valid=m.get("citation_valid"),
            citation_cited_source_count=m.get("citation_cited_source_count"),
            citation_invalid_citations=json.dumps(m.get("citation_invalid_citations", [])),
            citation_verifier_used=m.get("citation_verifier_used"),
            citation_repaired=m.get("citation_repaired"),
            cache_type=m.get("cache_type", "none"),
            retry_attempt_count=m.get("retry_attempt_count", 0),
            retry_reason=m.get("retry_reason"),
            retry_rewritten_query=m.get("retry_rewritten_query"),
            retry_latency_ms=m.get("retry_latency_ms"),
            retry_candidate_overlap=m.get("retry_candidate_overlap"),
            retry_chosen=m.get("retry_chosen"),
            stream_completed=m.get("stream_completed"),
            budget_exhaustion_reason=m.get("budget_exhaustion_reason"),
            status=m.get("status", "success"),
            failure_stage=m.get("failure_stage"),
            error_type=m.get("error_type"),
            created_at=datetime.utcnow(),
        )
        db_session.add(record)
    except Exception as e:
        logger.warning("Failed to save QueryMetrics: %s", e)
