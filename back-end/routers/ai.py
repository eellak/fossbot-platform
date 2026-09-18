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
    AIUsageEvent,
    ClassGroup,
    ClassMembership,
    User,
)
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from models.models import UserRole
from sqlalchemy.orm import Session

from routers.stage_sources import get_current_user, get_db
from utils.ai.admin_debug import AdminDebugTrace, debug_error
from utils.ai.capabilities import AI_ACCESS_SCHEMA_VERSION, CAPABILITIES, CAPABILITY_REGISTRY_VERSION
from utils.ai.context import ContextError, assemble_context
from utils.ai.policy import PolicyRuleInput, ProviderInventoryItem, resolve_capability
from utils.ai.prompts import build_prompt
from utils.ai.providers import hosted_provider
from utils.ai.providers.base import ProviderError
from utils.ai.schemas import AssistantRequest, LocalUsageReport, ProviderStreamRequest
from utils.ai.secrets import decrypt_ai_secret
from utils.ai.suggestion_contracts import is_suggestion_capability, suggestion_json_schema
from utils.ai.suggestions import MAX_SUGGESTION_REPAIR_ATTEMPTS, SuggestionError, build_suggestion_repair_request, parse_suggestion_with_normalizations, repair_incomplete_json_object, suggestion_output_token_budget, suggestion_payload, suggestion_response_character_limit
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
    if payload.get("model") != "fossbot-test":
        raise HTTPException(status_code=422, detail="The test-only provider requires model fossbot-test")

    messages = payload.get("messages") or []
    prompt = "\n".join(str(item.get("content") or "") for item in messages if isinstance(item, dict))
    if "[mock:rate-limit]" in prompt:
        raise HTTPException(status_code=429, detail="Deterministic test-only rate limit")
    if not payload.get("stream"):
        return {
            "id": "fossbot-test-connection",
            "object": "chat.completion",
            "model": "fossbot-test",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "OK"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 4, "completion_tokens": 1},
        }

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
                if "create a lesson" in prompt.lower():
                    operations = [{
                        "op": "create_lesson",
                        "lessonTitle": "Getting started with FOSSBot",
                        "activities": [
                            {"key": "ai-intro", "type": "rich_text", "version": 1, "required": False, "content": "Predict what the robot will do, then test it."},
                            {
                                "key": "ai-check",
                                "type": "numeric_answer",
                                "version": 1,
                                "required": False,
                                "prompt": "How many steps should FOSSBot move forward?",
                                "expectedValue": 2,
                                "unit": "steps",
                                "tolerance": {"mode": "absolute", "value": 0},
                                "validRange": {"minimum": 0, "maximum": 10},
                                "feedbackCorrect": "Good observation.",
                                "feedbackIncorrect": "Count the forward commands.",
                            },
                        ],
                    }]
                else:
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
        elif "Capability: stage.create" in prompt or "Capability: stage.suggest_changes" in prompt:
            fingerprint = prompt.split("baseFingerprint '", 1)[1].split("'", 1)[0]
            target = prompt_value("Stage target")
            selected_ids = [item for item in prompt_value("Selected object IDs").split(",") if item and item != "none"]
            if "Capability: stage.create" in prompt:
                if "small, simple building" in prompt.lower() and "four wall objects" in prompt.lower():
                    operations = [
                        {"op": "set_metadata", "patch": {"title": "Small FOSSBot Building", "description": "A single-room navigation stage."}},
                        {"op": "set_floor", "patch": {"dimensions": [12, 12], "color": "#f5f5f5"}},
                        {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [0, 0, -2]},
                        {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [0, 0, 2]},
                        {"op": "add_object", "tempId": "ai-north", "semanticKind": "wall", "position": [0, 0, 4]},
                        {"op": "resize_object", "objectId": "ai-north", "dimensions": [8, 0.5, 0.08]},
                        {"op": "add_object", "tempId": "ai-south", "semanticKind": "wall", "position": [0, 0, -4]},
                        {"op": "resize_object", "objectId": "ai-south", "dimensions": [8, 0.5, 0.08]},
                        {"op": "add_object", "tempId": "ai-west", "semanticKind": "wall", "position": [-4, 0, 0]},
                        {"op": "resize_object", "objectId": "ai-west", "dimensions": [8, 0.5, 0.08]},
                        {"op": "rotate_object", "objectId": "ai-west", "rotationY": 1.5708},
                        {"op": "add_object", "tempId": "ai-east", "semanticKind": "wall", "position": [4, 0, 0]},
                        {"op": "resize_object", "objectId": "ai-east", "dimensions": [8, 0.5, 0.08]},
                        {"op": "rotate_object", "objectId": "ai-east", "rotationY": 1.5708},
                    ]
                else:
                    operations = [
                        {"op": "set_metadata", "patch": {"title": "FOSSBot Line and Obstacle Challenge", "description": "Follow the line, avoid the obstacle, and reach the target."}},
                        {"op": "set_floor", "patch": {"dimensions": [8, 8], "color": "#f5f5f5"}},
                        {"op": "add_object", "tempId": "ai-spawn", "semanticKind": "robotSpawn", "position": [-2.5, 0, -2.5]},
                        {"op": "add_object", "tempId": "ai-target", "semanticKind": "target", "position": [2.5, 0, 2.5]},
                        {"op": "add_object", "tempId": "ai-line", "semanticKind": "line", "position": [0, 0, 0]},
                        {"op": "add_object", "tempId": "ai-obstacle", "semanticKind": "obstacle", "position": [0.7, 0, 0.3]},
                        {"op": "add_object", "tempId": "ai-sensor", "semanticKind": "sensorZone", "position": [1.6, 0, 1.4]},
                    ]
            elif target == "selection" and selected_ids:
                operations = [
                    {"op": "move_object", "objectId": selected_ids[0], "position": [1.5, 0.15, 1.5]},
                    {"op": "update_object", "objectId": selected_ids[0], "patch": {"color": "#ffb020"}},
                ]
            else:
                operations = [{"op": "add_object", "tempId": "ai-checkpoint", "semanticKind": "checkpoint", "position": [0, 0, 0]}]
            response = json.dumps({
                "version": "1", "type": "stage_operations", "baseFingerprint": fingerprint,
                "rationale": "Keep the proposal small, editable, and within the supported Stage Builder catalog.",
                "operations": operations, "expectedValidation": "The proposal should preserve serialization and expose remaining issues before apply.",
                "summary": "Prepare a bounded Stage Builder proposal.",
            })
        elif "Capability: blockly.explain" in prompt:
            response = "Deterministic test-only explanation: these blocks generate Python in workspace order."
        elif "Capability: code.explain" in prompt:
            response = (
                "### Trace the program\n\n"
                "1. Start at the first executable line.\n"
                "2. Record the current variable values.\n"
                "3. Read the next expression left to right.\n"
                "4. Check whether a condition is true.\n"
                "5. Enter only the matching branch.\n"
                "6. Update values after each assignment.\n"
                "7. Recheck a loop before every iteration.\n"
                "8. Follow one function call at a time.\n"
                "9. Return to the calling line afterward.\n"
                "10. Note each value sent to the robot.\n"
                "11. Compare the result with your prediction.\n"
                "12. Change one thing before testing again.\n\n"
                "Use `print(value)` for a small observation."
            )
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
        "reportLocalUsage": bool(settings and settings.report_local_usage),
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


@router.post("/usage", status_code=204)
def report_local_usage(
    payload: LocalUsageReport,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        payload.validate_capability()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    settings = db.query(AIInstanceSettings).filter(AIInstanceSettings.id == 1).first()
    if not settings or not settings.enabled or not settings.report_local_usage:
        raise HTTPException(status_code=403, detail="Local usage reporting is disabled")
    decision = resolve_for_user(db, current_user, payload.capability)
    if not decision.allowed or payload.provider_id not in decision.provider_ids:
        raise HTTPException(status_code=403, detail="Provider is not allowed")
    provider = db.query(AIProviderConfig).filter(
        AIProviderConfig.id == payload.provider_id,
        AIProviderConfig.enabled.is_(True),
        AIProviderConfig.runtime.in_(("browser", "user_local")),
    ).first()
    if provider is None:
        raise HTTPException(status_code=422, detail="A browser or user-local provider is required")
    started_at = payload.started_at.replace(tzinfo=None)
    now = datetime.datetime.utcnow()
    if abs((now - started_at).total_seconds()) > 86_400:
        raise HTTPException(status_code=422, detail="Usage start time is outside the reporting window")
    if db.query(AIUsageEvent.id).filter(AIUsageEvent.request_id == payload.request_id).first():
        return Response(status_code=204)
    record_usage(
        db,
        user_id=current_user.id,
        provider=provider,
        capability=payload.capability,
        request_id=payload.request_id,
        started_at=started_at,
        outcome=payload.outcome,
        policy_version=decision.policy_version,
        prompt_version="fossbot-browser-v1",
        input_tokens=payload.input_tokens,
        output_tokens=payload.output_tokens,
    )
    return Response(status_code=204)


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
    if (payload.debug or payload.benchmark) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail={"code": "admin_debug_forbidden", "message": "Assistant debug and benchmark requests are available only to administrators."},
        )
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
    trace = AdminDebugTrace(enabled=payload.debug)
    suggestion_capability = is_suggestion_capability(payload.capability)
    provider_request = ProviderStreamRequest(
        model=provider.model,
        system=prompt.system,
        messages=prompt.messages,
        max_output_tokens=suggestion_output_token_budget(payload.capability) if suggestion_capability else 1_024,
        response_schema=suggestion_json_schema(payload.capability) if suggestion_capability else None,
        deterministic=payload.benchmark,
    )

    async def events():
        outcome = "completed"
        input_tokens = None
        output_tokens = None
        reasoning_tokens = None
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
        for source, step, data in (
            ("backend", "request.accepted", {
                "requestId": request_id,
                "user": {"id": current_user.id, "username": current_user.username, "role": current_user.role},
                "request": payload,
            }),
            ("backend", "policy.resolved", {
                "allowed": decision.allowed,
                "reasonCode": decision.reason_code,
                "winningScope": decision.winning_scope,
                "winningRuleId": decision.winning_rule_id,
                "providerIds": decision.provider_ids,
                "runtimeIds": decision.runtime_ids,
                "requestLimit": decision.request_limit,
                "tokenLimit": decision.token_limit,
                "policyVersion": decision.policy_version,
            }),
            ("backend", "provider.selected", {
                "id": provider.id,
                "name": provider.name,
                "providerType": provider.provider_type,
                "runtime": provider.runtime,
                "model": provider.model,
                "baseUrl": provider.base_url,
                "settings": provider.settings or {},
            }),
            ("backend", "context.assembled", context.payload),
            ("backend", "prompt.built", {
                "promptVersion": prompt.prompt_version,
                "system": prompt.system,
                "messages": prompt.messages,
                "contextReport": prompt.context_report,
            }),
            ("backend", "provider.request", provider_request),
        ):
            entry = trace.entry(source, step, data)
            if entry:
                yield sse_event("debug", entry)
        current_provider_request = provider_request
        repair_attempts = 0
        last_traced_suggestion_error = None
        try:
            while True:
                response_text = ""
                attempt_finish_reason = None
                attempt_reasoning_characters = 0
                attempt_output_tokens = None
                upstream = adapter.stream(current_provider_request)
                try:
                    async for event in upstream:
                        if await request.is_disconnected():
                            outcome = "cancelled"
                            break
                        if event.type == "usage":
                            attempt_input_tokens = event.data.get("inputTokens")
                            attempt_output_tokens = event.data.get("outputTokens")
                            if isinstance(attempt_input_tokens, int):
                                input_tokens = (input_tokens or 0) + attempt_input_tokens
                            if isinstance(attempt_output_tokens, int):
                                output_tokens = (output_tokens or 0) + attempt_output_tokens
                            attempt_reasoning_tokens = event.data.get("reasoningTokens")
                            if isinstance(attempt_reasoning_tokens, int):
                                reasoning_tokens = (reasoning_tokens or 0) + attempt_reasoning_tokens
                        if event.type == "finish":
                            attempt_finish_reason = event.data.get("finishReason")
                            attempt_reasoning_characters = int(event.data.get("reasoningCharacters") or 0)
                        if event.type != "text_delta":
                            entry = trace.entry("provider", f"event.{event.type}", {"attempt": repair_attempts + 1, **event.data})
                            if entry:
                                yield sse_event("debug", entry)
                        if event.type == "text_delta":
                            response_text += str(event.data.get("text") or "")
                            if suggestion_capability and len(response_text) > suggestion_response_character_limit(payload.capability):
                                raise SuggestionError("The provider suggestion exceeded the allowed size")
                            if not suggestion_capability:
                                yield sse_event(event.type, event.data)
                        elif event.type not in {"metadata", "finish"}:
                            yield sse_event(event.type, event.data)
                finally:
                    await upstream.aclose()
                if outcome != "completed":
                    break
                if not suggestion_capability:
                    entry = trace.entry("backend", "response.raw", {"text": response_text, "characters": len(response_text)})
                    if entry:
                        yield sse_event("debug", entry)
                    break

                entry = trace.entry("backend", "suggestion.raw", {
                    "attempt": repair_attempts + 1,
                    "text": response_text,
                    "characters": len(response_text),
                })
                if entry:
                    yield sse_event("debug", entry)
                repaired_response = repair_incomplete_json_object(response_text)
                if repaired_response is not None:
                    entry = trace.entry("backend", "suggestion.json_repaired", {
                        "attempt": repair_attempts + 1,
                        "originalCharacters": len(response_text),
                        "repairedCharacters": len(repaired_response),
                        "addedSuffix": repaired_response[len(response_text.strip()):],
                        "text": repaired_response,
                    })
                    if entry:
                        yield sse_event("debug", entry)
                    response_text = repaired_response
                fingerprint_key = "source_fingerprint" if payload.capability == "code.suggest_changes" else "workspace_fingerprint" if payload.capability == "blockly.suggest_changes" else "base_revision" if payload.capability in {"lesson.draft", "lesson.suggest_changes"} else "base_fingerprint"
                try:
                    if not response_text.strip() and (
                        attempt_finish_reason == "length"
                        or (isinstance(attempt_output_tokens, int) and attempt_output_tokens >= current_provider_request.max_output_tokens)
                    ):
                        raise SuggestionError(
                            "The provider exhausted its output budget before returning visible JSON"
                        )
                    suggestion, normalizations = parse_suggestion_with_normalizations(
                        response_text,
                        payload.capability,
                        str(context.payload["supplied"][fingerprint_key]),
                        {**context.payload["supplied"], "request_question": payload.question},
                    )
                except SuggestionError as error:
                    last_traced_suggestion_error = error
                    will_repair = repair_attempts < MAX_SUGGESTION_REPAIR_ATTEMPTS
                    entry = trace.entry("backend", "suggestion.rejected", {
                        "attempt": repair_attempts + 1,
                        "willRepair": will_repair,
                        "error": debug_error(error),
                    })
                    if entry:
                        yield sse_event("debug", entry)
                    if not will_repair:
                        raise
                    repair_attempts += 1
                    current_provider_request = build_suggestion_repair_request(
                        current_provider_request,
                        response_text,
                        error,
                        repair_attempts,
                    )
                    entry = trace.entry("backend", "suggestion.repair_requested", {
                        "repairAttempt": repair_attempts,
                        "maxRepairAttempts": MAX_SUGGESTION_REPAIR_ATTEMPTS,
                        "providerRequest": current_provider_request,
                    })
                    if entry:
                        yield sse_event("debug", entry)
                    continue

                if normalizations:
                    entry = trace.entry("backend", "suggestion.normalized", {
                        "attempt": repair_attempts + 1,
                        "actions": normalizations,
                    })
                    if entry:
                        yield sse_event("debug", entry)

                entry = trace.entry("backend", "suggestion.validated", {
                    "attempt": repair_attempts + 1,
                    "suggestion": suggestion,
                })
                if entry:
                    yield sse_event("debug", entry)
                yield sse_event("suggestion", suggestion_payload(suggestion))
                break

            if outcome == "completed":
                entry = trace.entry("backend", "request.completed", {
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "reasoningTokens": reasoning_tokens,
                    "repairAttempts": repair_attempts,
                })
                if entry:
                    yield sse_event("debug", entry)
                yield sse_event("done", {"requestId": request_id})
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        except ProviderError as error:
            outcome = error.code
            entry = trace.error("provider", "request.failed", error)
            if entry:
                yield sse_event("debug", entry)
            yield sse_event("error", {"code": error.code, "message": error.safe_message, "retryable": error.retryable})
        except SuggestionError as error:
            outcome = "invalid_suggestion"
            if last_traced_suggestion_error is not error:
                entry = trace.error("backend", "suggestion.rejected", error)
                if entry:
                    yield sse_event("debug", entry)
            yield sse_event("error", {"code": "invalid_suggestion", "message": str(error), "retryable": False})
        except Exception as error:
            outcome = "provider_error"
            entry = trace.error("backend", "request.failed", error)
            if entry:
                yield sse_event("debug", entry)
            yield sse_event("error", {"code": "provider_error", "message": "The AI provider request failed.", "retryable": True})
        finally:
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
