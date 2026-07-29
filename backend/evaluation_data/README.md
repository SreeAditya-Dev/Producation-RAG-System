# RAG benchmark fixtures

`rag_benchmark.v1.json` is versioned deliberately. Each human-reviewed example must contain `id`, `question`, `allowed_doc_ids`, and either `relevant_chunk_ids` or `graded_relevance`. Add `reference_answer` only when it has been reviewed. Include query-type, language, and domain tags.

Run deterministic metrics with `python -m app.evaluation.runner --fixture evaluation_data/rag_benchmark.v1.json --rankings rankings.json`. The artifact includes per-query diagnostics and is safe to retain in CI.
