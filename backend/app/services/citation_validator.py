"""Machine-readable source citation validation and bounded repair helpers."""

from __future__ import annotations

import re
from typing import Any, Dict, List

# A citation token, in any shape a model actually writes it: "[S1]", "[S 1]",
# "[S1, S2]", "[S1: guide.md]". Only the part before an optional ": label" is
# parsed for indices, so a filename containing "S3" cannot invent a citation.
#
# Being liberal here is a parser fix, not a weakening of the grounding check: the
# model still had to point at a specific source. Insisting on one exact spelling
# meant a correct, sourced answer was discarded whenever the model varied the
# punctuation.
CITATION_BLOCK_RE = re.compile(r"\[\s*(S\s*\d[^\]:]*)(?::[^\]]*)?\]", re.IGNORECASE)
CITATION_INDEX_RE = re.compile(r"S\s*(\d+)", re.IGNORECASE)
# Near-misses that were plainly meant as citations but carry no usable index
# ("[S]", "[S: guide.md]"). The first lookahead excludes anything CITATION_BLOCK_RE
# already accepts — including spaced "[S 1]" — so a token can never be counted as
# both a citation and malformed. The second keeps ordinary bracketed prose that
# happens to start with S ("[SQL]", "[Section 4]") out of this entirely.
MALFORMED_RE = re.compile(r"\[\s*S(?!\s*\d)(?![A-Za-z0-9])[^\]]*\]", re.IGNORECASE)

# Retained for callers that import it; prefer CITATION_BLOCK_RE.
SOURCE_RE = re.compile(r"\[S(\d+)\]")


def has_material_claims(answer: str) -> bool:
    """A conservative, deterministic signal for answers that require sources."""
    return bool(re.search(r"[A-Za-z0-9]", answer)) and not answer.lower().startswith(
        ("i don't have enough", "insufficient evidence", "i cannot determine")
    )


def validate(answer: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    cited = [
        int(index)
        for block in CITATION_BLOCK_RE.findall(answer)
        for index in CITATION_INDEX_RE.findall(block)
    ]
    malformed = MALFORMED_RE.findall(answer)
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
