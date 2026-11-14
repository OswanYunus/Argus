"""Unit tests for the Pipeline Orchestrator and task queue."""

from __future__ import annotations

import pytest

from argus.core.db import Database, PipelineTaskRepository
from argus.core.models import PipelineTask, PipelineTaskStatus, PipelineTaskType
from argus.orchestration.pipeline import PipelineBudget, PipelineOrchestrator


@pytest.fixture
async def test_db():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_priority_queue_execution(test_db: Database):
    """Higher priority (lower integer) tasks execute before lower priority tasks."""
    from argus.core.models import Investigation
    from argus.core.db import InvestigationRepository

    inv_repo = InvestigationRepository(test_db)
    inv = Investigation.create(name="Queue Test", target_name="Target")
    await inv_repo.create(inv)

    orchestrator = PipelineOrchestrator(test_db)
    executed_order: list[str] = []

    async def make_handler(name: str):
        async def handler(task: PipelineTask):
            executed_order.append(name)
            return {"result": name}
        return handler

    # Enqueue low priority task (priority 8)
    t_low = PipelineTask.create(
        investigation_id=inv.id,
        task_type=PipelineTaskType.COLLECT,
        priority=8,
    )
    # Enqueue high priority task (priority 1)
    t_high = PipelineTask.create(
        investigation_id=inv.id,
        task_type=PipelineTaskType.SEARCH,
        priority=1,
    )

    await orchestrator.enqueue(t_low, await make_handler("low"))
    await orchestrator.enqueue(t_high, await make_handler("high"))

    completed = await orchestrator.run_all()
    assert completed == 2
    assert executed_order == ["high", "low"]


@pytest.mark.asyncio
async def test_budget_enforcement(test_db: Database):
    """Tasks transition to BUDGET_EXCEEDED when resource limits are reached."""
    from argus.core.models import Investigation
    from argus.core.db import InvestigationRepository

    inv_repo = InvestigationRepository(test_db)
    inv = Investigation.create(name="Budget Test", target_name="Target")
    await inv_repo.create(inv)

    # Set HTTP budget to 1
    budget = PipelineBudget(max_http_requests=1)
    orchestrator = PipelineOrchestrator(test_db, budget=budget)

    async def dummy_handler(task: PipelineTask):
        return {"status": "ok"}

    t1 = PipelineTask.create(
        investigation_id=inv.id,
        task_type=PipelineTaskType.COLLECT,
        priority=1,
    )
    t2 = PipelineTask.create(
        investigation_id=inv.id,
        task_type=PipelineTaskType.COLLECT,
        priority=2,
    )

    await orchestrator.enqueue(t1, dummy_handler)
    await orchestrator.enqueue(t2, dummy_handler)

    res1 = await orchestrator.run_next()
    assert res1.status == PipelineTaskStatus.COMPLETED

    res2 = await orchestrator.run_next()
    assert res2.status == PipelineTaskStatus.BUDGET_EXCEEDED
    assert "budget exceeded" in res2.error_message
