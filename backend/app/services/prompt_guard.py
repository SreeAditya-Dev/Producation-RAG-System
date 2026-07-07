import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore (all|any|the) (previous|prior|above) instructions",
        r"disregard (all|any|the) (previous|prior|above)",
        r"you are now (a|an|the)",
        r"new system prompt",
        r"reveal (your|the) (system prompt|instructions)",
        r"jailbreak",
        r"###\s*system",
        r"\bsystem\s*:\s*",
        r"do anything now",
        r"pretend (you|to) (are|be)",
        r"override (your|previous) (rules|instructions)",
    ]
]


def scan(text: str) -> List[str]:
    """Returns the injection-pattern regexes matched in `text`, if any."""
    if not text:
        return []
    return [pattern.pattern for pattern in _INJECTION_PATTERNS if pattern.search(text)]


def scan_question_and_context(question: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Scans the user question and retrieved context for common prompt-injection
    phrasing. This is detection/telemetry only — defense-in-depth alongside the
    hardened SYSTEM_PROMPT and the untrusted-data delimiters wrapped around
    context in HybridMemoryCoordinator. It logs and reports findings but does
    NOT block the query: heuristic pattern matching has a real false-positive
    rate, and legitimate documents can legitimately contain these phrases.
    """
    question_hits = scan(question)
    context_hits: Dict[int, List[str]] = {}
    for i, s in enumerate(sources):
        hits = scan(s.get("text", ""))
        if hits:
            context_hits[i] = hits

    flagged = bool(question_hits or context_hits)
    if flagged:
        logger.warning(
            "Prompt-injection heuristic flagged content — question_hits=%s context_chunk_hits=%s",
            question_hits, list(context_hits.keys()),
        )
    return {
        "flagged": flagged,
        "question_hits": question_hits,
        "context_hits": context_hits,
    }
