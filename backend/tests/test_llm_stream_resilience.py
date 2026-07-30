"""Streaming-generation failure modes for LLMService.stream_messages.

The hosted NVIDIA endpoint intermittently returns 200 headers and then sends no
body until the read timeout fires. These cover the two ways that can land: dead
air before the first token (retryable) and a break mid-answer (not retryable,
because the emitted tokens already reached the browser).
"""

import httpx
import pytest

from app.config import settings
from app.services.llm_service import LLMService


class _FakeChoiceDelta:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.delta = _FakeChoiceDelta(content)


class _FakeUsage:
    prompt_tokens = 11
    completion_tokens = 3


class _FakeChunk:
    def __init__(self, content=None, usage=None):
        self.choices = [_FakeChoice(content)] if content is not None else []
        self.usage = usage


def _tokens(*contents):
    return [_FakeChunk(content=c) for c in contents]


class _ScriptedCompletions:
    """Replays one scripted outcome per create() call.

    An outcome is either an exception (raised when the stream is consumed, after
    any tokens preceding it) or a list of chunks.
    """

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = 0
        self.timeouts = []

    def create(self, **kwargs):
        self.calls += 1
        self.timeouts.append(kwargs.get("timeout"))
        outcome = self._outcomes.pop(0)

        def _generate():
            for item in outcome:
                if isinstance(item, Exception):
                    raise item
                yield item

        return _generate()


def _service(outcomes):
    service = LLMService.__new__(LLMService)
    service.model = "test-model"
    completions = _ScriptedCompletions(outcomes)
    service.client = type(
        "_Client", (), {"chat": type("_Chat", (), {"completions": completions})()}
    )()
    return service, completions


def test_stall_before_first_token_is_retried():
    stall = httpx.ReadTimeout("The read operation timed out")
    service, completions = _service([
        [stall],
        _tokens("Grounded ", "answer [S1].") + [_FakeChunk(usage=_FakeUsage())],
    ])

    received = []
    usage = service.stream_messages([{"role": "user", "content": "q"}], received.append)

    assert completions.calls == 2
    assert "".join(received) == "Grounded answer [S1]."
    assert usage["stream_completed"] == 1
    assert usage["prompt_tokens"] == 11


def test_break_after_tokens_keeps_partial_answer_and_flags_it():
    service, completions = _service([
        _tokens("Grounded ", "partial") + [httpx.ReadTimeout("The read operation timed out")],
    ])

    received = []
    usage = service.stream_messages([{"role": "user", "content": "q"}], received.append)

    # No retry: re-running would duplicate tokens the caller already forwarded.
    assert completions.calls == 1
    assert "".join(received) == "Grounded partial"
    assert usage["stream_completed"] == 0


def test_every_attempt_stalling_still_raises():
    service, completions = _service([
        [httpx.ReadTimeout("The read operation timed out")]
        for _ in range(settings.llm_stream_max_attempts)
    ])

    with pytest.raises(httpx.ReadTimeout):
        service.stream_messages([{"role": "user", "content": "q"}], lambda _t: None)

    assert completions.calls == settings.llm_stream_max_attempts


def test_stream_requests_carry_an_explicit_gap_budget():
    service, completions = _service([_tokens("ok [S1].")])

    service.stream_messages([{"role": "user", "content": "q"}], lambda _t: None)

    timeout = completions.timeouts[0]
    assert isinstance(timeout, httpx.Timeout)
    assert timeout.read == settings.llm_stream_timeout_seconds
