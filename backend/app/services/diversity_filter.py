import numpy as np
from typing import List, Dict, Any


class MaximalMarginalRelevanceFilter:
    """
    Maximal Marginal Relevance (MMR) filter to ensure diversity & coverage
    among retrieved text chunks, preventing information redundancy.
    """

    def __init__(self, lambda_mult: float = 0.5):
        self.lambda_mult = lambda_mult

    def filter_candidates(
        self,
        query_vector: List[float] | None,
        candidates: List[Dict[str, Any]],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """
        Selects top_k chunks from candidates using MMR.
        Candidates need a ``values`` embedding vector. When a query vector is not
        available (for example after multi-query reranking), rerank score is used
        for relevance and vectors are still used to penalize duplicates.
        """
        if len(candidates) <= top_k:
            return candidates

        # Filter candidates with valid vectors
        valid_candidates = []
        candidate_vectors = []
        for c in candidates:
            if c.get("values") is not None:
                valid_candidates.append(c)
                candidate_vectors.append(c["values"])

        # Fallback to simple slice if vectors are missing
        if not candidate_vectors:
            return candidates[:top_k]

        selected_indices = self._run_mmr(
            query_vector,
            candidate_vectors,
            [c.get("rerank_score", c.get("score", 0.0)) for c in valid_candidates],
            top_k,
        )

        selected = [valid_candidates[idx] for idx in selected_indices]
        # Lexical-only BM25 candidates have no vector to diversify against. Keep
        # them as a fallback instead of silently removing that recall path.
        for candidate in candidates:
            if candidate.get("values") is None and len(selected) < top_k:
                selected.append(candidate)
        return selected

    def _run_mmr(
        self,
        query_vector: List[float] | None,
        candidate_vectors: List[List[float]],
        relevance_scores: List[float],
        top_k: int,
    ) -> List[int]:
        selected_indices: List[int] = []
        candidate_indices = list(range(len(candidate_vectors)))

        # Precompute similarities of all candidates to the query vector
        sims_to_query = [
            self._cosine_similarity(query_vector, vec)
            if query_vector is not None else float(valid_score)
            for vec, valid_score in zip(candidate_vectors, relevance_scores)
        ]

        # Select the single most relevant chunk to start
        first_choice = int(np.argmax(sims_to_query))
        selected_indices.append(first_choice)
        candidate_indices.remove(first_choice)

        # Iteratively select chunks balancing query similarity vs diversity
        while len(selected_indices) < top_k and candidate_indices:
            best_idx = self._find_next_best(
                selected_indices,
                candidate_indices,
                candidate_vectors,
                sims_to_query,
            )
            if best_idx == -1:
                break
            selected_indices.append(best_idx)
            candidate_indices.remove(best_idx)

        return selected_indices

    def _find_next_best(
        self,
        selected_indices: List[int],
        candidate_indices: List[int],
        candidate_vectors: List[List[float]],
        sims_to_query: List[float],
    ) -> int:
        best_score = -float("inf")
        best_idx = -1

        for cand_idx in candidate_indices:
            sim_to_query = sims_to_query[cand_idx]
            
            # Max similarity of candidate to any already selected chunk
            sim_to_selected = max(
                self._cosine_similarity(
                    candidate_vectors[cand_idx],
                    candidate_vectors[sel_idx],
                )
                for sel_idx in selected_indices
            )

            # MMR formula
            mmr_score = (
                self.lambda_mult * sim_to_query -
                (1.0 - self.lambda_mult) * sim_to_selected
            )

            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = cand_idx

        return best_idx

    @staticmethod
    def _cosine_similarity(v1: List[float], v2: List[float]) -> float:
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))
