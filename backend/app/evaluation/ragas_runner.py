"""Optional offline RAGAS adapter. It is never imported by the request path."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
from app.config import settings


def evaluate_rows(rows: List[Dict[str, Any]], output_path: Optional[Path] = None) -> Dict[str, Any]:
    """Run RAGAS only when its optional dependency is installed.

    Each row needs ``question``, ``answer``, ``contexts`` and, where available,
    ``ground_truth``. Keeping this boundary lazy avoids making production serving
    depend on evaluator-provider credentials.
    """
    try:
        from datasets import Dataset
        from ragas import evaluate, __version__ as ragas_version
        from ragas.metrics import answer_relevancy, context_precision, context_recall, faithfulness
    except ImportError as exc:
        raise RuntimeError("Install the optional RAGAS evaluation dependencies to run this command.") from exc

    metadata: Dict[str, Any] = {
        "completed": False, "row_count": len(rows), "created_at": datetime.now(timezone.utc).isoformat(),
        "evaluator": {
            "framework": "ragas", "version": ragas_version, "model": settings.evaluator_model or settings.llm_model,
            "temperature": 0, "timeout_seconds": settings.evaluator_timeout_seconds,
            "max_retries": settings.evaluator_max_retries,
        }, "failures": [],
    }
    try:
        dataset = Dataset.from_list(rows)
        result = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_precision, context_recall])
        metadata.update({"completed": True, "scores": result.to_pandas().to_dict(orient="records")})
    except Exception as exc:
        # Evaluator outages must be visible, never converted into a successful
        # quality score. The offline caller can decide whether to fail CI.
        metadata["failures"].append({"type": type(exc).__name__, "message": str(exc)})
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
