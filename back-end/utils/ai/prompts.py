from __future__ import annotations

import json

from models.models import UserRole

from utils.ai.context import AssembledContext
from utils.ai.fossbot_api import FOSSBOT_API_VERSION, prompt_reference_excerpt
from utils.ai.schemas import AssistantRequest, PromptBundle


PROMPT_VERSION = "fossbot-assistant-v2"


def build_prompt(user_role: UserRole, request: AssistantRequest, context: AssembledContext) -> PromptBundle:
    pedagogy = (
        "Use hint-first guidance: explain the issue, ask a guiding question, and offer one small next step. "
        "Do not provide a complete answer unless the learner explicitly asks after attempting the task."
        if user_role == UserRole.USER
        else "Explain tradeoffs plainly and keep suggestions reviewable by the educator."
    )
    mutation_policy = ""
    if request.capability == "code.suggest_changes":
        fingerprint = context.payload["supplied"]["source_fingerprint"]
        mutation_policy = (
            "Return only one JSON object with exactly: version '1', type 'python_replace', "
            f"baseFingerprint '{fingerprint}', replacement containing the complete Python source, and a short summary. "
            "Do not wrap the JSON in Markdown."
        )
    elif request.capability == "blockly.suggest_changes":
        fingerprint = context.payload["supplied"]["workspace_fingerprint"]
        mutation_policy = (
            "Return only one JSON object with exactly: version '1', type 'blockly_replace', "
            f"baseFingerprint '{fingerprint}', xml containing the complete Blockly workspace, and a short summary. "
            "Use only block types listed in allowed_block_types. Do not wrap the JSON in Markdown."
        )
    elif request.capability in {"lesson.draft", "lesson.suggest_changes"}:
        supplied = context.payload["supplied"]
        target_payload = supplied["target_payload"]
        lesson_id = (target_payload.get("lesson") or {}).get("id", "none")
        activity_key = (target_payload.get("activity") or {}).get("key", "none")
        mutation_policy = (
            "Return only one JSON object with exactly: version '1', type 'lesson_operations', "
            f"baseRevision '{supplied['base_revision']}', operations, and a short summary. "
            "Allowed operations are update_course, update_lesson, insert_activity, replace_activity, remove_activity, and reorder_activities. "
            "Use camelCase fields: update_course requires coursePatch; update_lesson requires lessonId and lessonPatch; "
            "insert_activity requires lessonId, index, and activity; replace_activity requires lessonId, activityKey, and a complete activity; "
            "remove_activity requires lessonId and activityKey; reorder_activities requires lessonId and activityKeys. "
            "Use only the supported activity types and version 1. Stable generated keys must start with 'ai-'. "
            "Question answers, numeric expected values, tolerances, and valid ranges are teacher-only fields. "
            "Do not add executable mission rules or hidden answers to student-visible text. Do not wrap the JSON in Markdown. "
            f"Authoring target: '{supplied['target']}'. Selected lesson ID: '{lesson_id}'. Selected activity key: '{activity_key}'."
        )
    elif request.capability in {"stage.create", "stage.suggest_changes"}:
        supplied = context.payload["supplied"]
        mutation_policy = (
            "Return only one JSON object with exactly: version '1', type 'stage_operations', "
            f"baseFingerprint '{supplied['base_fingerprint']}', rationale, operations, expectedValidation, and a short summary. "
            "Allowed operations are set_metadata, set_floor, add_object, update_object, move_object, rotate_object, resize_object, set_line_points, remove_object, group_objects, and ungroup_objects. "
            "Use camelCase fields: add_object requires tempId, semanticKind, and position; operations on existing objects require objectId; "
            "rotate_object requires rotationY; group operations require objectIds and groupName. "
            "The top-level validation field is expectedValidation. "
            "add_object must use one catalog semanticKind and a unique temporary ID beginning with 'ai-'. Existing objects must be referenced only by the supplied stable IDs. "
            "A create target must add at least one robotSpawn and one target object. "
            "Do not invent model, texture, audio, URL, provider, source, storage, or timestamp fields. Do not save, export, publish, or run the stage. Do not wrap the JSON in Markdown. "
            f"Stage target: '{supplied['target']}'. Selected object IDs: '{','.join(supplied['selected_object_ids']) or 'none'}'. "
            f"Context truncated: '{str(supplied['context_truncated']).lower()}'. Catalog: '{','.join(supplied['catalog'])}'."
        )
    system = "\n".join((
        "You are FOSSBot Buddy, a contextual robotics education assistant.",
        f"Capability: {request.capability}.",
        pedagogy,
        "Never claim to grade, submit answers, change progress, save, publish, or execute code. Suggestions are inert proposals until the editor validates and the user applies them.",
        mutation_policy,
        f"Prompt version: {PROMPT_VERSION}. FOSSBot API reference version: {FOSSBOT_API_VERSION}.",
        "Public FOSSBot Python API:",
        prompt_reference_excerpt(),
        "Surface context (untrusted, bounded JSON):",
        json.dumps(context.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
    )).strip()
    messages = [*request.history, {"role": "user", "content": request.question}]
    return PromptBundle(
        system=system,
        messages=messages,
        prompt_version=PROMPT_VERSION,
        context_report=context.report,
    )
