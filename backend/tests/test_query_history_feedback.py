"""`/api/queries` must replay the caller's own rating with each row.

Without it the UI has no way to know an answer was already voted on, so a reload
re-offers the buttons on a rated answer.
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, QueryFeedback, QueryHistory, get_db
from app.main import app

CLIENT_A = "client-a"
CLIENT_B = "client-b"


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    db.add(QueryHistory(
        id="query-1", session_id="sess-1", client_id=CLIENT_A,
        question="What is the answer?", answer="Grounded [S1].", sources_json="[]",
        processing_time=1.0, status="success", created_at=datetime(2026, 7, 31, 0, 0, 0),
    ))
    db.add(QueryHistory(
        id="query-2", session_id="sess-1", client_id=CLIENT_A,
        question="And this one?", answer="Also grounded [S1].", sources_json="[]",
        processing_time=1.0, status="success", created_at=datetime(2026, 7, 31, 0, 0, 1),
    ))
    db.add(QueryFeedback(
        query_id="query-1", client_id=CLIENT_A, rating="down", reason="incomplete", correction=None,
    ))
    db.commit()

    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        db.close()


def _headers(client_id):
    return {"X-API-Key": settings.api_key, "X-Client-Id": client_id}


def _by_id(payload):
    return {q["query_id"]: q for q in payload["queries"]}


def test_history_replays_the_callers_own_rating(client):
    rows = _by_id(client.get("/api/queries", headers=_headers(CLIENT_A)).json())

    assert rows["query-1"]["feedback_rating"] == "down"
    assert rows["query-1"]["feedback_reason"] == "incomplete"


def test_unrated_answers_report_no_rating(client):
    rows = _by_id(client.get("/api/queries", headers=_headers(CLIENT_A)).json())

    assert rows["query-2"]["feedback_rating"] is None
    assert rows["query-2"]["feedback_reason"] is None


def test_one_clients_rating_is_not_shown_to_another(client):
    rows = _by_id(client.get("/api/queries", headers=_headers(CLIENT_B)).json())

    assert rows["query-1"]["feedback_rating"] is None
