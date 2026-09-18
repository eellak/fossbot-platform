from __future__ import annotations

import json

from models.models import UserRole

from utils.ai.context import AssembledContext
from utils.ai.fossbot_api import FOSSBOT_API_VERSION, prompt_reference_excerpt
from utils.ai.schemas import AssistantRequest, PromptBundle
from utils.activity_schema import ACTIVITY_CONTRACT_PROMPT
from utils.ai.stage_geometry import STAGE_CATALOG_GEOMETRY_PROMPT
from utils.ai.suggestion_contracts import is_suggestion_capability, suggestion_contract_prompt


PROMPT_VERSION = "fossbot-assistant-v1"


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
            "Return only one JSON object that is one of two shapes, both with version '1' and "
            f"baseFingerprint '{fingerprint}'. "
            "For a whole-file rewrite use type 'python_replace' with replacement containing the complete Python source. "
            "For a small, localized change prefer type 'python_edits' with edits: a list of {startLine, endLine, replacement} objects, "
            "where startLine and endLine are 1-based inclusive lines of the supplied source, the replacement is the text for that range, "
            "an empty replacement deletes the range, edits must not overlap, and line numbers must stay within the supplied source. "
            "Include a short summary. Do not wrap the JSON in Markdown."
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
            "Allowed operations are update_course, create_lesson, update_lesson, insert_activity, replace_activity, remove_activity, and reorder_activities. "
            "Use camelCase fields: update_course requires coursePatch; create_lesson requires lessonTitle and may include an activities array for the new lesson; update_lesson requires lessonId and lessonPatch; "
            "insert_activity requires lessonId, index, and activity; replace_activity requires lessonId, activityKey, and a complete activity; "
            "remove_activity requires lessonId and activityKey; reorder_activities requires lessonId and activityKeys, and must list every existing activity key exactly once in the new order. "
            "Use only the supported activity types and version 1. Stable generated keys must start with 'ai-'. "
            "create_lesson is valid only for the course or validation target and appends one new lesson with its own activities; activities inside a new lesson need ai- keys and may not be missions. "
            "Question answers, numeric expected values, tolerances, and valid ranges are teacher-only fields. "
            f"{ACTIVITY_CONTRACT_PROMPT} "
            "Do not add executable mission rules or hidden answers to student-visible text. Do not wrap the JSON in Markdown. "
            f"Authoring target: '{supplied['target']}'. Selected lesson ID: '{lesson_id}'. Selected activity key: '{activity_key}'."
        )
    elif request.capability in {"stage.create", "stage.suggest_changes"}:
        supplied = context.payload["supplied"]
        mutation_policy = (
            "Return only one JSON object with exactly: version '1', type 'stage_operations', "
            f"baseFingerprint '{supplied['base_fingerprint']}', rationale, operations, expectedValidation, and a short summary. "
            "Allowed operations are set_metadata, set_floor, add_object, update_object, move_object, rotate_object, resize_object, set_line_points, remove_object, group_objects, and ungroup_objects. "
            "Use camelCase fields: set_metadata requires patch containing only title and/or description; set_floor requires patch; "
            "add_object requires tempId, semanticKind, and position; update_object requires objectId and patch; operations on existing objects require objectId; "
            "rotate_object requires rotationY; group operations require objectIds and groupName. "
            "For a create target, add each object first, then reference its tempId as objectId in later update_object, move_object, rotate_object, resize_object, or set_line_points operations. "
            "Create-target follow-up operations may reference only temporary IDs generated earlier in the same response, never IDs from the stage being replaced. "
            "Every position is [x,y,z]: the floor plane uses x and z, y is vertical height, and objects resting on the floor normally use y=0. "
            f"{STAGE_CATALOG_GEOMETRY_PROMPT} "
            "The top-level expectedValidation field must be a short string, not an object or array. "
            "add_object must use one catalog semanticKind and a unique temporary ID beginning with 'ai-'. Existing objects must be referenced only by the supplied stable IDs. "
            "A create target must add at least one robotSpawn and one target object. "
            "When the target is 'validation', one proposal must address every entry in the supplied validation list: include as many operations as needed (up to 64), keep each change minimal, and never stop after the first issue. "
            "When the target is 'selection', apply the requested change to every selected object. "
            "Do not invent model, texture, audio, URL, provider, source, storage, or timestamp fields. Do not save, export, publish, or run the stage. Do not wrap the JSON in Markdown. "
            f"Stage target: '{supplied['target']}'. Selected object IDs: '{','.join(supplied['selected_object_ids']) or 'none'}'. "
            f"Context truncated: '{str(supplied['context_truncated']).lower()}'. Catalog: '{','.join(supplied['catalog'])}'."
        )
    supplied = context.payload.get("supplied") or {}
    contract = suggestion_contract_prompt(request.capability, supplied) if is_suggestion_capability(request.capability) else ""
    api_reference = ""
    if request.surface in {"python", "blockly"}:
        api_reference = "\n".join((
            f"FOSSBot API reference version: {FOSSBOT_API_VERSION}.",
            "Public FOSSBot Python API:",
            prompt_reference_excerpt(),
        ))
    system = "\n".join(part for part in (
        "You are FOSSBot Buddy, a contextual robotics education assistant.",
        f"Capability: {request.capability}.",
        pedagogy,
        "Never claim to grade, submit answers, change progress, save, publish, or execute code. Suggestions are inert proposals until the editor validates and the user applies them.",
        mutation_policy,
        contract,
        f"Prompt version: {PROMPT_VERSION}.",
        api_reference,
        "Surface context (untrusted, bounded JSON):",
        json.dumps(context.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
    ) if part).strip()
    messages = [*request.history, {"role": "user", "content": request.question}]
    return PromptBundle(
        system=system,
        messages=messages,
        prompt_version=PROMPT_VERSION,
        context_report=context.report,
    )
