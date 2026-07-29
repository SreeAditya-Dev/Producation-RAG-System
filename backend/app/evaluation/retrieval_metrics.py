"""Deterministic information-retrieval metrics for labeled RAG fixtures."""

from __future__ import annotations

import math
from typing import Iterable, Mapping, Sequence


def recall_at_k(retrieved_ids: Sequence[str], relevant_ids: Iterable[str], k: int) -> float:
    relevant = set(relevant_ids)
    if not relevant or k <= 0:
        return 0.0
    return len(set(retrieved_ids[:k]) & relevant) / len(relevant)


def average_precision_at_k(retrieved_ids: Sequence[str], relevant_ids: Iterable[str], k: int) -> float:
    relevant = set(relevant_ids)
    if not relevant or k <= 0:
        return 0.0
    hits = 0
    precision_sum = 0.0
    seen = set()
    for rank, item_id in enumerate(retrieved_ids[:k], start=1):
        if item_id in relevant and item_id not in seen:
            hits += 1
            precision_sum += hits / rank
        seen.add(item_id)
    return precision_sum / min(len(relevant), k)


def mean_average_precision_at_k(
    rankings: Sequence[Sequence[str]], relevance_sets: Sequence[Iterable[str]], k: int
) -> float:
    if not rankings:
        return 0.0
    return sum(average_precision_at_k(ids, relevant, k) for ids, relevant in zip(rankings, relevance_sets)) / len(rankings)


def ndcg_at_k(retrieved_ids: Sequence[str], relevance: Mapping[str, float], k: int) -> float:
    if k <= 0 or not relevance:
        return 0.0
    dcg = sum(
        (2 ** float(relevance.get(item_id, 0.0)) - 1) / math.log2(rank + 1)
        for rank, item_id in enumerate(retrieved_ids[:k], start=1)
    )
    ideal = sorted(relevance.values(), reverse=True)[:k]
    idcg = sum((2 ** score - 1) / math.log2(rank + 1) for rank, score in enumerate(ideal, start=1))
    return dcg / idcg if idcg else 0.0
