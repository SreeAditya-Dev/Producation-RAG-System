from app.services.query_cache import QueryCache


def test_term_similarity_is_bounded_and_scope_validation_rejects_wrong_document():
    assert QueryCache._similarity("annual revenue", "annual revenue report") > 0
    assert not QueryCache._sources_match_scope([{"doc_id": "other"}], ["allowed"])
    assert QueryCache._sources_match_scope([{"doc_id": "allowed"}], ["allowed"])
