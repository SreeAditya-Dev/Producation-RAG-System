import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, AsyncGenerator

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.pinecone_service import pinecone_service
from app.services.llm_service import llm_service
from app.ws_manager import manager

logger = logging.getLogger(__name__)


async def retrieve_and_generate(
    question: str,
    top_k: int,
    db_session,
) -> Dict[str, Any]:
    """
    Full RAG pipeline: embed query → search → generate.
    Streams tokens via WebSocket.
    Returns the complete result dict.
    """
    from app.database import QueryHistory

    query_id = str(uuid.uuid4())
    start_time = time.time()

    async def emit(event: str, data: Any = None):
        await manager.broadcast(event=event, data=data, query_id=query_id)

    try:
        await emit("query_started", {"query_id": query_id, "question": question})

        # 1. Embed the query
        await emit("query_embedding_started", {"question": question})
        query_vector = await asyncio.get_event_loop().run_in_executor(
            None, embedding_service.embed_query, question
        )
        await emit("query_embedded", {"dimension": len(query_vector)})

        # 2. Search Pinecone
        await emit("retrieval_started", {"top_k": top_k})
        raw_matches = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pinecone_service.query(vector=query_vector, top_k=top_k),
        )

        # Filter by minimum score
        matches = [m for m in raw_matches if m["score"] >= 0.3]
        if not matches and raw_matches:
            matches = raw_matches[:3]

        sources = [
            {
                "doc_id": m["metadata"].get("doc_id", ""),
                "original_name": m["metadata"].get("original_name", "Unknown"),
                "chunk_index": m["metadata"].get("chunk_index", 0),
                "text": m["metadata"].get("text", ""),
                "score": round(m["score"], 4),
                "file_type": m["metadata"].get("file_type", ""),
            }
            for m in matches
        ]

        await emit(
            "chunks_retrieved",
            {
                "count": len(sources),
                "sources": [
                    {
                        "original_name": s["original_name"],
                        "score": s["score"],
                        "preview": s["text"][:100] + "..." if len(s["text"]) > 100 else s["text"],
                    }
                    for s in sources
                ],
            },
        )

        # 3. Stream LLM generation
        await emit("generation_started", {"model": settings.llm_model})
        full_answer = ""

        def stream_sync():
            return list(llm_service.generate_stream(question, sources))

        tokens = await asyncio.get_event_loop().run_in_executor(None, stream_sync)

        for token in tokens:
            full_answer += token
            await emit("generation_token", {"token": token})

        processing_time = round(time.time() - start_time, 3)

        await emit(
            "generation_completed",
            {
                "query_id": query_id,
                "answer": full_answer,
                "sources": sources,
                "processing_time": processing_time,
            },
        )

        # 4. Persist to DB
        import json
        history = QueryHistory(
            id=query_id,
            question=question,
            answer=full_answer,
            sources_json=json.dumps(sources),
            processing_time=processing_time,
            created_at=datetime.utcnow(),
        )
        db_session.add(history)
        db_session.commit()

        return {
            "query_id": query_id,
            "question": question,
            "answer": full_answer,
            "sources": sources,
            "processing_time": processing_time,
            "created_at": datetime.utcnow(),
        }

    except Exception as e:
        logger.error(f"Retrieval/generation failed: {e}")
        await emit("query_failed", {"query_id": query_id, "error": str(e)})
        raise
