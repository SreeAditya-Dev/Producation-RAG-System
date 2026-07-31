import pytest
from app.services.pii_policy import redact


def test_card_number_partial_masking():
    text = "User debit card is 4532-8901-2345-6789 and replacement card is 4916234567890123"
    redacted = redact(text)
    assert "4532-XXXX-XXXX-6789" in redacted
    assert "4916-XXXX-XXXX-0123" in redacted
    assert "4532-8901-2345-6789" not in redacted
    assert "4916234567890123" not in redacted


def test_aadhaar_number_partial_masking():
    text = "Customer Aadhaar is 1234-5678-9012"
    redacted = redact(text)
    assert "XXXX-XXXX-9012" in redacted
    assert "1234-5678-9012" not in redacted


def test_cvv_and_ssn_full_redaction():
    text = "Security CVV 482 and SSN 000-12-3456"
    redacted = redact(text)
    assert "[REDACTED_CVV]" in redacted
    assert "[REDACTED_SSN]" in redacted
    assert "482" not in redacted
    assert "000-12-3456" not in redacted
