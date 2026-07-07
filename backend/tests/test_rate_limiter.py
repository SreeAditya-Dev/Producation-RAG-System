from app.services.rate_limiter import RateLimiter
from app.config import settings


def test_allows_requests_under_the_limit(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 3)
    limiter = RateLimiter()
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True


def test_blocks_requests_over_the_limit(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    limiter = RateLimiter()
    assert limiter.allow("client-b") is True
    assert limiter.allow("client-b") is True
    assert limiter.allow("client-b") is False


def test_limit_is_scoped_per_identity(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1)
    limiter = RateLimiter()
    assert limiter.allow("client-c") is True
    assert limiter.allow("client-c") is False
    # A different identity has its own independent budget.
    assert limiter.allow("client-d") is True


def test_disabled_when_limit_is_zero_or_negative(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    limiter = RateLimiter()
    assert all(limiter.allow("client-e") for _ in range(50))
