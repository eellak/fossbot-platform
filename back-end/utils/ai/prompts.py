from __future__ import annotations

import json

from models.models import UserRole

from utils.ai.context import AssembledContext
from utils.ai.fossbot_api import FOSSBOT_API_VERSION, prompt_reference_excerpt
from utils.ai.schemas import AssistantRequest, PromptBundle


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
