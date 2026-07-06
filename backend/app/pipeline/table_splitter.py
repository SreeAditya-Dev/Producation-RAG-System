import re
from typing import List, Tuple
from app.utils.chunking import RecursiveTextSplitter, ChunkMetadata


class TableAwareSplitter:
    """
    Decomposes text into table and paragraph segments. Parses markdown tables
    atomically or slices them row-by-row while preserving column headers
    to prevent semantic loss during RAG retrieval.
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.base_splitter = RecursiveTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        # Regex to detect standard markdown table blocks
        self.table_pattern = re.compile(
            r"((?:^\|[^\n]+\|\r?\n?)+(?:^\|(?:\s*:-+\s*:?\s*)+\|\r?\n?)+(?:^\|[^\n]+\|\r?\n?)+)",
            re.MULTILINE,
        )

    def split_document(self, text: str) -> List[ChunkMetadata]:
        """
        Main entry point to split document text into metadata-enriched chunks,
        handling tables and standard text sections appropriately.
        """
        cleaned_text = self.base_splitter._clean(text)
        if not cleaned_text:
            return []

        segments = self._partition_tables_and_text(cleaned_text)
        all_chunks: List[ChunkMetadata] = []
        chunk_idx = 0

        for is_table, content, start_pos, end_pos in segments:
            if is_table:
                table_chunks = self._chunk_table(content, start_pos)
                for chunk in table_chunks:
                    chunk.chunk_index = chunk_idx
                    all_chunks.append(chunk)
                    chunk_idx += 1
                continue

            text_chunks = self.base_splitter.split_with_metadata(content)
            for chunk in text_chunks:
                # Adjust positions relative to global text index
                chunk.char_start += start_pos
                chunk.char_end += start_pos
                chunk.chunk_index = chunk_idx
                all_chunks.append(chunk)
                chunk_idx += 1

        return all_chunks

    def _partition_tables_and_text(
        self, text: str
    ) -> List[Tuple[bool, str, int, int]]:
        """
        Partitions the text into (is_table, content, start, end) segments.
        """
        segments: List[Tuple[bool, str, int, int]] = []
        last_idx = 0

        for match in self.table_pattern.finditer(text):
            # Non-table text segment prior to table
            pre_text = text[last_idx:match.start()]
            if pre_text.strip():
                segments.append((False, pre_text, last_idx, match.start()))

            # Table segment
            table_content = match.group(0)
            segments.append((True, table_content, match.start(), match.end()))
            last_idx = match.end()

        # Trailing non-table text segment
        post_text = text[last_idx:]
        if post_text.strip():
            segments.append((False, post_text, last_idx, len(text)))

        return segments

    def _chunk_table(self, table_text: str, offset: int) -> List[ChunkMetadata]:
        """
        Chunks a markdown table. Keeps short tables intact. Splits large tables
        row-by-row and injects column headers into each sub-chunk.
        """
        table_text = table_text.strip()
        if len(table_text) <= self.chunk_size:
            return [
                ChunkMetadata(
                    text=table_text,
                    char_start=offset,
                    char_end=offset + len(table_text),
                    boundary_level="table_atomic",
                    chunk_index=0,
                )
            ]

        lines = table_text.split("\n")
        if len(lines) < 3:
            return [
                ChunkMetadata(
                    text=table_text,
                    char_start=offset,
                    char_end=offset + len(table_text),
                    boundary_level="table_short",
                    chunk_index=0,
                )
            ]

        # Extract table headers (header label + separator line)
        header_block = f"{lines[0]}\n{lines[1]}"
        data_rows = lines[2:]
        chunks: List[ChunkMetadata] = []
        row_offset = offset + len(lines[0]) + len(lines[1]) + 2

        for i, row in enumerate(data_rows):
            if not row.strip():
                continue
            # Inject headers into every row chunk
            row_chunk_text = f"{header_block}\n{row}"
            chunks.append(
                ChunkMetadata(
                    text=row_chunk_text,
                    char_start=row_offset,
                    char_end=row_offset + len(row),
                    boundary_level="table_row_slice",
                    chunk_index=0,
                )
            )
            row_offset += len(row) + 1

        return chunks
