from __future__ import annotations

import asyncio
import datetime
import json
import os
import uuid

from database.database import (
    AIInstanceSettings,
    AIPolicyRule,
    AIProviderConfig,
    ClassGroup,
    ClassMembership,
    User,
)
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from routers.stage_sources import get_current_user, get_db
from utils.ai.capabilities import AI_ACCESS_SCHEMA_VERSION, CAPABILITIES, CAPABILITY_REGISTRY_VERSION
from utils.ai.context import ContextError, assemble_context
from utils.ai.policy import PolicyRuleInput, ProviderInventoryItem, resolve_capability
from utils.ai.prompts import build_prompt
from utils.ai.providers import hosted_provider
from utils.ai.providers.base import ProviderError
from utils.ai.schemas import AssistantRequest, ProviderStreamRequest
from utils.ai.secrets import decrypt_ai_secret
from utils.ai.suggestions import MAX_SUGGESTION_RESPONSE_CHARACTERS, SuggestionError, parse_suggestion, suggestion_payload
from utils.ai.usage import QuotaError, ensure_quota, record_usage


router = APIRouter(prefix="/api/ai", tags=["ai"])


def require_test_provider() -> None:
    if os.getenv("AI_ENABLE_TEST_PROVIDER", "false").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/test/mock/v1/models", include_in_schema=False)
def test_provider_models():
    require_test_provider()
    return {"object": "list", "data": [{"id": "fossbot-test", "object": "model", "owned_by": "test-only"}]}


@router.post("/test/mock/v1/chat/completions", include_in_schema=False)
def test_provider_stream(payload: dict = Body(...)):
    require_test_provider()
    if payload.get("model") != "fossbot-test" or not payload.get("stream"):
        raise HTTPException(status_code=422, detail="The test-only provider requires model fossbot-test with streaming enabled")

    messages = payload.get("messages") or []
    prompt = "\n".join(str(item.get("content") or "") for item in messages if isinstance(item, dict))
    if "[mock:rate-limit]" in prompt:
        raise HTTPException(status_code=429, detail="Deterministic test-only rate limit")

    def prompt_value(label: str, default: str = "none") -> str:
        marker = f"{label}: '"
        return prompt.split(marker, 1)[1].split("'", 1)[0] if marker in prompt else default

    async def chunks():
        if "[mock:delay]" in prompt:
            await asyncio.sleep(2)
        if "[mock:error]" in prompt:
            yield f"data: {json.dumps({'error': {'message': 'deterministic test-only error'}})}\n\n"
            return
        if "[mock:timeout]" in prompt:
            await asyncio.sleep(50)
        if "[mock:malformed]" in prompt:
            response = "{malformed suggestion"
        elif "Capability: code.suggest_changes" in prompt:
            fingerprint = prompt.split("baseFingerprint '", 1)[1].split("'", 1)[0]
            response = json.dumps({"version": "1", "type": "python_replace", "baseFingerprint": fingerprint, "replacement": "# FOSSBot Buddy suggestion\nprint('Hello, FOSSBot!')\n", "summary": "Replace the program with a small, reviewable greeting."})
        elif "Capability: blockly.suggest_changes" in prompt:
            fingerprint = prompt.split("baseFingerprint '", 1)[1].split("'", 1)[0]
            xml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="text_print" id="ai-suggestion"><value name="TEXT"><shadow type="text" id="ai-text"><field name="TEXT">Hello, FOSSBot!</field></shadow></value></block></xml>'
            response = json.dumps({"version": "1", "type": "blockly_replace", "baseFingerprint": fingerprint, "xml": xml, "summary": "Add one print block as a reviewable example."})
        elif "Capability: lesson.draft" in prompt or "Capability: lesson.suggest_changes" in prompt:
            revision = prompt.split("baseRevision '", 1)[1].split("'", 1)[0]
            target = prompt_value("Authoring target")
            lesson_id = prompt_value("Selected lesson ID")
            activity_key = prompt_value("Selected activity key")
            if target == "course" or lesson_id == "none":
                operations = [{"op": "update_course", "coursePatch": {"description": "A concise, age-appropriate robotics course draft."}}]
            elif target == "activity":
                activity = {
                    "key": activity_key,
                    "type": "numeric_answer",
                    "version": 1,
                    "required": False,
                    "prompt": "How many forward steps should FOSSBot take?",
                    "expectedValue": 2,
                    "unit": "steps",
                    "tolerance": {"mode": "absolute", "value": 0},
                    "validRange": {"minimum": 0, "maximum": 10},
                    "feedbackCorrect": "Good observation.",
                    "feedbackIncorrect": "Trace one movement at a time.",
                }
                operations = [{"op": "replace_activity", "lessonId": int(lesson_id), "activityKey": activity_key, "activity": activity}]
            elif "Capability: lesson.draft" in prompt:
                activity = {"key": "ai-rich-text-intro", "type": "rich_text", "version": 1, "required": False, "content": "Introduce one movement command, predict the result, then test it."}
                operations = [{"op": "insert_activity", "lessonId": int(lesson_id), "index": 0, "activity": activity}]
            else:
                operations = [{"op": "update_lesson", "lessonId": int(lesson_id), "lessonPatch": {"title": "Move, predict, and reflect"}}]
            response = json.dumps({"version": "1", "type": "lesson_operations", "baseRevision": revision, "operations": operations, "summary": "Prepare one bounded, reviewable authoring change."})
        elif "Capability: blockly.explain" in prompt:
            response = "Deterministic test-only explanation: these blocks generate Python in workspace order."
        elif "Capability: code.explain" in prompt:
            response = "Deterministic test-only explanation: trace the current value one loop at a time."
        else:
            response = "Deterministic test-only provider: hosted streaming is working."
        for text_delta in (response[:34], response[34:]):
            yield f"data: {json.dumps({'choices': [{'delta': {'content': text_delta}, 'finish_reason': None}]})}\n\n"
        yield f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 32, 'completion_tokens': 9}})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(chunks(), media_type="text/event-stream", headers={"Cache-Control": "no-store"})


def provider_inventory(provider: AIProviderConfig) -> ProviderInventoryItem:
    return ProviderInventoryItem(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        runtime=provider.runtime,
        model=provider.model,
        enabled=provider.enabled,
        request_limit=provider.request_limit,
        token_limit=provider.token_limit,
    )


def rule_input(rule: AIPolicyRule) -> PolicyRuleInput:
    return PolicyRuleInput(
        id=rule.id,
        scope_type=rule.scope_type,
        scope_key=rule.scope_key,
        capability=rule.capability,
        effect=rule.effect,
        provider_ids=tuple(rule.provider_ids or ()),
        runtimes=tuple(rule.runtimes or ()),
    )


def active_group_ids(db: Session, user_id: int) -> list[int]:
    rows = (
        db.query(ClassMembership.group_id)
        .join(ClassGroup, ClassGroup.id == ClassMembership.group_id)
        .filter(
            ClassMembership.student_id == user_id,
            ClassMembership.removed_at.is_(None),
            ClassGroup.status == "active",
        )
        .all()
    )
    return [row[0] for row in rows]


def resolve_for_user(db: Session, user: User, capability: str):
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    providers = db.query(AIProviderConfig).order_by(AIProviderConfig.id).all()
    rules = db.query(AIPolicyRule).filter(AIPolicyRule.capability == capability).all()
    role = getattr(user.role, "value", user.role)
    return resolve_capability(
        instance_enabled=bool(settings and settings.enabled),
        user_id=user.id,
        role=str(role),
        active_group_ids=active_group_ids(db, user.id) if str(role) == "user" else (),
        capability=capability,
        providers=[provider_inventory(provider) for provider in providers],
        rules=[rule_input(rule) for rule in rules],
        default_provider_id=settings.default_provider_id if settings else None,
        instance_request_limit=settings.request_limit if settings else None,
        instance_token_limit=settings.token_limit if settings else None,
    )


def decision_payload(capability: str, decision) -> dict:
    return {
        "capability": capability,
        "allowed": decision.allowed,
        "reasonCode": decision.reason_code,
        "detail": decision.detail,
        "winningScope": decision.winning_scope,
        "winningRuleId": decision.winning_rule_id,
        "providerIds": list(decision.provider_ids),
        "runtimes": list(decision.runtime_ids),
        "defaultProviderId": decision.default_provider_id,
        "limits": {
            "requests": decision.request_limit,
            "tokens": decision.token_limit,
        },
        "policyVersion": decision.policy_version,
    }


def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n"


@router.get("/access")
def read_ai_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    providers = db.query(AIProviderConfig).filter(AIProviderConfig.enabled.is_(True)).order_by(AIProviderConfig.id).all()
    return {
        "schemaVersion": AI_ACCESS_SCHEMA_VERSION,
        "registryVersion": CAPABILITY_REGISTRY_VERSION,
        "instanceEnabled": bool(settings and settings.enabled),
        "capabilities": [
            decision_payload(capability.id, resolve_for_user(db, current_user, capability.id))
            for capability in CAPABILITIES
        ],
        "providers": [
            {
                "id": provider.id,
                "name": provider.name,
                "providerType": provider.provider_type,
                "runtime": provider.runtime,
                "model": provider.model,
                "settings": provider.settings or {},
            }
            for provider in providers
        ],
    }


@router.post("/assist/stream")
async def stream_assistance(
    payload: AssistantRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        payload.validate_capability()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    decision = resolve_for_user(db, current_user, payload.capability)
    if not decision.allowed:
        raise HTTPException(status_code=403, detail={"code": decision.reason_code, "message": "Assistant access is not available."})
    provider_id = payload.provider_id or decision.default_provider_id
    if provider_id not in decision.provider_ids:
        raise HTTPException(status_code=403, detail={"code": "provider_not_allowed", "message": "The selected provider is not allowed."})
    provider = db.query(AIProviderConfig).filter(
        AIProviderConfig.id == provider_id,
        AIProviderConfig.enabled.is_(True),
    ).first()
    if provider is None or provider.runtime != "hosted":
        raise HTTPException(status_code=422, detail={"code": "hosted_provider_required", "message": "Select an available hosted provider."})
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if settings is None:
        raise HTTPException(status_code=503, detail={"code": "instance_disabled", "message": "Assistant access is not available."})
    try:
        context = assemble_context(db, current_user, payload)
        prompt = build_prompt(current_user.role, payload, context)
        ensure_quota(
            db,
            user_id=current_user.id,
            capability=payload.capability,
            provider=provider,
            settings=settings,
            request_limit=decision.request_limit,
            token_limit=decision.token_limit,
            estimated_input_tokens=(len(prompt.system) + sum(len(turn.content) for turn in prompt.messages) + 3) // 4,
        )
        adapter = hosted_provider(
            provider.provider_type,
            secret=decrypt_ai_secret(provider.encrypted_secret),
            base_url=provider.base_url,
            settings=provider.settings or {},
        )
    except ContextError as error:
        raise HTTPException(status_code=422, detail={"code": "invalid_context", "message": str(error)}) from error
    except QuotaError as error:
        raise HTTPException(status_code=429, detail={"code": error.code, "message": error.safe_message, "retryAfter": error.retry_after}) from error
    except (ProviderError, RuntimeError, ValueError) as error:
        message = error.safe_message if isinstance(error, ProviderError) else "The AI provider is not configured correctly."
        code = error.code if isinstance(error, ProviderError) else "invalid_provider_config"
        status_code = error.status_code if isinstance(error, ProviderError) else 422
        raise HTTPException(status_code=status_code, detail={"code": code, "message": message}) from error

    request_id = uuid.uuid4().hex
    started_at = datetime.datetime.utcnow()
    provider_request = ProviderStreamRequest(
        model=provider.model,
        system=prompt.system,
        messages=prompt.messages,
        max_output_tokens=min(decision.token_limit or 1_024, 8_192),
    )

    async def events():
        outcome = "completed"
        input_tokens = None
        output_tokens = None
        suggestion_text = ""
        suggestion_capability = payload.capability in {"code.suggest_changes", "blockly.suggest_changes", "lesson.draft", "lesson.suggest_changes"}
        yield sse_event("start", {
            "requestId": request_id,
            "providerId": provider.id,
            "provider": provider.name,
            "model": provider.model,
            "runtime": provider.runtime,
            "promptVersion": prompt.prompt_version,
            "policyVersion": decision.policy_version,
            "context": prompt.context_report.model_dump(),
        })
        upstream = adapter.stream(provider_request)
        try:
            async for event in upstream:
                if await request.is_disconnected():
                    outcome = "cancelled"
                    break
                if event.type == "usage":
                    input_tokens = event.data.get("inputTokens")
                    output_tokens = event.data.get("outputTokens")
                if suggestion_capability and event.type == "text_delta":
                    suggestion_text += str(event.data.get("text") or "")
                    if len(suggestion_text) > MAX_SUGGESTION_RESPONSE_CHARACTERS:
                        raise SuggestionError("The provider suggestion exceeded the allowed size")
                else:
                    yield sse_event(event.type, event.data)
            if outcome == "completed":
                if suggestion_capability:
                    fingerprint_key = "source_fingerprint" if payload.capability == "code.suggest_changes" else "workspace_fingerprint" if payload.capability == "blockly.suggest_changes" else "base_revision"
                    suggestion = parse_suggestion(
                        suggestion_text,
                        payload.capability,
                        str(context.payload["supplied"][fingerprint_key]),
                        context.payload["supplied"],
                    )
                    yield sse_event("suggestion", suggestion_payload(suggestion))
                yield sse_event("done", {"requestId": request_id})
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        except ProviderError as error:
            outcome = error.code
            yield sse_event("error", {"code": error.code, "message": error.safe_message, "retryable": error.retryable})
        except SuggestionError as error:
            outcome = "invalid_suggestion"
            yield sse_event("error", {"code": "invalid_suggestion", "message": str(error), "retryable": False})
        except Exception:
            outcome = "provider_error"
            yield sse_event("error", {"code": "provider_error", "message": "The AI provider request failed.", "retryable": True})
        finally:
            await upstream.aclose()
            try:
                record_usage(
                    db,
                    user_id=current_user.id,
                    provider=provider,
                    capability=payload.capability,
                    request_id=request_id,
                    started_at=started_at,
                    outcome=outcome,
                    policy_version=decision.policy_version,
                    prompt_version=prompt.prompt_version,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            except Exception:
                db.rollback()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
