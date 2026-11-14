"""Asynchronous Task Queue and Pipeline Orchestrator for ARGUS.

Coordinates execution across discovery, collection, filtering, entity resolution,
relationship mapping, and intelligence analysis with strict budget enforcement.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Optional

from argus.core.db import Database, PipelineTaskRepository, ResourceUsageRepository
from argus.core.models import (
    PipelineTask,
    PipelineTaskStatus,
    PipelineTaskType,
)

logger = logging.getLogger("argus.orchestration.pipeline")


@dataclass
class PipelineBudget:
    """Resource limits for an investigation pipeline execution."""

    max_http_requests: int = 1000
    max_llm_calls: int = 100
    max_document_bytes: int = 100_000_000

    current_http_requests: int = 0
    current_llm_calls: int = 0
    current_document_bytes: int = 0

    def check_http_request(self) -> bool:
        return self.current_http_requests < self.max_http_requests

    def check_llm_call(self) -> bool:
        return self.current_llm_calls < self.max_llm_calls

    def check_document_bytes(self, size: int) -> bool:
        return (self.current_document_bytes + size) <= self.max_document_bytes


class PipelineOrchestrator:
    """Priority task queue with concurrency management and resource budgeting."""

    def __init__(
        self,
        db: Database,
        max_concurrency: int = 5,
        budget: Optional[PipelineBudget] = None,
    ) -> None:
        self.db = db
        self.max_concurrency = max_concurrency
        self.budget = budget or PipelineBudget()
        self.task_repo = PipelineTaskRepository(db)
        self.resource_repo = ResourceUsageRepository(db)

        self._queue: asyncio.PriorityQueue[tuple[int, PipelineTask, Callable[..., Coroutine[Any, Any, Any]]]] = (
            asyncio.PriorityQueue()
        )
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._cancelled = False

    async def enqueue(
        self,
        task: PipelineTask,
        handler: Callable[..., Coroutine[Any, Any, Any]],
    ) -> None:
        """Enqueue a task with its execution handler, ordered by priority."""
        await self.task_repo.create(task)
        await self._queue.put((task.priority, task, handler))

    def cancel(self) -> None:
        """Cancel the pipeline execution."""
        self._cancelled = True

    async def run_next(self) -> Optional[PipelineTask]:
        """Process a single task from the priority queue."""
        if self._queue.empty() or self._cancelled:
            return None

        priority, task, handler = await self._queue.get()

        # Check budget limits before dispatching
        if task.task_type == PipelineTaskType.COLLECT and not self.budget.check_http_request():
            await self.task_repo.update_status(
                task.id,
                PipelineTaskStatus.BUDGET_EXCEEDED,
                error_message="HTTP request budget exceeded",
            )
            self._queue.task_done()
            return await self.task_repo.get(task.id)

        if task.task_type == PipelineTaskType.ANALYZE and not self.budget.check_llm_call():
            await self.task_repo.update_status(
                task.id,
                PipelineTaskStatus.BUDGET_EXCEEDED,
                error_message="LLM call budget exceeded",
            )
            self._queue.task_done()
            return await self.task_repo.get(task.id)

        async with self._semaphore:
            await self.task_repo.update_status(task.id, PipelineTaskStatus.RUNNING)
            try:
                output = await handler(task)
                if task.task_type == PipelineTaskType.COLLECT:
                    self.budget.current_http_requests += 1
                elif task.task_type == PipelineTaskType.ANALYZE:
                    self.budget.current_llm_calls += 1

                await self.task_repo.update_status(
                    task.id,
                    PipelineTaskStatus.COMPLETED,
                    output_data=output if isinstance(output, dict) else {},
                )
            except Exception as exc:
                logger.error("Pipeline task %s (%s) failed: %s", task.id, task.task_type, exc)
                await self.task_repo.update_status(
                    task.id,
                    PipelineTaskStatus.FAILED,
                    error_message=str(exc),
                )
            finally:
                self._queue.task_done()

        return await self.task_repo.get(task.id)

    async def run_all(self) -> int:
        """Run all enqueued tasks until queue is exhausted."""
        completed_count = 0
        while not self._queue.empty() and not self._cancelled:
            res = await self.run_next()
            if res and res.status == PipelineTaskStatus.COMPLETED:
                completed_count += 1
        return completed_count
