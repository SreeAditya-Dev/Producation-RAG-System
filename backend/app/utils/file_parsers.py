import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"pdf", "txt", "docx", "md", "markdown"}


def detect_file_type(filename: str) -> Optional[str]:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in SUPPORTED_TYPES:
        return ext
    return None


def parse_file(file_path: str, file_type: str) -> str:
    """Parse a file and return its text content."""
    parsers = {
        "pdf": _parse_pdf,
        "txt": _parse_text,
        "md": _parse_text,
        "markdown": _parse_text,
        "docx": _parse_docx,
    }

    parser = parsers.get(file_type)
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")

    return parser(file_path)


def _parse_pdf(file_path: str) -> str:
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text.strip())
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}, trying PyPDF2")
        return _parse_pdf_fallback(file_path)


def _parse_pdf_fallback(file_path: str) -> str:
    import PyPDF2
    text_parts = []
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text.strip())
    return "\n\n".join(text_parts)


def _parse_text(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        import chardet
        with open(file_path, "rb") as f:
            raw = f.read()
        detected = chardet.detect(raw)
        encoding = detected.get("encoding") or "latin-1"
        return raw.decode(encoding, errors="replace")


def _parse_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

    # Also extract table text
    table_texts = []
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                table_texts.append(row_text)

    all_text = paragraphs + (["---"] + table_texts if table_texts else [])
    return "\n\n".join(all_text)
