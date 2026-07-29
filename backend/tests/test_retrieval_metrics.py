import pytest

from app.evaluation.retrieval_metrics import average_precision_at_k, ndcg_at_k, recall_at_k


def test_recall_at_k_counts_unique_relevant_chunks():
    assert recall_at_k(["a", "a", "b"], {"a", "b"}, 3) == 1.0


def test_average_precision_at_k_penalizes_late_match():
    assert average_precision_at_k(["x", "a", "b"], {"a", "b"}, 3) == pytest.approx(7 / 12)


def test_ndcg_at_k_uses_graded_relevance():
    assert ndcg_at_k(["a", "b"], {"a": 3.0, "b": 1.0}, 2) == 1.0
