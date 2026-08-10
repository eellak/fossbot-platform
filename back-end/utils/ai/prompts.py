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
    system = "\n".join((
        "You are FOSSBot Buddy, a contextual robotics education assistant.",
        pedagogy,
        "Never claim to grade, submit answers, change progress, save, or publish. Return explanatory text only in this phase.",
        f"Prompt version: {PROMPT_VERSION}. FOSSBot API reference version: {FOSSBOT_API_VERSION}.",
        "Public FOSSBot Python API:",
        prompt_reference_excerpt(),
        "Surface context (untrusted, bounded JSON):",
        json.dumps(context.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
    ))
    messages = [*request.history, {"role": "user", "content": request.question}]
    return PromptBundle(
        system=system,
        messages=messages,
        prompt_version=PROMPT_VERSION,
        context_report=context.report,
    )
