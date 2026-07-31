"""PII/PCI/PHI minimisation & partial masking policy for prompts, retrieved contexts, cache payloads, and output answers.

Implements Strategy 1 (Partial Masking - PCI-DSS Standard):
- Credit/Debit Cards: First 4 and Last 4 digits shown (e.g. 4532-XXXX-XXXX-6789)
- Aadhaar Numbers (12-digit): Last 4 digits shown (e.g. XXXX-XXXX-9012)
- PII/PHI (SSN, CVV, MRN, Email, Phone): Masked safely
"""

from __future__ import annotations

import re

# PII: Email, Phone & SSN
_EMAIL = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# PCI: Credit / Debit Cards (13-19 digits) & CVV
_CARD = re.compile(r"\b(?:\d[ -]*?){13,19}\b")
_CVV = re.compile(r"\b(?:cvv|cvc|cvv2|security code)[\s:]*?\d{3,4}\b", re.IGNORECASE)

# India PII: Aadhaar Number (12 digits)
_AADHAAR = re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")

# PHI: Medical Record Numbers & Health IDs
_PHI_MRN = re.compile(r"\b(?:MRN|Patient ID|Diagnosis Code)[\s:]*?[A-Z0-9-]+\b", re.IGNORECASE)


def _mask_card_match(match: re.Match) -> str:
    raw = match.group(0)
    digits = re.sub(r"\D", "", raw)
    if 13 <= len(digits) <= 19:
        first4 = digits[:4]
        last4 = digits[-4:]
        return f"{first4}-XXXX-XXXX-{last4}"
    return raw


def _mask_aadhaar_match(match: re.Match) -> str:
    raw = match.group(0)
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12:
        last4 = digits[-4:]
        return f"XXXX-XXXX-{last4}"
    return raw


def redact(text: str) -> str:
    if not text:
        return text
    # Strategy 1: Partial Masking for PCI Card Numbers & Aadhaar
    text = _CARD.sub(_mask_card_match, text)
    text = _AADHAAR.sub(_mask_aadhaar_match, text)

    # Full Redaction for High-Risk PII/PHI (SSN, CVV, MRN, Email, Phone)
    text = _EMAIL.sub("[REDACTED_EMAIL]", text)
    text = _SSN.sub("[REDACTED_SSN]", text)
    text = _PHONE.sub("[REDACTED_PHONE]", text)
    text = _CVV.sub("[REDACTED_CVV]", text)
    text = _PHI_MRN.sub("[REDACTED_PHI]", text)
    return text
