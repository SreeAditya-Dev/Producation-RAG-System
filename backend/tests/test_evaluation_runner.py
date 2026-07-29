from app.evaluation.runner import evaluate_retrieval


def test_runner_produces_per_query_diagnostics():
    report = evaluate_retrieval(
        [{"id": "q1", "relevant_chunk_ids": ["a", "b"]}], {"q1": ["a", "x", "b"]}, 3
    )
    assert report["recall_at_k"] == 1.0
    assert report["diagnostics"][0]["missing_relevant_chunk_ids"] == []
