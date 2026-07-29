from app.services.diversity_filter import MaximalMarginalRelevanceFilter


def test_mmr_keeps_the_best_relevant_vector_then_diversifies():
    candidates = [
        {"id": "a", "rerank_score": 1.0, "values": [1.0, 0.0]},
        {"id": "b", "rerank_score": 0.9, "values": [0.99, 0.01]},
        {"id": "c", "rerank_score": 0.8, "values": [0.0, 1.0]},
    ]

    result = MaximalMarginalRelevanceFilter(lambda_mult=0.5).filter_candidates(None, candidates, 2)

    assert [item["id"] for item in result] == ["a", "c"]


def test_mmr_preserves_lexical_only_candidates_as_fallback():
    candidates = [
        {"id": "dense", "rerank_score": 1.0, "values": [1.0, 0.0]},
        {"id": "bm25", "rerank_score": 0.8},
    ]

    result = MaximalMarginalRelevanceFilter().filter_candidates(None, candidates, 2)

    assert [item["id"] for item in result] == ["dense", "bm25"]
