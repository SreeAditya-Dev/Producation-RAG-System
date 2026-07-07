import pytest
from fastapi import HTTPException

from app.auth import require_api_key, verify_ws_key
from app.config import settings


def test_require_api_key_fails_closed_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "")
    with pytest.raises(HTTPException) as exc:
        require_api_key(x_api_key="anything")
    assert exc.value.status_code == 503


def test_require_api_key_rejects_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "secret123")
    with pytest.raises(HTTPException) as exc:
        require_api_key(x_api_key=None)
    assert exc.value.status_code == 401


def test_require_api_key_rejects_wrong_key(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "secret123")
    with pytest.raises(HTTPException) as exc:
        require_api_key(x_api_key="wrong")
    assert exc.value.status_code == 401


def test_require_api_key_accepts_correct_key(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "secret123")
    assert require_api_key(x_api_key="secret123") == "secret123"


def test_verify_ws_key_rejects_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "")
    assert verify_ws_key("anything") is False


def test_verify_ws_key_rejects_missing_token(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "secret123")
    assert verify_ws_key(None) is False


def test_verify_ws_key_accepts_correct_token(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "secret123")
    assert verify_ws_key("secret123") is True
