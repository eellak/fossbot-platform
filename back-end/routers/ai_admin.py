from __future__ import annotations

import json
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    AIUsageEvent,
    ClassGroup,
    User,
)
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from models.models import UserRole
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from routers.ai import decision_payload, resolve_for_user
from routers.stage_sources import get_current_user, get_db
from utils.ai.capabilities import AI_ADMIN_SCHEMA_VERSION, CAPABILITIES, CAPABILITY_IDS, CAPABILITY_REGISTRY_VERSION
from utils.ai.providers import hosted_provider
from utils.ai.providers.base import ProviderError
from utils.ai.providers.compatibility_profiles import PROFILE_IDS
from utils.ai.secrets import decrypt_ai_secret, encrypt_ai_secret
from utils.ai.usage import purge_expired_usage


router = APIRouter(prefix="/api/admin/ai", tags=["ai-admin"])
RUNTIMES = {"hosted", "browser", "user_local"}
PROVIDER_RUNTIME_PAIRS = {
    ("openai", "hosted"),
    ("google", "hosted"),
    ("openai_compatible", "hosted"),
    ("openai_compatible", "user_local"),
    ("webllm", "browser"),
}


def camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.title() for part in tail)


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=camel)


def _clean_text(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Value cannot be empty")
    return value


def _contains_secret_key(value: Any) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower().replace("_", "")
            secret_key = (
                any(marker in normalized for marker in ("secret", "apikey", "password", "credential", "authorization"))
                or (normalized.endswith("token") and not normalized.startswith("tokenizer"))
            )
            if secret_key:
                return True
            if _contains_secret_key(child):
                return True
    if isinstance(value, list):
        return any(_contains_secret_key(child) for child in value)
    return False


def _valid_base_url(value: str) -> bool:
    parsed = urlparse(value)
    return bool(
        parsed.scheme in {"http", "https"}
        and parsed.netloc
        and not parsed.username
        and not parsed.password
        and not parsed.query
        and not parsed.fragment
    )


def _validate_settings(provider_type: str, runtime: str, settings: dict[str, Any]) -> None:
    allowed_keys = {
        ("openai", "hosted"): {"version", "organization", "project"},
        ("google", "hosted"): {"version", "apiVersion"},
        ("openai_compatible", "hosted"): {"version", "apiStyle", "path", "supportsUsage", "allowPrivateNetwork", "compatibilityProfile"},
        ("openai_compatible", "user_local"): {"version", "apiStyle", "path", "supportsUsage", "compatibilityProfile"},
        ("webllm", "browser"): {
            "version", "modelUrl", "wasmUrl", "tokenizerUrl", "modelSizeBytes",
            "memorySizeBytes", "bufferSizeRequiredBytes", "requiredWebGpuFeatures",
            "contextWindow", "licenseUrl", "cacheBackend", "integrity",
        },
    }[(provider_type, runtime)]
    if set(settings) - allowed_keys:
        raise ValueError("Provider settings contain unsupported fields")
    if _contains_secret_key(settings):
        raise ValueError("Provider settings cannot contain credentials")
    if str(settings.get("version", "1")) != "1":
        raise ValueError("Unsupported provider settings version")
    for key in ("supportsUsage", "allowPrivateNetwork"):
        if key in settings and not isinstance(settings[key], bool):
            raise ValueError(f"{key} must be a boolean")
    compatibility_profile = settings.get("compatibilityProfile")
    if compatibility_profile is not None and compatibility_profile not in PROFILE_IDS:
        raise ValueError("Unknown OpenAI-compatible provider profile")
    path = settings.get("path")
    if path is not None:
        if not isinstance(path, str) or not path.strip():
            raise ValueError("Provider path must be a non-empty relative path")
        parsed_path = urlparse(path)
        path_parts = parsed_path.path.split("/")
        if parsed_path.scheme or parsed_path.netloc or parsed_path.query or parsed_path.fragment or path.startswith("/") or ".." in path_parts:
            raise ValueError("Provider path must stay within the configured base URL")
    if (provider_type, runtime) == ("webllm", "browser"):
        for key in ("modelUrl", "wasmUrl"):
            value = settings.get(key)
            parsed = urlparse(value) if isinstance(value, str) else None
            if not parsed or parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError(f"{key} must be a credential-free absolute HTTPS URL")
        license_url = settings.get("licenseUrl")
        if license_url and not _valid_base_url(str(license_url)):
            raise ValueError("licenseUrl must be a credential-free absolute HTTP(S) URL")
        for key in ("modelSizeBytes", "memorySizeBytes", "bufferSizeRequiredBytes", "contextWindow"):
            if key in settings and (not isinstance(settings[key], int) or isinstance(settings[key], bool) or settings[key] <= 0):
                raise ValueError(f"{key} must be a positive integer")
        features = settings.get("requiredWebGpuFeatures", [])
        if not isinstance(features, list) or len(features) > 16 or any(not isinstance(value, str) or not value.strip() for value in features):
            raise ValueError("requiredWebGpuFeatures must be a short string list")
        if settings.get("cacheBackend", "cache") not in {"cache", "indexeddb"}:
            raise ValueError("cacheBackend must be cache or indexeddb")
        integrity = settings.get("integrity")
        if integrity is not None and not isinstance(integrity, dict):
            raise ValueError("integrity must be an object")
    if len(json.dumps(settings, separators=(",", ":"))) > 32_768:
        raise ValueError("Provider settings are too large")


class ProviderCreate(APIModel):
    name: str = Field(min_length=1, max_length=120)
    provider_type: Literal["openai", "google", "openai_compatible", "webllm"]
    runtime: Literal["hosted", "browser", "user_local"]
    enabled: bool = False
    model: str = Field(min_length=1, max_length=160)
    base_url: Optional[str] = Field(default=None, max_length=500)
    settings: dict[str, Any] = Field(default_factory=lambda: {"version": "1"})
    request_limit: Optional[int] = Field(default=None, ge=1)
    token_limit: Optional[int] = Field(default=None, ge=1)
    secret: Optional[str] = Field(default=None, min_length=1, max_length=10_000)

    @field_validator("name", "model")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("base_url")
    @classmethod
    def normalize_base_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validate_provider(self):
        if (self.provider_type, self.runtime) not in PROVIDER_RUNTIME_PAIRS:
            raise ValueError("Provider type and runtime are incompatible")
        if self.base_url:
            if not _valid_base_url(self.base_url):
                raise ValueError("Base URL must be a credential-free absolute HTTP(S) URL")
        if self.provider_type == "openai_compatible" and self.runtime == "hosted" and not self.base_url:
            raise ValueError("Hosted OpenAI-compatible providers require a base URL")
        _validate_settings(self.provider_type, self.runtime, self.settings)
        return self


class ProviderUpdate(APIModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    enabled: Optional[bool] = None
    model: Optional[str] = Field(default=None, min_length=1, max_length=160)
    base_url: Optional[str] = Field(default=None, max_length=500)
    settings: Optional[dict[str, Any]] = None
    request_limit: Optional[int] = Field(default=None, ge=1)
    token_limit: Optional[int] = Field(default=None, ge=1)
    secret_action: Literal["preserve", "rotate", "clear"] = "preserve"
    secret: Optional[str] = Field(default=None, min_length=1, max_length=10_000)

    @field_validator("name", "model")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value) if value is not None else None

    @field_validator("base_url")
    @classmethod
    def normalize_optional_base_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if value is not None and (_contains_secret_key(value) or str(value.get("version", "1")) != "1" or len(json.dumps(value, separators=(",", ":"))) > 32_768):
            raise ValueError("Invalid provider settings")
        return value

    @model_validator(mode="after")
    def validate_secret_action(self):
        if self.secret_action == "rotate" and not self.secret:
            raise ValueError("A new credential is required when rotating")
        if self.secret_action != "rotate" and self.secret is not None:
            raise ValueError("Credentials require the explicit rotate action")
        return self


class SettingsUpdate(APIModel):
    enabled: bool
    default_provider_id: Optional[int] = None
    request_limit: Optional[int] = Field(default=None, ge=1)
    token_limit: Optional[int] = Field(default=None, ge=1)
    report_local_usage: bool = False
    usage_retention_days: int = Field(default=30, ge=1, le=365)


class PolicyUpdate(APIModel):
    scope_type: Literal["instance", "role", "class_group", "user"]
    scope_key: str = Field(min_length=1, max_length=80)
    capability: str = Field(min_length=1, max_length=80)
    effect: Literal["allow", "deny"]
    provider_ids: list[int] = Field(default_factory=list)
    runtimes: list[Literal["hosted", "browser", "user_local"]] = Field(default_factory=list)


class ResolveRequest(APIModel):
    user_id: int
    capability: str


def require_admin(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Administrator role required")


def settings_row(db: Session, user: User) -> AIInstanceSettings:
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if settings is None:
        settings = AIInstanceSettings(id=1, enabled=False, registry_version=CAPABILITY_REGISTRY_VERSION, updated_by_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def provider_payload(provider: AIProviderConfig) -> dict:
    return {
        "id": provider.id,
        "name": provider.name,
        "providerType": provider.provider_type,
        "runtime": provider.runtime,
        "enabled": provider.enabled,
        "model": provider.model,
        "baseUrl": provider.base_url,
        "settings": provider.settings or {},
        "requestLimit": provider.request_limit,
        "tokenLimit": provider.token_limit,
        "hasSecret": bool(provider.encrypted_secret),
        "createdAt": provider.created_at,
        "updatedAt": provider.updated_at,
    }


def settings_payload(settings: AIInstanceSettings) -> dict:
    return {
        "enabled": settings.enabled,
        "defaultProviderId": settings.default_provider_id,
        "requestLimit": settings.request_limit,
        "tokenLimit": settings.token_limit,
        "reportLocalUsage": settings.report_local_usage,
        "usageRetentionDays": settings.usage_retention_days,
        "registryVersion": settings.registry_version,
        "updatedAt": settings.updated_at,
    }


def policy_payload(rule: AIPolicyRule) -> dict:
    return {
        "id": rule.id,
        "scopeType": rule.scope_type,
        "scopeKey": rule.scope_key,
        "capability": rule.capability,
        "effect": rule.effect,
        "providerIds": rule.provider_ids or [],
        "runtimes": rule.runtimes or [],
        "updatedAt": rule.updated_at,
    }


def validate_scope(db: Session, scope_type: str, scope_key: str) -> str:
    scope_key = scope_key.strip()
    if scope_type == "instance":
        if scope_key != "*":
            raise HTTPException(status_code=422, detail="Instance scope key must be *")
    elif scope_type == "role":
        if scope_key not in {role.value for role in UserRole}:
            raise HTTPException(status_code=422, detail="Unknown role")
    elif scope_type == "class_group":
        if not scope_key.isdigit():
            raise HTTPException(status_code=422, detail="Class-group scope key must be a numeric ID")
        group = db.query(ClassGroup).filter(ClassGroup.id == int(scope_key), ClassGroup.status == "active").first()
        if group is None:
            raise HTTPException(status_code=422, detail="Unknown or inactive class group")
    elif scope_type == "user":
        if not scope_key.isdigit() or db.query(User.id).filter(User.id == int(scope_key)).first() is None:
            raise HTTPException(status_code=422, detail="Unknown user")
    return scope_key


def validate_restrictions(db: Session, provider_ids: list[int], runtimes: list[str]) -> None:
    if len(provider_ids) != len(set(provider_ids)):
        raise HTTPException(status_code=422, detail="Provider restrictions must be unique")
    found = {row[0] for row in db.query(AIProviderConfig.id).filter(AIProviderConfig.id.in_(provider_ids)).all()} if provider_ids else set()
    if found != set(provider_ids):
        raise HTTPException(status_code=422, detail="Unknown provider restriction")
    if not set(runtimes).issubset(RUNTIMES):
        raise HTTPException(status_code=422, detail="Unknown runtime restriction")


@router.get("/bootstrap")
def read_bootstrap(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    settings = settings_row(db, current_user)
    return {
        "schemaVersion": AI_ADMIN_SCHEMA_VERSION,
        "registryVersion": CAPABILITY_REGISTRY_VERSION,
        "capabilities": [
            {"id": capability.id, "category": capability.category, "explanationOnly": capability.explanation_only}
            for capability in CAPABILITIES
        ],
        "settings": settings_payload(settings),
        "providers": [provider_payload(provider) for provider in db.query(AIProviderConfig).order_by(AIProviderConfig.id).all()],
        "policies": [policy_payload(rule) for rule in db.query(AIPolicyRule).order_by(AIPolicyRule.id).all()],
        "users": [
            {"id": user.id, "username": user.username, "role": getattr(user.role, "value", user.role)}
            for user in db.query(User).order_by(User.username).all()
        ],
        "groups": [
            {"id": group.id, "name": group.name, "status": group.status}
            for group in db.query(ClassGroup).filter(ClassGroup.status == "active").order_by(ClassGroup.name).all()
        ],
    }


@router.get("/providers")
def list_providers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return [provider_payload(provider) for provider in db.query(AIProviderConfig).order_by(AIProviderConfig.id).all()]


@router.post("/providers", status_code=201)
def create_provider(request: ProviderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    provider = AIProviderConfig(
        name=request.name,
        provider_type=request.provider_type,
        runtime=request.runtime,
        enabled=request.enabled,
        model=request.model,
        base_url=request.base_url,
        settings=request.settings,
        request_limit=request.request_limit,
        token_limit=request.token_limit,
        encrypted_secret=encrypt_ai_secret(request.secret),
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(provider)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Provider name already exists") from error
    db.refresh(provider)
    return provider_payload(provider)


@router.put("/providers/{provider_id}")
def update_provider(provider_id: int, request: ProviderUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    provider = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if provider is None:
        raise HTTPException(status_code=404, detail="AI provider not found")
    updates = request.model_dump(exclude_unset=True, exclude={"secret", "secret_action"})
    for key, value in updates.items():
        setattr(provider, key, value)
    if request.secret_action == "rotate":
        provider.encrypted_secret = encrypt_ai_secret(request.secret)
    elif request.secret_action == "clear":
        provider.encrypted_secret = None
    if provider.provider_type == "openai_compatible" and provider.runtime == "hosted" and not provider.base_url:
        raise HTTPException(status_code=422, detail="Hosted OpenAI-compatible providers require a base URL")
    if provider.base_url:
        if not _valid_base_url(provider.base_url):
            raise HTTPException(status_code=422, detail="Base URL must be a credential-free absolute HTTP(S) URL")
    try:
        _validate_settings(provider.provider_type, provider.runtime, provider.settings or {})
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    provider.updated_by_id = current_user.id
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Provider name already exists") from error
    db.refresh(provider)
    return provider_payload(provider)


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    provider = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if provider is None:
        raise HTTPException(status_code=404, detail="AI provider not found")
    if provider.runtime != "hosted":
        raise HTTPException(status_code=422, detail="Only hosted providers can be tested by the backend")
    try:
        adapter = hosted_provider(
            provider.provider_type,
            secret=decrypt_ai_secret(provider.encrypted_secret),
            base_url=provider.base_url,
            settings=provider.settings or {},
        )
        result = await adapter.health(provider.model)
    except ProviderError as error:
        raise HTTPException(status_code=error.status_code, detail={
            "code": error.code,
            "message": error.safe_message,
            "retryable": error.retryable,
        }) from error
    return {**result, "providerId": provider.id, "provider": provider.name, "runtime": provider.runtime}


@router.delete("/providers/{provider_id}", status_code=204)
def remove_provider(provider_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    provider = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if provider is None:
        raise HTTPException(status_code=404, detail="AI provider not found")
    # Usage history keeps the recorded provider name and model, so detach the live row.
    db.query(AIUsageEvent).filter(AIUsageEvent.provider_id == provider_id).update(
        {AIUsageEvent.provider_id: None},
        synchronize_session=False,
    )
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if settings is not None and settings.default_provider_id == provider_id:
        settings.default_provider_id = None
    for rule in db.query(AIPolicyRule).all():
        if not rule.provider_ids or provider_id not in rule.provider_ids:
            continue
        remaining = [item for item in rule.provider_ids if item != provider_id]
        if remaining:
            rule.provider_ids = remaining
        elif rule.effect == "allow":
            # An empty allow list means "every provider", so drop the rule instead of widening access.
            db.delete(rule)
        else:
            rule.provider_ids = remaining
    db.delete(provider)
    db.commit()
    return Response(status_code=204)


@router.get("/settings")
def read_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return settings_payload(settings_row(db, current_user))


@router.put("/settings")
def update_settings(request: SettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    if request.default_provider_id is not None and db.query(AIProviderConfig.id).filter(
        AIProviderConfig.id == request.default_provider_id,
        AIProviderConfig.enabled.is_(True),
    ).first() is None:
        raise HTTPException(status_code=422, detail="Default provider must be enabled")
    settings = settings_row(db, current_user)
    settings.enabled = request.enabled
    settings.default_provider_id = request.default_provider_id
    settings.request_limit = request.request_limit
    settings.token_limit = request.token_limit
    settings.report_local_usage = request.report_local_usage
    settings.usage_retention_days = request.usage_retention_days
    settings.registry_version = CAPABILITY_REGISTRY_VERSION
    settings.updated_by_id = current_user.id
    purge_expired_usage(db, request.usage_retention_days)
    db.commit()
    db.refresh(settings)
    return settings_payload(settings)


@router.get("/policies")
def list_policies(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return [policy_payload(rule) for rule in db.query(AIPolicyRule).order_by(AIPolicyRule.id).all()]


@router.put("/policies")
def put_policy(request: PolicyUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    if request.capability not in CAPABILITY_IDS:
        raise HTTPException(status_code=422, detail="Unknown AI capability")
    scope_key = validate_scope(db, request.scope_type, request.scope_key)
    validate_restrictions(db, request.provider_ids, request.runtimes)
    rule = db.query(AIPolicyRule).filter(
        AIPolicyRule.scope_type == request.scope_type,
        AIPolicyRule.scope_key == scope_key,
        AIPolicyRule.capability == request.capability,
    ).first()
    if rule is None:
        rule = AIPolicyRule(
            scope_type=request.scope_type,
            scope_key=scope_key,
            capability=request.capability,
            created_by_id=current_user.id,
            updated_by_id=current_user.id,
        )
        db.add(rule)
    rule.effect = request.effect
    rule.provider_ids = request.provider_ids or None
    rule.runtimes = request.runtimes or None
    rule.updated_by_id = current_user.id
    db.commit()
    db.refresh(rule)
    return policy_payload(rule)


@router.delete("/policies", status_code=204)
def delete_policy(
    scope_type: str = Query(alias="scopeType"),
    scope_key: str = Query(alias="scopeKey"),
    capability: str = Query(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    rule = db.query(AIPolicyRule).filter(
        AIPolicyRule.scope_type == scope_type,
        AIPolicyRule.scope_key == scope_key,
        AIPolicyRule.capability == capability,
    ).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="AI policy rule not found")
    db.delete(rule)
    db.commit()
    return Response(status_code=204)


@router.post("/resolve")
def resolve_access(request: ResolveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    if request.capability not in CAPABILITY_IDS:
        raise HTTPException(status_code=422, detail="Unknown AI capability")
    user = db.query(User).filter(User.id == request.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return decision_payload(request.capability, resolve_for_user(db, user, request.capability)) | {
        "userId": user.id,
        "username": user.username,
    }
