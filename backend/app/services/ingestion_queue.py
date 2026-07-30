"""
In-process ingestion queue with serial execution.

Why a queue instead of fire-and-forget BackgroundTasks:
  1. BackgroundTasks runs ALL uploads concurrently — five PDFs uploaded at once
     means five simultaneous NVIDIA API streams, instant rate-limit errors.
  2. BackgroundTasks is tied to the request lifecycle — Azure can restart the
     container (health-check timeout) and kill every in-flight task.
  3. No visibility into what's running, what's queued, or what position a
     document is in.

This module gives us:
  • FIFO ordering — documents are processed one at a time (configurable).
  • Queue position tracking — the frontend can show "Position 2 of 3".
  • WebSocket progress — emits queue_position_updated events.
  • Graceful shutdown — finishes the current document before stopping.
  • Duplicate-safe — re-uploading the same doc won't double-queue it.

Works on Azure App Service (single container), local dev, and Docker — no
Redis, Celery, or external broker needed.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class IngestionTask:
    """A single document waiting to be ingested."""
    doc_id: str
    s3_key: str
    original_name: str
    file_type: str
    client_id: Optional[str] = None

    status: TaskStatus = TaskStatus.QUEUED
    queue_position: int = 0
    queued_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    chunk_count: int = 0


class IngestionQueue:
    """
    Async FIFO queue that processes documents one at a time.

    Usage:
        # At app startup:
        ingestion_queue.start()

        # On upload:
        ingestion_queue.enqueue(task)

        # At app shutdown:
        await ingestion_queue.stop()
    """

    def __init__(self, max_queue_size: int = 50):
        self._queue: asyncio.Queue[IngestionTask] = asyncio.Queue(maxsize=max_queue_size)
        self._worker_task: Optional[asyncio.Task] = None
        self._running = False

        # Track all tasks (active + history) for status queries
        self._tasks: Dict[str, IngestionTask] = {}
        # Ordered list of doc_ids currently waiting in the queue
        self._pending_ids: List[str] = []
        # Currently processing task
        self._current: Optional[IngestionTask] = None
        self._lock = asyncio.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the background worker. Call from app startup event."""
        if self._running:
            return
        self._running = True
        loop = asyncio.get_event_loop()
        self._worker_task = loop.create_task(self._worker())
        loop.create_task(self.recover_pending_documents())
        logger.info("Ingestion queue started (serial processing + auto recovery active).")

    async def recover_pending_documents(self) -> None:
        """
        Finds documents stuck in 'queued' or 'processing' status in DB (e.g., from a prior server restart)
        and automatically re-enqueues them for background processing.
        """
        try:
            from app.database import SessionLocal, Document
            session = SessionLocal()
            stuck_docs = session.query(Document).filter(Document.status.in_(["queued", "processing"])).all()
            if not stuck_docs:
                session.close()
                return

            logger.info("Found %d pending/stuck document(s) in DB upon startup. Re-enqueuing...", len(stuck_docs))
            for doc in stuck_docs:
                task = IngestionTask(
                    doc_id=doc.id,
                    s3_key=doc.filename,
                    original_name=doc.original_name,
                    file_type=doc.file_type,
                )
                await self.enqueue(task)
            session.close()
        except Exception as exc:
            logger.error("Failed to recover pending documents on startup: %s", exc)

    async def stop(self, timeout: float = 60.0) -> None:
        """
        Graceful shutdown: finish the current task, discard the rest.
        Call from app shutdown event.
        """
        self._running = False
        if self._worker_task:
            try:
                await asyncio.wait_for(self._worker_task, timeout=timeout)
            except asyncio.TimeoutError:
                logger.warning("Ingestion queue shutdown timed out after %.0fs, cancelling.", timeout)
                self._worker_task.cancel()
            except asyncio.CancelledError:
                pass
        logger.info("Ingestion queue stopped.")

    # ── Public API ────────────────────────────────────────────────────────────

    async def enqueue(self, task: IngestionTask) -> int:
        """
        Add a document to the ingestion queue.
        Returns the queue position (1-based). Raises if the queue is full.
        """
        async with self._lock:
            # Prevent double-queuing the same document
            if task.doc_id in self._tasks:
                existing = self._tasks[task.doc_id]
                if existing.status in (TaskStatus.QUEUED, TaskStatus.PROCESSING):
                    logger.info("Doc %s already in queue (status=%s), skipping.", task.doc_id, existing.status)
                    return existing.queue_position

            position = len(self._pending_ids) + 1
            if self._current:
                position += 1  # +1 because one is currently processing

            task.queue_position = position
            task.status = TaskStatus.QUEUED

            self._tasks[task.doc_id] = task
            self._pending_ids.append(task.doc_id)
            await self._queue.put(task)

        logger.info(
            "Enqueued doc %s (%s) at position %d. Queue depth: %d",
            task.doc_id, task.original_name, position, self._queue.qsize(),
        )

        # Notify frontend about queue position
        await self._emit_queue_update(task)
        return position

    def get_task(self, doc_id: str) -> Optional[IngestionTask]:
        """Get the status of a task by document ID."""
        return self._tasks.get(doc_id)

    def get_queue_status(self) -> Dict[str, Any]:
        """Get a snapshot of the current queue state."""
        return {
            "queue_depth": self._queue.qsize(),
            "is_processing": self._current is not None,
            "current_doc": {
                "doc_id": self._current.doc_id,
                "original_name": self._current.original_name,
                "started_at": self._current.started_at,
                "elapsed_s": round(time.time() - self._current.started_at, 1) if self._current.started_at else 0,
            } if self._current else None,
            "pending": [
                {
                    "doc_id": did,
                    "original_name": self._tasks[did].original_name,
                    "position": idx + 1,
                    "queued_at": self._tasks[did].queued_at,
                }
                for idx, did in enumerate(self._pending_ids)
                if did in self._tasks
            ],
        }

    async def cancel(self, doc_id: str) -> bool:
        """Cancel a queued (not yet processing) task."""
        async with self._lock:
            task = self._tasks.get(doc_id)
            if not task or task.status != TaskStatus.QUEUED:
                return False
            task.status = TaskStatus.CANCELLED
            if doc_id in self._pending_ids:
                self._pending_ids.remove(doc_id)
                await self._recalculate_positions()
            return True

    # ── Worker ────────────────────────────────────────────────────────────────

    async def _worker(self) -> None:
        """
        Background coroutine that pulls tasks from the queue and processes
        them one at a time. Runs for the lifetime of the application.
        """
        logger.info("Ingestion worker started.")
        while self._running or not self._queue.empty():
            try:
                # Wait up to 1s for a task — allows checking self._running
                try:
                    task = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                # Skip cancelled tasks
                if task.status == TaskStatus.CANCELLED:
                    self._queue.task_done()
                    continue

                await self._process_task(task)
                self._queue.task_done()

            except asyncio.CancelledError:
                logger.info("Ingestion worker cancelled.")
                break
            except Exception as exc:
                logger.error("Ingestion worker unexpected error: %s", exc, exc_info=True)
                await asyncio.sleep(1)  # Prevent tight error loop

        logger.info("Ingestion worker stopped.")

    async def _process_task(self, task: IngestionTask) -> None:
        """Process a single ingestion task."""
        from app.pipeline.ingestion import ingest_document
        from app.database import SessionLocal, Document

        async with self._lock:
            task.status = TaskStatus.PROCESSING
            task.started_at = time.time()
            self._current = task
            if task.doc_id in self._pending_ids:
                self._pending_ids.remove(task.doc_id)
            await self._recalculate_positions()

        logger.info("Processing doc %s (%s)…", task.doc_id, task.original_name)
        await self._emit_queue_update(task)

        session = SessionLocal()
        try:
            chunk_count = await ingest_document(
                doc_id=task.doc_id,
                s3_key=task.s3_key,
                original_name=task.original_name,
                file_type=task.file_type,
                db_session=session,
                client_id=task.client_id,
            )
            task.status = TaskStatus.COMPLETED
            task.chunk_count = chunk_count
            logger.info("Doc %s completed: %d chunks.", task.doc_id, chunk_count)

        except Exception as exc:
            task.status = TaskStatus.FAILED
            task.error = str(exc)
            logger.error("Doc %s failed: %s", task.doc_id, exc)

            # Mark the document as errored in DB
            try:
                doc = session.query(Document).filter(Document.id == task.doc_id).first()
                if doc and doc.status != "error":
                    doc.status = "error"
                    doc.error_message = f"[queue] {exc}"
                    doc.updated_at = datetime.utcnow()
                    session.commit()
            except Exception:
                pass

        finally:
            task.completed_at = time.time()
            session.close()

            async with self._lock:
                self._current = None

            await self._emit_queue_update(task)

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _recalculate_positions(self) -> None:
        """Update queue_position for all pending tasks after a change."""
        offset = 2 if self._current else 1  # position 1 = currently processing
        for idx, doc_id in enumerate(self._pending_ids):
            if doc_id in self._tasks:
                self._tasks[doc_id].queue_position = idx + offset

    async def _emit_queue_update(self, task: IngestionTask) -> None:
        """Notify connected WebSocket clients about queue changes."""
        try:
            from app.ws_manager import manager

            data = {
                "doc_id": task.doc_id,
                "original_name": task.original_name,
                "status": task.status.value,
                "queue_position": task.queue_position,
                "queue_depth": self._queue.qsize() + (1 if self._current else 0),
            }

            if task.status == TaskStatus.PROCESSING:
                data["message"] = f"Processing '{task.original_name}'…"
            elif task.status == TaskStatus.QUEUED:
                data["message"] = f"'{task.original_name}' is #{task.queue_position} in queue"
            elif task.status == TaskStatus.COMPLETED:
                elapsed = round(task.completed_at - task.started_at, 1) if task.completed_at and task.started_at else 0
                data["message"] = f"'{task.original_name}' done ({task.chunk_count} chunks, {elapsed}s)"
                data["elapsed_s"] = elapsed
            elif task.status == TaskStatus.FAILED:
                data["message"] = f"'{task.original_name}' failed: {task.error}"

            await manager.broadcast(
                event="queue_status",
                data=data,
                document_id=task.doc_id,
                client_id=task.client_id,
            )
        except Exception as exc:
            logger.debug("Queue WS emit error: %s", exc)


# ── Singleton ─────────────────────────────────────────────────────────────────
ingestion_queue = IngestionQueue()
