from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


def _fernet_key() -> bytes:
    configured = os.getenv("AI_SECRET_ENCRYPTION_KEY")
    if configured:
        try:
            decoded = base64.urlsafe_b64decode(configured.encode("utf-8"))
            if len(decoded) == 32:
                return configured.encode("utf-8")
        except Exception:
            pass
        raise RuntimeError("AI_SECRET_ENCRYPTION_KEY must be a Fernet key")

    if os.getenv("ENVIRONMENT", "development").lower() in {"production", "prod"}:
        raise RuntimeError("AI_SECRET_ENCRYPTION_KEY is required in production")
    fallback = os.getenv("SECRET_KEY")
    if not fallback:
        raise RuntimeError("AI_SECRET_ENCRYPTION_KEY or SECRET_KEY is required")
    return base64.urlsafe_b64encode(hashlib.sha256(fallback.encode("utf-8")).digest())


def encrypt_ai_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return Fernet(_fernet_key()).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_ai_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return Fernet(_fernet_key()).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as error:
        raise RuntimeError("Stored AI credential cannot be decrypted") from error
