from app.services.hybrid_memory_coordinator import HybridMemoryCoordinator


class _Memory:
    def get_recent_episodes(self, _session_id):
        return [
            {"role": "user", "content": "old " * 80},
            {"role": "assistant", "content": "recent " * 20},
        ]


def test_context_budget_keeps_only_prompted_sources(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "context_window_tokens", 100)
    monkeypatch.setattr(settings, "max_tokens", 20)
    monkeypatch.setattr(settings, "max_history_tokens", 20)
    monkeypatch.setattr(settings, "max_context_tokens", 30)
    chunks = [
        {"original_name": "one", "text": "alpha " * 40},
        {"original_name": "two", "text": "beta " * 40},
    ]

    messages, metrics = HybridMemoryCoordinator(_Memory(), "system rules").compile_working_memory(
        "session", "question", chunks
    )

    assert metrics["context_tokens_estimated"] <= 30
    assert len(chunks) <= 1
    assert "[S1:" in messages[-1]["content"]
