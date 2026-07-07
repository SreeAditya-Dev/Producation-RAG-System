from app.services.bm25_service import _BM25Index, _tokenize


def test_tokenize_lowercases_and_splits_on_punctuation():
    tokens = _tokenize("Revenue: $45,231,908.12 (Q4 2025)")
    assert "45" in tokens
    assert "231" in tokens
    assert "908" in tokens
    assert "12" in tokens
    assert "revenue" in tokens


def test_exact_number_ranks_above_semantically_similar_noise():
    index = _BM25Index()
    index.build([
        ("doc1-chunk-0", "The total quarterly revenue was 45231908 dollars for Q4 2025."),
        ("doc1-chunk-1", "Our marketing strategy focuses on customer retention and growth."),
        ("doc1-chunk-2", "Revenue figures for Q3 were much lower than Q4 due to seasonality."),
    ])
    results = index.search("what was the total revenue 45231908", top_k=3)
    assert results
    assert results[0][0] == "doc1-chunk-0"


def test_empty_corpus_returns_no_results():
    index = _BM25Index()
    index.build([])
    assert index.search("anything", top_k=5) == []


def test_query_with_no_matching_terms_returns_empty():
    index = _BM25Index()
    index.build([("doc1-chunk-0", "apples and oranges")])
    assert index.search("xyzzy nonexistent term", top_k=5) == []
