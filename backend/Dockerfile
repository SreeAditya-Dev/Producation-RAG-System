# syntax=docker/dockerfile:1

# ── Builder: install Python deps into an isolated venv ────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ── Final: slim runtime image, no build toolchain ─────────────────────────────
FROM python:3.12-slim AS final

# tesseract-ocr is a real runtime dependency of pytesseract (OCR for scanned
# PDFs/images) — the Python package is just a wrapper around this binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 appuser
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY app ./app

RUN mkdir -p /app/uploads && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
