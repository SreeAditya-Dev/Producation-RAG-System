"""
Multi-stage document parser.

PDF pipeline (in order, with graceful fallback at each stage):
  1. pdfplumber  — digital text
  2. pdfplumber  — structured tables → GFM Markdown
  3. pymupdf     — embedded image extraction         (pip: pymupdf)
  4. pytesseract — OCR on extracted images            (pip: pytesseract  +  apt: tesseract-ocr)
  5. NVIDIA NIM  — vision description for charts      (config: PDF_VISION_MODEL)
  6. Full-page OCR fallback for scanned / image-only pages

DOCX: paragraphs + tables in document order.
TXT / MD: charset-safe read.
"""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"pdf", "txt", "docx", "md", "markdown"}

# Minimum image dimensions (pixels) considered worth processing
_IMG_MIN_W = 80
_IMG_MIN_H = 80
# Pages with fewer than this many chars of digital text try full-page OCR
_SCAN_THRESHOLD = 80
# OCR text below this length → treat image as figure / chart
_OCR_MIN_MEANINGFUL = 30


# ── Public interface ──────────────────────────────────────────────────────────

def detect_file_type(filename: str) -> Optional[str]:
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext if ext in SUPPORTED_TYPES else None


def parse_file(file_path: str, file_type: str) -> str:
    parsers = {
        "pdf":      _parse_pdf,
        "txt":      _parse_text,
        "md":       _parse_text,
        "markdown": _parse_text,
        "docx":     _parse_docx,
    }
    parser = parsers.get(file_type)
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(file_path)


# ── PDF ───────────────────────────────────────────────────────────────────────

def _parse_pdf(file_path: str) -> str:
    """Full multi-stage PDF extraction."""
    try:
        import pdfplumber
        import fitz  # pymupdf — needed for image extraction
    except ImportError as exc:
        logger.warning("pymupdf unavailable (%s) — falling back to basic extraction", exc)
        return _parse_pdf_basic(file_path)

    pages_content: List[str] = []

    try:
        fitz_doc = fitz.open(file_path)
        with pdfplumber.open(file_path) as pdf:
            for page_num, plumber_page in enumerate(pdf.pages, 1):
                fitz_page = fitz_doc[page_num - 1]
                parts: List[str] = []

                # ── Stage 1: Digital text ────────────────────────────────────
                digital_text = (plumber_page.extract_text() or "").strip()
                if digital_text:
                    parts.append(digital_text)

                # ── Stage 2: Tables → Markdown ───────────────────────────────
                for table in plumber_page.extract_tables() or []:
                    md_table = _table_to_markdown(table)
                    if md_table:
                        parts.append(md_table)

                # ── Stage 3 + 4 + 5: Image blocks ────────────────────────────
                image_blocks = _process_page_images(fitz_doc, fitz_page)
                parts.extend(image_blocks)

                # ── Stage 6: Full-page OCR for scanned pages ─────────────────
                if len(digital_text) < _SCAN_THRESHOLD and not image_blocks:
                    ocr = _ocr_full_page(fitz_page)
                    if ocr and len(ocr.strip()) > len(digital_text):
                        parts = [f"[Page {page_num} — scanned, OCR result]\n{ocr.strip()}"]

                if parts:
                    pages_content.append(
                        f"### Page {page_num}\n\n" + "\n\n".join(parts)
                    )

        fitz_doc.close()
        return "\n\n".join(pages_content)

    except Exception as exc:
        logger.warning("Multi-stage PDF parse failed (%s) — using basic fallback", exc)
        return _parse_pdf_basic(file_path)


def _table_to_markdown(table: list) -> str:
    """Convert a pdfplumber table (list of list) to a GFM Markdown table string."""
    if not table:
        return ""

    cleaned: List[List[str]] = []
    for row in table:
        if not any(cell for cell in row):
            continue
        cleaned_row = [
            re.sub(r"\s+", " ", str(cell or "").replace("|", "\\|")).strip()
            for cell in row
        ]
        cleaned.append(cleaned_row)

    if not cleaned:
        return ""

    width = max(len(r) for r in cleaned)
    padded = [r + [""] * (width - len(r)) for r in cleaned]

    lines = [
        "| " + " | ".join(padded[0]) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for row in padded[1:]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def _process_page_images(fitz_doc, fitz_page) -> List[str]:
    """
    For each embedded image on the page:
      • OCR it (pytesseract, optional)
      • If OCR yields < _OCR_MIN_MEANINGFUL chars → try NVIDIA NIM vision description
      • Otherwise record the image's presence and any partial OCR text
    """
    results: List[str] = []
    ocr_ready = _tesseract_available()
    vision_model = _vision_model_name()

    try:
        image_list = fitz_page.get_images(full=True)
    except Exception:
        return results

    for img_idx, img_info in enumerate(image_list, 1):
        try:
            xref = img_info[0]
            base_image = fitz_doc.extract_image(xref)
            img_bytes: bytes = base_image["image"]
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)

            if width < _IMG_MIN_W or height < _IMG_MIN_H:
                continue  # icon / decoration — skip

            dims = f"{width}×{height}px"

            # ── OCR ──────────────────────────────────────────────────────────
            ocr_text = _ocr_image_bytes(img_bytes).strip() if ocr_ready else ""

            if len(ocr_text) >= _OCR_MIN_MEANINGFUL:
                results.append(f"[Image {img_idx} — OCR text]\n{ocr_text}")

            elif vision_model:
                # Chart / graph / diagram — describe with vision LLM
                description = _describe_with_vision(img_bytes, vision_model)
                if description:
                    results.append(f"[Figure {img_idx} — Vision description]\n{description}")
                else:
                    partial = f"\nPartial OCR: {ocr_text}" if ocr_text else ""
                    results.append(f"[Figure {img_idx}: Visual content ({dims}){partial}]")

            else:
                partial = f"\nPartial OCR: {ocr_text}" if ocr_text else ""
                results.append(f"[Figure {img_idx}: Visual content ({dims}){partial}]")

        except Exception as exc:
            logger.debug("Image %d extraction error: %s", img_idx, exc)

    return results


# ── OCR helpers ───────────────────────────────────────────────────────────────

def _tesseract_available() -> bool:
    """
    Return True only if both the Python package AND the Tesseract binary are present.
    Honours TESSERACT_CMD env var so Windows users can point to the installer path
    without touching code (set in .env: TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe).
    """
    try:
        import os
        import pytesseract
        cmd = os.environ.get("TESSERACT_CMD", "")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _ocr_image_bytes(image_bytes: bytes) -> str:
    try:
        import os
        import pytesseract
        from PIL import Image
        cmd = os.environ.get("TESSERACT_CMD", "")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return pytesseract.image_to_string(img, config="--psm 6 --oem 3")
    except Exception as exc:
        logger.debug("Image OCR failed: %s", exc)
        return ""


def _ocr_full_page(fitz_page) -> str:
    """Render the whole page at 300 DPI and OCR it (scanned PDF recovery)."""
    try:
        import os
        import fitz
        import pytesseract
        from PIL import Image
        cmd = os.environ.get("TESSERACT_CMD", "")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

        mat = fitz.Matrix(300 / 72, 300 / 72)  # 300 DPI
        pix = fitz_page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return pytesseract.image_to_string(img, config="--psm 6 --oem 3")
    except Exception as exc:
        logger.debug("Full-page OCR failed: %s", exc)
        return ""


# ── NVIDIA NIM vision ─────────────────────────────────────────────────────────

def _vision_model_name() -> Optional[str]:
    try:
        from app.config import settings
        model = getattr(settings, "pdf_vision_model", "")
        return model.strip() or None
    except Exception:
        return None


def _describe_with_vision(image_bytes: bytes, model: str) -> str:
    """
    Call NVIDIA NIM vision model to semantically describe a chart/graph.
    Returns an empty string on any failure so the caller can fall back gracefully.
    """
    try:
        import base64
        from openai import OpenAI
        from app.config import settings

        # Detect MIME type from magic bytes
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            mime = "image/png"
        elif image_bytes[:2] == b"\xff\xd8":
            mime = "image/jpeg"
        elif image_bytes[:4] == b"GIF8":
            mime = "image/gif"
        elif image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            mime = "image/webp"
        else:
            mime = "image/png"  # safe default

        b64 = base64.b64encode(image_bytes).decode()

        client = OpenAI(
            base_url=settings.nvidia_base_url,
            api_key=settings.nvidia_api_key,
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Describe this image for a retrieval-augmented generation system. "
                            "If it is a chart or graph: state the chart type, extract axis labels, "
                            "key data points, trends, and any numeric values shown. "
                            "If it is a table: transcribe it row by row. "
                            "If it is a diagram: describe its components and relationships. "
                            "Be concise but complete — prioritise factual content over style."
                        ),
                    },
                ],
            }],
            max_tokens=512,
        )
        return resp.choices[0].message.content.strip()

    except Exception as exc:
        logger.debug("Vision description failed (%s): %s", model, exc)
        return ""


# ── Basic / fallback PDF (no pymupdf) ─────────────────────────────────────────

def _parse_pdf_basic(file_path: str) -> str:
    """pdfplumber text + tables only — no image handling."""
    try:
        import pdfplumber
        pages: List[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                parts: List[str] = []
                text = (page.extract_text() or "").strip()
                if text:
                    parts.append(text)
                for table in page.extract_tables() or []:
                    md = _table_to_markdown(table)
                    if md:
                        parts.append(md)
                if parts:
                    pages.append("\n\n".join(parts))
        return "\n\n".join(pages)
    except Exception as exc:
        logger.warning("pdfplumber basic failed (%s) — last-resort PyPDF2", exc)
        return _parse_pdf_fallback(file_path)


def _parse_pdf_fallback(file_path: str) -> str:
    """Last-resort PyPDF2 text-only extraction."""
    import PyPDF2
    parts: List[str] = []
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text.strip())
    return "\n\n".join(parts)


# ── Text / Markdown ───────────────────────────────────────────────────────────

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


# ── DOCX ──────────────────────────────────────────────────────────────────────

def _parse_docx(file_path: str) -> str:
    """
    Extract DOCX content preserving document order (paragraphs and tables
    interleaved as they appear in the source).
    """
    from docx import Document
    doc = Document(file_path)
    parts: List[str] = []

    for block in doc.element.body:
        raw_tag = block.tag.split("}")[-1] if "}" in block.tag else block.tag

        if raw_tag == "p":
            # Collect all text runs in this paragraph
            text = "".join(
                node.text or ""
                for node in block.iter()
                if node.tag.endswith("}t") or node.tag == "t"
            ).strip()
            if text:
                parts.append(text)

        elif raw_tag == "tbl":
            rows: List[List[str]] = []
            for tr in block.iter():
                if not (tr.tag.endswith("}tr") or tr.tag == "tr"):
                    continue
                cells: List[str] = []
                for child in tr:
                    if child.tag.endswith("}tc") or child.tag == "tc":
                        cell_text = "".join(
                            n.text or ""
                            for n in child.iter()
                            if n.tag.endswith("}t") or n.tag == "t"
                        ).strip().replace("\n", " ")
                        cells.append(cell_text)
                if any(cells):
                    rows.append(cells)
            if rows:
                md = _table_to_markdown(rows)
                if md:
                    parts.append(md)

    return "\n\n".join(parts)
