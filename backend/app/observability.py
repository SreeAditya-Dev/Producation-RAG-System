"""
LangSmith tracing for the RAG pipeline. Disabled (safe no-op) unless both
`langsmith_tracing_enabled` and `langsmith_api_key` are set in the environment —
so the app runs identically with or without LangSmith configured.

When enabled, every ingestion and query pipeline run appears in LangSmith as a
single nested trace tree: embed -> retrieve (dense + BM25) -> rerank -> compress
-> generate, with per-stage latency and token usage.
"""
import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)

ENABLED = bool(settings.langsmith_tracing and settings.langsmith_api_key)

if ENABLED:
    # Native LangSmith SDK env vars (v0.6+)
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
    os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint
    # Legacy LangChain-prefixed aliases some SDK versions/integrations still read
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key
    os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project
    os.environ["LANGCHAIN_ENDPOINT"] = settings.langsmith_endpoint

_traceable = None
_wrap_openai = None

if ENABLED:
    try:
        from langsmith import traceable as _traceable
        from langsmith.wrappers import wrap_openai as _wrap_openai
        logger.info("LangSmith tracing enabled — project '%s'", settings.langsmith_project)
    except Exception as exc:  # pragma: no cover - langsmith not installed
        logger.warning("LangSmith tracing requested but unavailable (%s) — running untraced", exc)


def traceable(*t_args, **t_kwargs):
    """Drop-in replacement for langsmith.traceable that no-ops when tracing is off."""
    if ENABLED and _traceable is not None:
        return _traceable(*t_args, **t_kwargs)

    # Support both @traceable and @traceable(name=..., run_type=...) usage
    if t_args and callable(t_args[0]) and not t_kwargs:
        return t_args[0]

    def _identity(fn):
        return fn

    return _identity


def wrap_openai(client):
    """Wrap an OpenAI client for automatic per-call LangSmith tracing, if enabled."""
    if ENABLED and _wrap_openai is not None:
        try:
            return _wrap_openai(client)
        except Exception as exc:
            logger.warning("LangSmith wrap_openai failed, using unwrapped client: %s", exc)
    return client


def is_enabled() -> bool:
    return ENABLED and _traceable is not None
