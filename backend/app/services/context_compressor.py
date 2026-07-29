import logging
import re
from typing import List, Dict, Any
import tiktoken
from app.config import settings
from app.observability import traceable

logger = logging.getLogger(__name__)


class ContextCompressor:
    """
    Compresses retrieved text chunks to ensure the most relevant sentences
    reach the LLM context without exceeding token limits.
    """

    def __init__(self):
        try:
            self.encoder = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.encoder = None

    @traceable(name="context_compress", run_type="tool")
    def compress_chunks(
        self,
        chunks: List[Dict[str, Any]],
        queries: List[str],
        max_chunk_tokens: int = 256,
    ) -> List[Dict[str, Any]]:
        """
        Compresses each chunk in the list by selecting only sentences
        relevant to the search queries.
        """
        if not chunks:
            return []

        compressed_chunks = []
        for chunk in chunks:
            text = chunk.get("text", "")
            if not text:
                continue

            compressed_text = self._compress_text(text, queries, max_chunk_tokens)
            
            # Keep other metadata but update the text
            compressed_chunk = dict(chunk)
            compressed_chunk["text"] = compressed_text
            compressed_chunks.append(compressed_chunk)

        return compressed_chunks

    def _compress_text(self, text: str, queries: List[str], max_tokens: int) -> str:
        # If the text is short, return as-is
        tokens = self._count_tokens(text)
        if tokens <= max_tokens:
            return text

        # Split text into sentences
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if len(sentences) <= 1:
            return text

        # Clean query terms for simple keyword matching
        query_words = set()
        for q in queries:
            words = re.findall(r"\b\w{3,}\b", q.lower())
            query_words.update(words)

        scored_sentences = self._score_sentences(sentences, query_words)
        selected_sentences = self._select_sentences(scored_sentences, max_tokens)

        # Re-assemble in original order
        selected_sentences.sort(key=lambda x: x["index"])
        compressed = " ".join([s["text"] for s in selected_sentences])
        
        logger.debug("Compressed text: %d -> %d tokens", tokens, self._count_tokens(compressed))
        return compressed

    def _score_sentences(self, sentences: List[str], query_words: set) -> List[Dict[str, Any]]:
        scored = []
        for idx, sent in enumerate(sentences):
            sent_lower = sent.lower()
            # Score based on keyword overlap
            matches = sum(1 for w in query_words if w in sent_lower)
            
            # Position boost: earlier sentences in a paragraph often set context
            position_score = 0.1 / (idx + 1)
            
            score = matches + position_score
            scored.append({"text": sent, "score": score, "index": idx})
        return scored

    def _select_sentences(self, scored: List[Dict[str, Any]], max_tokens: int) -> List[Dict[str, Any]]:
        # Sort by score descending to pick the best sentences
        best_first = sorted(scored, key=lambda x: x["score"], reverse=True)
        
        selected = []
        current_tokens = 0
        
        # Always include the highest scoring sentence first
        for item in best_first:
            tokens = self._count_tokens(item["text"])
            # Ensure we don't exceed token limit, but always include at least one sentence
            if not selected or (current_tokens + tokens <= max_tokens):
                selected.append(item)
                current_tokens += tokens
                
            if current_tokens >= max_tokens:
                break
                
        return selected

    def _count_tokens(self, text: str) -> int:
        if self.encoder:
            return len(self.encoder.encode(text))
        # Fallback estimation if tiktoken fails
        return len(text.split())

    def count_tokens(self, text: str) -> int:
        return self._count_tokens(text)

    def truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        if max_tokens <= 0:
            return ""
        if self._count_tokens(text) <= max_tokens:
            return text
        if self.encoder:
            return self.encoder.decode(self.encoder.encode(text)[:max_tokens])
        return " ".join(text.split()[:max_tokens])


context_compressor = ContextCompressor()
