"""Machine-readable source citation validation and bounded repair helpers."""

from __future__ import annotations

import re
from typing import Any, Dict, List

SOURCE_RE = re.compile(r"\[S(\d+)\]")
MALFORMED_RE = re.compile(r"\[S([^\]]*)\]")


def has_material_claims(answer: str) -> bool:
    """A conservative, deterministic signal for answers that require sources."""
    return bool(re.search(r"[A-Za-z0-9]", answer)) and not answer.lower().startswith(
        ("i don't have enough", "insufficient evidence", "i cannot determine")
    )


def validate(answer: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    cited = [int(value) for value in SOURCE_RE.findall(answer)]
    malformed = [value for value in MALFORMED_RE.findall(answer) if not value.isdigit()]
    invalid = sorted({index for index in cited if index < 1 or index > len(sources)})
    # A material claim is unsafe even when retrieval returned no sources. This
    # forces the caller onto repair or the transparent insufficient-evidence
    # response instead of allowing an uncited hallucination through.
    needs_citation = has_material_claims(answer)
    return {
        "cited_source_count": len(set(cited)),
        "invalid_citations": invalid,
        "malformed_citations": malformed,
        "has_material_claims": needs_citation,
        "valid": not invalid and not malformed and (not needs_citation or bool(cited)),
    }


def insufficient_evidence_answer(sources: List[Dict[str, Any]]) -> str:
    citations = " ".join(f"[S{i}]" for i in range(1, len(sources) + 1))
    suffix = f" Available retrieved sources: {citations}" if citations else ""
    return "I don't have enough grounded evidence in the retrieved sources to answer reliably." + suffix
