"""
Local image classifier for the PDF ingestion pipeline.

Decides whether an embedded image is worth a (slow, expensive) NVIDIA Vision
API call or can be skipped.  Runs entirely locally using Pillow — no network
I/O, typically < 5 ms per image.

Decision matrix:
  ┌──────────────────┬─────────────────────────────────────────────┐
  │ Classification   │ Action                                      │
  ├──────────────────┼─────────────────────────────────────────────┤
  │ CHART / DIAGRAM  │ → Queue for vision API (structured data)    │
  │ TABLE_IMAGE      │ → Queue for vision API (tabular data)       │
  │ PHOTO            │ → Skip vision (decorative in documents)     │
  │ LOGO             │ → Skip vision (branding, no RAG value)      │
  │ ICON             │ → Skip vision (too small to be useful)      │
  │ DECORATIVE       │ → Skip vision (borders, backgrounds)        │
  └──────────────────┴─────────────────────────────────────────────┘
"""

from __future__ import annotations

import io
import logging
from enum import Enum
from typing import Tuple

logger = logging.getLogger(__name__)


class ImageType(Enum):
    CHART = "chart"
    DIAGRAM = "diagram"
    TABLE_IMAGE = "table_image"
    PHOTO = "photo"
    LOGO = "logo"
    ICON = "icon"
    DECORATIVE = "decorative"


# Image types that contain structured/extractable data worth a vision call.
VISION_WORTHY = {ImageType.CHART, ImageType.DIAGRAM, ImageType.TABLE_IMAGE}

# ── Thresholds (tuned for typical document PDFs) ─────────────────────────────
_ICON_MAX_DIM = 150          # Anything smaller on both axes → icon
_LOGO_MAX_DIM = 300          # Small + few colors → logo
_EXTREME_ASPECT_RATIO = 5.0  # Very thin/tall → decorative banner/border
_FEW_COLORS_LIMIT = 30       # Image with < 30 unique colors → simple graphic
_PHOTO_COLOR_THRESHOLD = 8000 # Very high color diversity → photograph
_EDGE_CHART_THRESHOLD = 12   # Mean edge intensity suggesting lines/axes
_EDGE_DIAGRAM_THRESHOLD = 20 # Higher edge density → dense diagram
_LOW_ENTROPY_LIMIT = 3.0     # Low information content → decorative/solid
_HIGH_ENTROPY_LIMIT = 7.0    # Very high entropy → photograph


def classify_image(
    image_bytes: bytes,
    width: int,
    height: int,
    ocr_text: str = "",
) -> Tuple[ImageType, float, str]:
    """
    Classify an image to decide if it needs a vision API call.

    Args:
        image_bytes: Raw image bytes (PNG/JPEG/etc.)
        width: Image width in pixels (from pymupdf metadata).
        height: Image height in pixels.
        ocr_text: Any OCR text already extracted from this image.

    Returns:
        (image_type, confidence, reason) — confidence in [0, 1].
    """
    try:
        return _classify(image_bytes, width, height, ocr_text)
    except Exception as exc:
        logger.debug("Image classification failed (%s) — defaulting to CHART", exc)
        # Fail open: if we can't classify, assume it might be worth a call.
        return ImageType.CHART, 0.3, "classification_error"


def _classify(
    image_bytes: bytes,
    width: int,
    height: int,
    ocr_text: str,
) -> Tuple[ImageType, float, str]:
    from PIL import Image, ImageFilter, ImageStat

    # ── Rule 1: Too small → icon ─────────────────────────────────────────────
    if width < _ICON_MAX_DIM and height < _ICON_MAX_DIM:
        return ImageType.ICON, 0.95, f"small_dimensions_{width}x{height}"

    # ── Rule 2: Extreme aspect ratio → decorative (banner / separator) ───────
    short, long = sorted([width, height])
    ratio = long / max(short, 1)
    if ratio > _EXTREME_ASPECT_RATIO:
        return ImageType.DECORATIVE, 0.90, f"extreme_aspect_ratio_{ratio:.1f}"

    # ── Open image for pixel analysis ─────────────────────────────────────────
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    # Work on a thumbnail for speed (100×100 is enough for histograms)
    thumb = img.resize((100, 100), Image.LANCZOS)

    # ── Rule 3: Color complexity ──────────────────────────────────────────────
    colors = thumb.getcolors(maxcolors=16384)
    unique_colors = len(colors) if colors else 16384

    # Very few unique colors → simple graphic
    if unique_colors < _FEW_COLORS_LIMIT:
        if width < _LOGO_MAX_DIM and height < _LOGO_MAX_DIM:
            return ImageType.LOGO, 0.85, f"few_colors_{unique_colors}_small"
        return ImageType.DECORATIVE, 0.80, f"few_colors_{unique_colors}"

    # ── Rule 4: Edge density (detect lines, axes, borders = charts) ──────────
    gray = img.convert("L").resize((200, 200), Image.LANCZOS)
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_mean = ImageStat.Stat(edges).mean[0]

    # ── Rule 5: Entropy (information density) ─────────────────────────────────
    entropy = gray.entropy()

    # ── Rule 6: OCR hint — if OCR found numbers/axes labels, likely a chart ──
    has_data_pattern = _has_data_patterns(ocr_text)

    # ── Decision tree ─────────────────────────────────────────────────────────

    # Low entropy + few edges → solid color / decorative
    if entropy < _LOW_ENTROPY_LIMIT and edge_mean < _EDGE_CHART_THRESHOLD:
        return ImageType.DECORATIVE, 0.85, f"low_entropy_{entropy:.1f}_low_edges_{edge_mean:.1f}"

    # High edges + moderate colors → chart or diagram
    if edge_mean > _EDGE_CHART_THRESHOLD and unique_colors < _PHOTO_COLOR_THRESHOLD:
        # OCR found numeric data → very likely a chart
        if has_data_pattern:
            return ImageType.CHART, 0.90, f"edges_{edge_mean:.1f}_data_patterns_in_ocr"

        # Very high edge density → dense diagram (flowchart, architecture)
        if edge_mean > _EDGE_DIAGRAM_THRESHOLD:
            if unique_colors < 1000:
                return ImageType.DIAGRAM, 0.80, f"high_edges_{edge_mean:.1f}_low_colors_{unique_colors}"
            return ImageType.CHART, 0.75, f"high_edges_{edge_mean:.1f}_moderate_colors_{unique_colors}"

        # Moderate edges + structured look → chart
        return ImageType.CHART, 0.65, f"moderate_edges_{edge_mean:.1f}_colors_{unique_colors}"

    # Very high color diversity + smooth (low edges) → photograph
    if unique_colors > _PHOTO_COLOR_THRESHOLD and edge_mean < _EDGE_CHART_THRESHOLD:
        return ImageType.PHOTO, 0.85, f"high_colors_{unique_colors}_low_edges_{edge_mean:.1f}"

    # Very high entropy + very high colors → photograph
    if entropy > _HIGH_ENTROPY_LIMIT and unique_colors > _PHOTO_COLOR_THRESHOLD:
        return ImageType.PHOTO, 0.80, f"high_entropy_{entropy:.1f}_high_colors_{unique_colors}"

    # High colors but also high edges → could be a complex chart or a photo
    # with overlays.  Use OCR as tiebreaker.
    if unique_colors > _PHOTO_COLOR_THRESHOLD:
        if has_data_pattern:
            return ImageType.CHART, 0.60, f"high_colors_but_data_patterns"
        return ImageType.PHOTO, 0.55, f"high_colors_{unique_colors}_ambiguous"

    # Moderate everything → default to chart (better to process than miss data)
    if edge_mean > _EDGE_CHART_THRESHOLD * 0.7:
        return ImageType.CHART, 0.50, f"moderate_signals_edges_{edge_mean:.1f}"

    # Low signal overall → likely decorative
    return ImageType.DECORATIVE, 0.45, f"low_signal_edges_{edge_mean:.1f}_colors_{unique_colors}"


def _has_data_patterns(text: str) -> bool:
    """
    Check if OCR text contains patterns common in charts/tables:
    numbers, percentages, axis labels, currency, date patterns.
    """
    if not text or len(text) < 5:
        return False

    import re

    patterns = [
        r"\d+\.?\d*\s*%",         # percentages: 42%, 3.5%
        r"\$\s*[\d,]+",           # currency: $1,000
        r"₹\s*[\d,]+",           # INR currency
        r"\d{4}[-/]\d{2}",       # dates: 2024-01, 2024/03
        r"Q[1-4]\s*\d{4}",       # quarters: Q1 2024
        r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",  # months
        r"\d+\s*(?:M|K|B|k|m)\b", # magnitudes: 5M, 100K
        r"(?:x-axis|y-axis|legend|total|average|mean|median)",  # chart labels
    ]

    matches = sum(1 for p in patterns if re.search(p, text, re.IGNORECASE))
    return matches >= 1
