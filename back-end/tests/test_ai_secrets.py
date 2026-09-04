import base64
import os

import pytest
from cryptography.fernet import Fernet

from utils.ai.secrets import decrypt_ai_secret, encrypt_ai_secret


def test_ai_secret_round_trip_and_plaintext_absence(monkeypatch):
    monkeypatch.setenv("AI_SECRET_ENCRYPTION_KEY", Fernet.generate_key().decode())
    encrypted = encrypt_ai_secret("credential-value")
    assert encrypted != "credential-value"
    assert "credential-value" not in encrypted
    assert decrypt_ai_secret(encrypted) == "credential-value"


def test_production_requires_explicit_ai_key(monkeypatch):
    monkeypatch.delenv("AI_SECRET_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "fallback-is-not-allowed")
    with pytest.raises(RuntimeError):
        encrypt_ai_secret("credential")


def test_invalid_explicit_key_is_rejected(monkeypatch):
    monkeypatch.setenv("AI_SECRET_ENCRYPTION_KEY", base64.urlsafe_b64encode(os.urandom(12)).decode())
    with pytest.raises(RuntimeError):
        encrypt_ai_secret("credential")
