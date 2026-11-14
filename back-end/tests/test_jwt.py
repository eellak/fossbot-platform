from datetime import datetime, timedelta, timezone
import pytest
from jose import ExpiredSignatureError, JWTError

from utils.utils_jwt import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    verify_access_token,
)


def test_create_access_token_has_exp_claim():
    token = create_access_token({"sub": "student_user"})
    payload = verify_access_token(token)

    assert payload.get("sub") == "student_user"
    assert "exp" in payload
    # exp timestamp should be approximately ACCESS_TOKEN_EXPIRE_MINUTES into the future
    now_ts = datetime.now(timezone.utc).timestamp()
    expected_exp = now_ts + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    assert abs(payload["exp"] - expected_exp) < 10


def test_create_access_token_custom_expires_delta():
    delta = timedelta(minutes=5)
    token = create_access_token({"sub": "teacher_user"}, expires_delta=delta)
    payload = verify_access_token(token)

    assert payload.get("sub") == "teacher_user"
    now_ts = datetime.now(timezone.utc).timestamp()
    assert abs(payload["exp"] - (now_ts + 300)) < 10


def test_verify_access_token_expired():
    # Create an expired token by passing a negative delta
    expired_token = create_access_token(
        {"sub": "expired_user"},
        expires_delta=timedelta(seconds=-10),
    )

    with pytest.raises(ExpiredSignatureError):
        verify_access_token(expired_token)

    with pytest.raises(JWTError):
        verify_access_token(expired_token)
