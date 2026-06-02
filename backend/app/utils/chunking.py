from typing import List
import re


class RecursiveTextSplitter:
    """Recursive character text splitter that respects sentence/paragraph boundaries."""

    SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""]

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split(self, text: str) -> List[str]:
        text = self._clean(text)
        if not text:
            return []

        chunks = self._split_recursive(text, self.SEPARATORS)
        chunks = self._merge_small_chunks(chunks)
        return [c for c in chunks if c.strip()]

    def _clean(self, text: str) -> str:
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)
        return text.strip()

    def _split_recursive(self, text: str, separators: List[str]) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]

        separator = ""
        new_separators = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = sep
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1 :]
                break

        if separator:
            splits = text.split(separator)
        else:
            splits = list(text)

        chunks: List[str] = []
        current: List[str] = []
        current_len = 0

        for split in splits:
            split_len = len(split)

            if current_len + split_len + len(separator) > self.chunk_size and current:
                chunk_text = separator.join(current)
                if chunk_text.strip():
                    if len(chunk_text) > self.chunk_size and new_separators:
                        chunks.extend(self._split_recursive(chunk_text, new_separators))
                    else:
                        chunks.append(chunk_text)

                # Keep overlap
                overlap_text = ""
                for item in reversed(current):
                    candidate = item + separator + overlap_text if overlap_text else item
                    if len(candidate) <= self.chunk_overlap:
                        overlap_text = candidate
                    else:
                        break

                current = [overlap_text] if overlap_text else []
                current_len = len(overlap_text)

            current.append(split)
            current_len += split_len + len(separator)

        if current:
            chunk_text = separator.join(current)
            if chunk_text.strip():
                if len(chunk_text) > self.chunk_size and new_separators:
                    chunks.extend(self._split_recursive(chunk_text, new_separators))
                else:
                    chunks.append(chunk_text)

        return chunks

    def _merge_small_chunks(self, chunks: List[str]) -> List[str]:
        """Merge very small chunks with the previous one."""
        if not chunks:
            return chunks

        merged: List[str] = [chunks[0]]
        for chunk in chunks[1:]:
            if len(merged[-1]) + len(chunk) + 1 <= self.chunk_size and len(merged[-1]) < self.chunk_size * 0.4:
                merged[-1] = merged[-1] + " " + chunk
            else:
                merged.append(chunk)

        return merged
