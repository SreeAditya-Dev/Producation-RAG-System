"""Offline retrieval benchmark CLI; intentionally independent of serving traffic."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

from app.evaluation.retrieval_metrics import average_precision_at_k, ndcg_at_k, recall_at_k


def _labels(example: Dict[str, Any]) -> Dict[str, float]:
    graded = example.get("graded_relevance") or {}
    if graded:
        return {str(key): float(value) for key, value in graded.items()}
    return {str(chunk_id): 1.0 for chunk_id in example.get("relevant_chunk_ids", [])}


def evaluate_retrieval(examples: Iterable[Dict[str, Any]], rankings: Dict[str, List[str]], k: int) -> Dict[str, Any]:
    diagnostics = []
    for example in examples:
        labels = _labels(example)
        retrieved = rankings.get(example["id"], [])
        diagnostics.append({
            "id": example["id"], "retrieved_chunk_ids": retrieved[:k], "relevant_chunk_ids": sorted(labels),
            "recall_at_k": recall_at_k(retrieved, labels, k),
            "average_precision_at_k": average_precision_at_k(retrieved, labels, k),
            "ndcg_at_k": ndcg_at_k(retrieved, labels, k),
            "missing_relevant_chunk_ids": sorted(set(labels) - set(retrieved[:k])),
        })
    count = len(diagnostics)
    return {
        "k": k, "query_count": count,
        "recall_at_k": sum(row["recall_at_k"] for row in diagnostics) / count if count else 0.0,
        "map_at_k": sum(row["average_precision_at_k"] for row in diagnostics) / count if count else 0.0,
        "ndcg_at_k": sum(row["ndcg_at_k"] for row in diagnostics) / count if count else 0.0,
        "diagnostics": diagnostics,
    }


def run_fixture(fixture_path: Path, rankings_path: Path, output_dir: Path, k: int) -> Path:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    rankings = json.loads(rankings_path.read_text(encoding="utf-8"))
    report = evaluate_retrieval(fixture.get("examples", []), rankings, k)
    report.update({
        "dataset_version": fixture.get("version", "unknown"),
        "dataset_path": str(fixture_path), "created_at": datetime.now(timezone.utc).isoformat(),
        "configuration": {"k": k}, "failures": [],
    })
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact = output_dir / f"retrieval-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    artifact.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate labeled RAG retrieval rankings")
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--rankings", type=Path, required=True, help="JSON object: fixture id -> ordered chunk IDs")
    parser.add_argument("--output-dir", type=Path, default=Path("evaluation_artifacts"))
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    print(run_fixture(args.fixture, args.rankings, args.output_dir, args.k))


if __name__ == "__main__":
    main()
