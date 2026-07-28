from fastapi import HTTPException

from models.models import UserRole


def require_beta_access(user) -> None:
    """Allow administrators and users explicitly enrolled in the beta."""
    if user.role == UserRole.ADMIN or user.beta_tester:
        return
    raise HTTPException(status_code=403, detail="Beta tester access required")
