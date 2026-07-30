"""Citation shapes a model actually writes must not cost it the answer.

A correct, well-sourced answer about the capital of France was discarded in
production because the model cited `[S1: Paris - Wikipedia]` — mirroring the
label format the context block showed it — and the validator scored anything but
a bare `[S1]` as malformed.
"""

import pytest

from app.services.citation_validator import validate
from app.services.hybrid_memory_coordinator import source_prefix

SOURCES = [{"text": "a"}, {"text": "b"}, {"text": "c"}]


@pytest.mark.parametrize("answer", [
    "The capital of France is Paris [S1].",
    "The capital of France is Paris [S 1].",
    "The capital of France is Paris [S1: Paris - Wikipedia].",
    "The capital of France is Paris [S1, S2].",
    "The capital of France is Paris [S1][S2].",
    "Paris [S1] is the capital [S2: Council of Europe].",
])
def test_real_citation_shapes_are_accepted(answer):
    assert validate(answer, SOURCES)["valid"] is True


def test_comma_group_counts_every_source():
    assert validate("Paris [S1, S2, S3].", SOURCES)["cited_source_count"] == 3


def test_label_after_colon_cannot_invent_a_citation():
    # "S3" inside the filename must not be read as a third citation.
    result = validate("Paris [S1: notes on S3 joins].", SOURCES)
    assert result["cited_source_count"] == 1
    assert result["invalid_citations"] == []


def test_out_of_range_index_is_still_invalid():
    result = validate("Paris [S9].", SOURCES)
    assert result["valid"] is False
    assert result["invalid_citations"] == [9]


@pytest.mark.parametrize("answer", [
    "The capital city of France is Paris.",
    "According to Source 1, the capital of France is Paris.",
])
def test_uncited_material_claims_still_fail(answer):
    assert validate(answer, SOURCES)["valid"] is False


@pytest.mark.parametrize("answer", [
    "Use [SQL] syntax here [S1].",
    "See [Section 4] for details [S1].",
])
def test_ordinary_bracketed_prose_is_not_a_malformed_citation(answer):
    result = validate(answer, SOURCES)
    assert result["malformed_citations"] == []
    assert result["valid"] is True


@pytest.mark.parametrize("answer", ["Paris [S].", "Paris [S: guide.md]."])
def test_indexless_citation_attempts_are_malformed(answer):
    assert validate(answer, SOURCES)["valid"] is False


def test_context_label_is_exactly_what_the_validator_accepts():
    """The prompt must not show the model a shape the validator rejects."""
    prefix = source_prefix(1, "Paris - Wikipedia")
    assert prefix.startswith("[S1]")
    # The filename sits outside the brackets, so the only bracketed token in the
    # prompt is the citation form itself.
    assert validate(f"Paris {prefix.split(chr(10))[0].split(' (')[0]}.", SOURCES)["valid"] is True
    assert "Wikipedia]" not in prefix
