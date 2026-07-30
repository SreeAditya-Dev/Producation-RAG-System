import logging
import re
from typing import Any, Dict, List, NamedTuple

logger = logging.getLogger(__name__)


class PromptPolicyBlockedError(ValueError):
    """Raised when a user question is an explicit instruction-override attempt."""


class _Rule(NamedTuple):
    """An injection heuristic and how confident we are that it is an attack.

    `severe` rules block the request outright; the rest are sanitized in place so
    legitimate questions that merely *discuss* prompt injection stay answerable.
    Severity is declared per rule rather than inferred from the regex source —
    inferring it meant "ignore all previous instructions" was blocked while
    "disregard all previous instructions" was only sanitized, so which branch an
    identical attack took came down to the attacker's choice of synonym.
    """

    pattern: re.Pattern
    severe: bool


def _rule(source: str, *, severe: bool) -> _Rule:
    return _Rule(re.compile(source, re.IGNORECASE), severe)


# Override verbs are enumerated rather than anchored on "ignore" alone: a single
# unlisted synonym walks the whole gate, which is how
# "SYSTEM OVERRIDE: Forget previous instructions" previously scored zero hits.
_OVERRIDE_VERBS = r"(?:ignore|disregard|forget|discard|drop|skip|bypass|override|violate)"
_OVERRIDE_QUALIFIERS = r"(?:\s+(?:all|any|the|your|every|previous|prior|above|earlier|preceding|initial|original|system|foregoing))*"
_OVERRIDE_TARGETS = r"(?:instructions?|prompts?|rules?|directives?|guidelines?|constraints?|restrictions?|policies|training)"

_EXFIL_VERBS = r"(?:print|show|reveal|display|output|dump|list|give|send|leak|expose|repeat)"
_EXFIL_TARGETS = r"(?:credentials?|passwords?|secrets?|api[\s_-]?keys?|access[\s_-]?tokens?|connection[\s_-]?strings?|env(?:ironment)?[\s_-]?(?:vars?|variables?)|\.env)"

_INJECTION_RULES: List[_Rule] = [
    # ── Severe: unambiguous attempts to displace the operating instructions ──
    _rule(rf"{_OVERRIDE_VERBS}{_OVERRIDE_QUALIFIERS}\s+{_OVERRIDE_TARGETS}", severe=True),
    _rule(r"ignore (?:(?:all|any|the) )?(?:previous|prior|above)", severe=True),
    _rule(r"disregard (?:(?:all|any|the) )?(?:previous|prior|above)", severe=True),
    _rule(r"forget (?:(?:all|any|the|what) )?(?:previous|prior|above|you were told|i told you)", severe=True),
    # Fake framing markers. A question has no legitimate reason to open a system
    # turn; documents that quote one are handled by quarantine_context instead.
    _rule(r"system\s*(?:override|overide|prompt\s*override)", severe=True),
    _rule(r"###\s*system", severe=True),
    _rule(r"\[\s*(?:system|inst)\s*\]", severe=True),
    _rule(r"<\s*\|?\s*(?:im_start|system)\s*\|?\s*>", severe=True),
    _rule(r"reveal (?:your|the) (?:system prompt|instructions)", severe=True),
    _rule(r"jailbreak", severe=True),
    _rule(r"do anything now", severe=True),
    _rule(r"developer mode", severe=True),

    # ── Soft: real attacks phrase themselves this way, but so do real questions
    # ("explain what a new system prompt means"), so strip the span and continue.
    _rule(r"\bsystem\s*:\s*", severe=False),
    _rule(r"new system prompt", severe=False),
    _rule(r"you are now (?:a|an|the)", severe=False),
    _rule(r"pretend (?:you|to) (?:are|be)", severe=False),
    _rule(r"act as (?:if you|though|a|an|the)", severe=False),
    # Credential fishing. Kept soft on purpose: a corpus of security docs makes
    # "what does a connection string look like" a legitimate question, so this
    # requires a totalizing/possessive qualifier and then only redacts + flags.
    _rule(rf"{_EXFIL_VERBS}\s+(?:me\s+)?(?:all|your|every|the\s+system'?s?)\s+(?:\w+\s+){{0,2}}{_EXFIL_TARGETS}", severe=False),
]


def scan(text: str) -> List[str]:
    """Returns the injection-pattern regexes matched in `text`, if any."""
    if not text:
        return []
    return [rule.pattern.pattern for rule in _INJECTION_RULES if rule.pattern.search(text)]


def screen_question(text: str) -> Dict[str, Any]:
    """Return a policy decision before untrusted input reaches an LLM.

    Heuristics intentionally block only strong prompt-override attempts. Less
    certain matches are retained after removing the matched instruction span so
    legitimate questions about prompt injection remain answerable.
    """
    if not text:
        return {"action": "allow", "text": text, "hits": []}

    matched = [rule for rule in _INJECTION_RULES if rule.pattern.search(text)]
    if not matched:
        return {"action": "allow", "text": text, "hits": []}

    hits = [rule.pattern.pattern for rule in matched]
    if any(rule.severe for rule in matched):
        return {"action": "block", "text": "", "hits": hits}

    sanitized = text
    for rule in _INJECTION_RULES:
        sanitized = rule.pattern.sub("[removed instruction-like text]", sanitized)
    return {"action": "sanitize", "text": sanitized.strip(), "hits": hits}


def quarantine_context(sources: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], Dict[int, List[str]]]:
    """Remove only instruction-like spans from retrieved content, preserving metadata."""
    cleaned: List[Dict[str, Any]] = []
    quarantined: Dict[int, List[str]] = {}
    for index, source in enumerate(sources):
        item = dict(source)
        text = item.get("text", "")
        hits = scan(text)
        if hits:
            for rule in _INJECTION_RULES:
                text = rule.pattern.sub("[quarantined instruction-like text]", text)
            item["text"] = text
            quarantined[index] = hits
        cleaned.append(item)
    return cleaned, quarantined


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
