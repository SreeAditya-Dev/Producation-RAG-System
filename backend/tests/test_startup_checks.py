import pytest
import asyncio
from app.services.startup_checks import run_async_startup_checks, health_tracker, _check_db, _check_s3_storage, _check_pinecone

@pytest.mark.asyncio
async def test_startup_checks_execution():
    results = await run_async_startup_checks()
    assert isinstance(results, dict)
    assert "database" in results
    assert "pinecone" in results
    assert "s3_storage" in results
    assert "embeddings" in results
    assert "llm" in results
    
    status = health_tracker.get_status()
    assert status["completed"] is True
    assert status["is_running"] is False
    assert isinstance(status["services"], dict)

def test_check_db_unit():
    db_res = _check_db()
    assert "status" in db_res
    assert "connected" in db_res
