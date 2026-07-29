"""Optional PII minimisation for prompts, cache payloads, and exported telemetry.

This never mutates vector-store or document records; it applies only to copies
leaving the request boundary.
"""

from __future__ import annotations

import re

_EMAIL = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
_CARD = re.compile(r"\b(?:\d[ -]*?){13,16}\b")


def redact(text: str) -> str:
    text = _EMAIL.sub("[REDACTED_EMAIL]", text)
    text = _PHONE.sub("[REDACTED_PHONE]", text)
    return _CARD.sub("[REDACTED_NUMBER]", text)
