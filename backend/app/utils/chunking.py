"""
Recursive Boundary Splitting with Overlap
==========================================
Splits text at natural boundaries by walking down a separator hierarchy
(heading → paragraph → sentence → clause → word → character), recursing to
the next finer level whenever a segment still exceeds `chunk_size`.

After splitting, segments are greedily merged back into chunks up to
`chunk_size`, and each completed chunk's tail is carried forward as overlap
into the next chunk so that context is never lost at boundaries.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class ChunkMetadata:
    """A single chunk produced by RecursiveTextSplitter."""
    text: str
    char_start: int       # absolute position in the cleaned source text
    char_end: int
    boundary_level: str   # coarsest boundary found inside this chunk
    chunk_index: int


class RecursiveTextSplitter:
    """
    Recursive Boundary Splitting with Overlap.

    Hierarchy (coarsest → finest):
        h1/h2/h3 headings → triple newline → paragraph → newline →
        sentence (. ! ?) → semicolon → comma → word → character

    Parameters
    ----------
    chunk_size    : target maximum characters per chunk
    chunk_overlap : characters of tail context carried into the next chunk
    min_chunk_size: orphan chunks below this size are merged into predecessor
    keep_separator: re-attach the separator to the preceding piece after split
    """

    # (separator_string, level_label) – order matters: coarsest first
    SEPARATOR_HIERARCHY: List[Tuple[str, str]] = [
        ("\n# ",    "h1_heading"),
        ("\n## ",   "h2_heading"),
        ("\n### ",  "h3_heading"),
        ("\n\n\n",  "triple_newline"),
        ("\n\n",    "paragraph"),
        ("\n",      "newline"),
        (". ",      "sentence"),
        (".\n",     "sentence"),
        ("! ",      "sentence"),
        ("? ",      "sentence"),
        ("; ",      "semicolon"),
        (", ",      "comma"),
        (" ",       "word"),
        ("",        "character"),
    ]

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        min_chunk_size: int = 32,
        keep_separator: bool = True,
    ) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
        self.keep_separator = keep_separator

    # ── Public API ────────────────────────────────────────────────────────────

    def split(self, text: str) -> List[str]:
        """Return plain chunk strings (backwards-compatible)."""
        return [c.text for c in self.split_with_metadata(text)]

    def split_with_metadata(self, text: str) -> List[ChunkMetadata]:
        """Return chunks with absolute positions and boundary metadata."""
        text = self._clean(text)
        if not text:
            return []

        seps = [s for s, _ in self.SEPARATOR_HIERARCHY]
        raw_segments = self._split_recursive(text, seps, offset=0)
        merged = self._merge_with_overlap(raw_segments)

        return [
            ChunkMetadata(
                text=chunk_text,
                char_start=start,
                char_end=end,
                boundary_level=self._dominant_boundary(chunk_text),
                chunk_index=i,
            )
            for i, (chunk_text, start, end) in enumerate(merged)
        ]

    # ── Recursive splitter ────────────────────────────────────────────────────

    def _split_recursive(
        self,
        text: str,
        separators: List[str],
        offset: int,
    ) -> List[Tuple[str, int, int]]:
        """
        Recursively split `text` until every segment is ≤ chunk_size.
        Returns a flat list of (segment_text, abs_start, abs_end).
        """
        # Already small enough — no split needed
        if len(text) <= self.chunk_size:
            return [(text, offset, offset + len(text))]

        # Walk the hierarchy to find the first separator present in the text
        chosen_sep = ""
        remaining: List[str] = []
        for i, sep in enumerate(separators):
            if sep == "" or sep in text:
                chosen_sep = sep
                remaining = separators[i + 1:]
                break

        # ── Character-level hard-cut (last resort) ────────────────────────
        if chosen_sep == "":
            parts: List[Tuple[str, int, int]] = []
            pos = 0
            while pos < len(text):
                end = min(pos + self.chunk_size, len(text))
                parts.append((text[pos:end], offset + pos, offset + end))
                pos = end
            return parts

        # ── Split and optionally restore the separator ────────────────────
        raw_parts = text.split(chosen_sep)
        results: List[Tuple[str, int, int]] = []
        running = offset

        for idx, part in enumerate(raw_parts):
            # Re-attach separator to all but the last piece so sentences keep
            # their terminating punctuation and headings keep their prefix.
            if idx < len(raw_parts) - 1 and self.keep_separator:
                restored = part + chosen_sep
            else:
                restored = part

            seg_start = running
            seg_end = running + len(restored)
            running = seg_end

            if not restored.strip():
                continue

            if len(restored) <= self.chunk_size:
                results.append((restored, seg_start, seg_end))
            elif remaining:
                results.extend(
                    self._split_recursive(restored, remaining, seg_start)
                )
            else:
                # No finer separator — hard-cut
                pos = 0
                while pos < len(restored):
                    end = min(pos + self.chunk_size, len(restored))
                    results.append(
                        (restored[pos:end], seg_start + pos, seg_start + end)
                    )
                    pos = end

        return results

    # ── Overlap merger ────────────────────────────────────────────────────────

    def _merge_with_overlap(
        self,
        segments: List[Tuple[str, int, int]],
    ) -> List[Tuple[str, int, int]]:
        """
        Greedily accumulate segments into chunks up to `chunk_size`.

        When a chunk is flushed the last `chunk_overlap` characters of its
        text are trimmed to the nearest word boundary and carried forward as
        the opening context of the next chunk.
        """
        if not segments:
            return []

        chunks: List[Tuple[str, int, int]] = []
        current_parts: List[str] = []
        current_start: int = segments[0][1]
        current_len: int = 0

        for seg_text, seg_start, _seg_end in segments:
            seg_len = len(seg_text)

            # Flush when adding this segment would exceed chunk_size
            if current_len + seg_len > self.chunk_size and current_parts:
                chunk_text = "".join(current_parts).strip()

                if len(chunk_text) >= self.min_chunk_size:
                    chunks.append(
                        (chunk_text, current_start, current_start + len(chunk_text))
                    )

                # ── Compute overlap tail ──────────────────────────────────
                overlap_tail = self._clean_overlap(chunk_text)

                if overlap_tail:
                    current_parts = [overlap_tail]
                    # Start position is within the just-flushed chunk
                    current_start = current_start + len(chunk_text) - len(overlap_tail)
                    current_len = len(overlap_tail)
                else:
                    current_parts = []
                    current_start = seg_start
                    current_len = 0

            # Anchor start on first real content
            if not current_parts:
                current_start = seg_start

            current_parts.append(seg_text)
            current_len += seg_len

        # Flush remaining segments
        if current_parts:
            chunk_text = "".join(current_parts).strip()
            if len(chunk_text) >= self.min_chunk_size:
                chunks.append(
                    (chunk_text, current_start, current_start + len(chunk_text))
                )

        return self._absorb_orphans(chunks)

    def _clean_overlap(self, chunk_text: str) -> str:
        """
        Extract the last `chunk_overlap` characters from `chunk_text` and
        trim the left edge to the nearest word boundary so we don't start an
        overlap mid-word.
        """
        if not self.chunk_overlap:
            return ""
        tail = chunk_text[-self.chunk_overlap:]
        # Trim to a clean word start if possible
        space_pos = tail.find(" ")
        if 0 < space_pos < len(tail) - 1:
            tail = tail[space_pos + 1:]
        return tail

    # ── Post-processing ───────────────────────────────────────────────────────

    def _absorb_orphans(
        self, chunks: List[Tuple[str, int, int]]
    ) -> List[Tuple[str, int, int]]:
        """
        Merge orphan chunks (text < min_chunk_size) into their predecessor.
        This eliminates tiny tail fragments that carry almost no information.
        """
        if len(chunks) < 2:
            return chunks

        result: List[Tuple[str, int, int]] = [chunks[0]]
        for text, start, end in chunks[1:]:
            if len(text) < self.min_chunk_size and result:
                prev_text, prev_start, _ = result[-1]
                merged = prev_text.rstrip() + " " + text.lstrip()
                # Only absorb if the merged chunk stays within a 10% buffer
                if len(merged) <= self.chunk_size * 1.1:
                    result[-1] = (merged, prev_start, end)
                    continue
            result.append((text, start, end))
        return result

    # ── Text cleaning ─────────────────────────────────────────────────────────

    @staticmethod
    def _clean(text: str) -> str:
        text = re.sub(r"\r\n", "\n", text)       # CRLF → LF
        text = re.sub(r"\r", "\n", text)          # CR → LF
        text = re.sub(r"\n{4,}", "\n\n\n", text)  # cap run-of-newlines at 3
        text = re.sub(r" {2,}", " ", text)        # collapse multiple spaces
        text = re.sub(r"\t", "    ", text)        # tabs → 4 spaces
        return text.strip()

    # ── Boundary label ────────────────────────────────────────────────────────

    @staticmethod
    def _dominant_boundary(text: str) -> str:
        """Return the coarsest boundary type found inside `text`."""
        if "\n# " in text or "\n## " in text or "\n### " in text:
            return "heading"
        if "\n\n" in text:
            return "paragraph"
        if "\n" in text:
            return "newline"
        for marker in (". ", "? ", "! "):
            if marker in text:
                return "sentence"
        if ";" in text:
            return "semicolon"
        return "word"
