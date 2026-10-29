from __future__ import annotations

import datetime
import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from database.database import GuestInstanceSettings, GuestSession, User
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.models import GuestSettingsUpdate, GuestView
from sqlalchemy.orm import Session
from utils.beta_access import require_beta_access

from routers.stage_sources import get_db


GUEST_TOKEN_PREFIX = "guest_"
GUEST_SESSION_DAYS = 30
GUEST_CREATE_LIMIT = 5
GUEST_JOIN_LIMIT = 10
GUEST_THROTTLE_WINDOW_SECONDS = 60
ADJECTIVES = (
    "amber", "brave", "bright", "calm", "clever", "coral", "crisp", "daring",
    "eager", "fancy", "gentle", "golden", "happy", "humble", "jolly", "kind",
    "lively", "lucky", "mellow", "merry", "nimble", "noble", "olive", "plucky",
    "proud", "quick", "quiet", "rapid", "royal", "shiny", "silent", "silver",
    "sunny", "swift", "tidy", "vivid", "warm", "wise", "witty", "young",
)
ANIMALS = (
    "badger", "beaver", "bison", "camel", "cheetah", "crane", "dolphin", "eagle",
    "falcon", "ferret", "finch", "fox", "gecko", "heron", "ibis", "jaguar",
    "kestrel", "koala", "lemur", "lynx", "marmot", "mole", "moose", "otter",
    "panda", "parrot", "puma", "quail", "rabbit", "raven", "seal", "shark",
    "sparrow", "stoat", "swan", "tiger", "toucan", "turtle", "walrus", "wombat",
)

_bearer = HTTPBearer(auto_error=False)
# Worker-local only: bounded guest creation/join attempts are not shared between
# processes and are discarded on restart. Replace with a shared limiter if the
# API runs multiple workers behind a load balancer.
_throttles: dict[str, list[float]] = {}

DEFAULT_GUEST_VIEWS = tuple(view.value for view in GuestView)


@dataclass(frozen=True)
class Participant:
    user: Optional[User] = None
    guest: Optional[GuestSession] = None

    @property
    def is_guest(self) -> bool:
        return self.guest is not None

    @property
    def identity(self) -> tuple[str, int]:
        if self.guest is not None:
            return "guest", self.guest.id
        return "account", self.user.id


def hash_guest_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_guest_token() -> str:
    return f"{GUEST_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


def new_guest_alias(db: Session) -> str:
    for _ in range(8):
        alias = f"{secrets.choice(ADJECTIVES)}_{secrets.choice(ANIMALS)}"
        if db.query(GuestSession.id).filter(GuestSession.alias == alias).first() is None:
            return alias
    return f"{secrets.choice(ADJECTIVES)}_{secrets.choice(ANIMALS)}_{secrets.randbelow(100):02d}"


def guest_settings_row(db: Session) -> Optional[GuestInstanceSettings]:
    return db.query(GuestInstanceSettings).filter(GuestInstanceSettings.id == 1).first()


def allowed_guest_views(row: Optional[GuestInstanceSettings]) -> list[str]:
    if row is None:
        return list(DEFAULT_GUEST_VIEWS)
    stored = set(row.allowed_views or [])
    return [view for view in DEFAULT_GUEST_VIEWS if view in stored]


def guest_settings_payload(row: Optional[GuestInstanceSettings]) -> dict:
    return {
        "beta_tester": bool(row.beta_tester) if row else False,
        "allowed_views": allowed_guest_views(row),
    }


def save_guest_settings(db: Session, request: GuestSettingsUpdate, admin_id: int) -> GuestInstanceSettings:
    row = guest_settings_row(db)
    if row is None:
        row = GuestInstanceSettings(id=1, updated_by_id=admin_id)
        db.add(row)
    row.beta_tester = request.beta_tester
    row.allowed_views = [view.value for view in request.allowed_views]
    row.updated_by_id = admin_id
    row.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def guest_session_payload(session: GuestSession, settings: dict) -> dict:
    return {
        "is_guest": True,
        "alias": session.alias,
        "created_at": session.created_at,
        "expires_at": session.expires_at,
        "settings": settings,
    }


def guest_throttle(request: Request, action: str, limit: int) -> None:
    client = request.client.host if request.client else "unknown"
    key = f"{action}:{client}"
    now = time.monotonic()
    recent = [at for at in _throttles.get(key, []) if now - at < GUEST_THROTTLE_WINDOW_SECONDS]
    if len(recent) >= limit:
        _throttles[key] = recent
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many guest requests. Try again shortly.",
            headers={"Retry-After": str(GUEST_THROTTLE_WINDOW_SECONDS)},
        )
    recent.append(now)
    _throttles[key] = recent


def clear_guest_throttles() -> None:
    _throttles.clear()


async def get_guest_session(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> GuestSession:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate guest credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not credentials.credentials.startswith(GUEST_TOKEN_PREFIX):
        raise unauthorized
    session = db.query(GuestSession).filter(
        GuestSession.token_hash == hash_guest_token(credentials.credentials),
    ).first()
    if session is None or session.expires_at <= datetime.datetime.utcnow():
        raise unauthorized
    return session


def require_guest_view(view: GuestView):
    async def dependency(
        session: GuestSession = Depends(get_guest_session),
        db: Session = Depends(get_db),
    ) -> GuestSession:
        if view.value not in allowed_guest_views(guest_settings_row(db)):
            raise HTTPException(status_code=403, detail="This guest view is not enabled")
        return session
    return dependency


async def get_participant(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Participant:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if credentials.credentials.startswith(GUEST_TOKEN_PREFIX):
        return Participant(guest=await get_guest_session(credentials, db))
    # Imported lazily to keep this module usable from account-only routers.
    from routers.stage_sources import get_current_user
    return Participant(user=await get_current_user(credentials.credentials, db))


async def get_classroom_participant(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Participant:
    participant = await get_participant(credentials, db)
    if participant.guest is not None:
        if GuestView.CLASSROOMS.value not in allowed_guest_views(guest_settings_row(db)):
            raise HTTPException(status_code=403, detail="Guest classrooms are not enabled")
    else:
        require_beta_access(participant.user)
    return participant


async def get_course_access(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Participant:
    participant = await get_participant(credentials, db)
    if participant.guest is not None:
        views = allowed_guest_views(guest_settings_row(db))
        if GuestView.COURSES.value not in views and GuestView.CLASSROOMS.value not in views:
            raise HTTPException(status_code=403, detail="Guest courses are not enabled")
    else:
        require_beta_access(participant.user)
    return participant


async def get_marketplace_access(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Participant:
    participant = await get_participant(credentials, db)
    if participant.guest is not None:
        if GuestView.STAGES.value not in allowed_guest_views(guest_settings_row(db)):
            raise HTTPException(status_code=403, detail="Guest stage browsing is not enabled")
    else:
        require_beta_access(participant.user)
    return participant


async def get_course_view_participant(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Participant:
    participant = await get_participant(credentials, db)
    if participant.guest is not None:
        if GuestView.COURSES.value not in allowed_guest_views(guest_settings_row(db)):
            raise HTTPException(status_code=403, detail="Guest course browsing is not enabled")
    else:
        require_beta_access(participant.user)
    return participant
