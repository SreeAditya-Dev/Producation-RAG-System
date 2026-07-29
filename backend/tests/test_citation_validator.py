from app.services.citation_validator import insufficient_evidence_answer, validate


def test_citations_require_a_source_for_material_answer():
    assert not validate("The answer is 42.", [{"text": "42"}])["valid"]
    assert not validate("The answer is 42.", [])["valid"]


def test_citations_reject_malformed_or_out_of_range_source_ids():
    assert not validate("The answer is 42 [S2]", [{"text": "42"}])["valid"]
    assert not validate("The answer is 42 [Sx]", [{"text": "42"}])["valid"]


def test_insufficient_evidence_has_valid_source_contract():
    sources = [{"text": "evidence"}, {"text": "more evidence"}]
    assert validate(insufficient_evidence_answer(sources), sources)["valid"]
