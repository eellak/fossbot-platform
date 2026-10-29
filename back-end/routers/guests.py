from __future__ import annotations

import datetime

from database.database import GuestSession, User
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from models.models import GuestSettingsUpdate, UserRole
from sqlalchemy.orm import Session
from utils.guest_access import (
    GUEST_CREATE_LIMIT,
    GUEST_SESSION_DAYS,
    admin_guest_settings_payload,
    get_guest_session,
    guest_session_payload,
    guest_settings_payload,
    guest_settings_row,
    guest_throttle,
    hash_guest_token,
    new_guest_alias,
    new_guest_token,
    save_guest_settings,
)

from routers.stage_sources import get_current_user, get_db


router = APIRouter(prefix="/guests", tags=["guests"])


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def require_admin(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Administrator role required")


@router.get("/settings")
def public_guest_settings(response: Response, db: Session = Depends(get_db)):
    no_store(response)
    return guest_settings_payload(guest_settings_row(db))


@router.post("/session", status_code=status.HTTP_201_CREATED)
def create_guest_session(response: Response, request: Request, db: Session = Depends(get_db)):
    no_store(response)
    guest_throttle(request, "create", GUEST_CREATE_LIMIT)
    settings = guest_settings_payload(guest_settings_row(db))
    if not settings["allowed_views"]:
        raise HTTPException(status_code=403, detail="Guest access is not available")
    token = new_guest_token()
    now = datetime.datetime.utcnow()
    session = GuestSession(
        alias=new_guest_alias(db),
        token_hash=hash_guest_token(token),
        created_at=now,
        expires_at=now + datetime.timedelta(days=GUEST_SESSION_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "token": token,
        "token_type": "bearer",
        "guest": guest_session_payload(session, settings),
    }


@router.get("/me")
def read_guest_session(
    response: Response,
    session: GuestSession = Depends(get_guest_session),
    db: Session = Depends(get_db),
):
    no_store(response)
    return guest_session_payload(session, guest_settings_payload(guest_settings_row(db)))


@router.get("/admin/settings")
def read_guest_settings(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    no_store(response)
    require_admin(user)
    return admin_guest_settings_payload(guest_settings_row(db))


@router.put("/admin/settings")
def update_guest_settings(
    request: GuestSettingsUpdate,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    no_store(response)
    require_admin(user)
    return admin_guest_settings_payload(save_guest_settings(db, request, user.id))
