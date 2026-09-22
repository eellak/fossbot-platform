from __future__ import annotations

import copy
from typing import AsyncIterator

import httpx

from utils.ai.providers.base import HostedProvider, ProviderError, ProviderEvent, iter_sse_data, json_event
from utils.ai.schemas import ProviderStreamRequest


OPENAI_API = "https://api.openai.com/v1"


def _openai_text_format(schema: dict) -> dict:
    """Translate our Pydantic schema to the strict subset accepted by Responses.

    OpenAI requires a root object, so root unions are placed in a strict
    ``outcome`` envelope and unwrapped by the normal parser. Schemas containing
    deliberately free-form objects (lesson activities and stage patches) use
    JSON mode and still pass through the normal repair and domain validators.
    """
    candidate = copy.deepcopy(schema)
    root_options = candidate.get("anyOf")
    if isinstance(root_options, list):
        candidate = {
            "type": "object",
            "properties": {"outcome": {"anyOf": copy.deepcopy(root_options)}},
            "required": ["outcome"],
            "additionalProperties": False,
        }

    unsupported_free_form = False

    def normalize(value):
        nonlocal unsupported_free_form
        if isinstance(value, list):
            return [normalize(item) for item in value]
        if not isinstance(value, dict):
            return value
        normalized = {key: normalize(child) for key, child in value.items()}
        if "const" in normalized:
            constant = normalized.pop("const")
            normalized["enum"] = [constant]
            if "type" not in normalized:
                normalized["type"] = "string" if isinstance(constant, str) else "integer" if isinstance(constant, int) else "number"
        if normalized.get("type") == "object":
            properties = normalized.get("properties")
            if isinstance(properties, dict):
                normalized["required"] = list(properties)
                normalized["additionalProperties"] = False
            elif normalized.get("additionalProperties") is not False:
                unsupported_free_form = True
        return normalized

    strict_schema = normalize(candidate)
    if unsupported_free_form:
        return {"type": "json_object"}
    return {
        "type": "json_schema",
        "name": "fossbot_assistant_suggestion",
        "strict": True,
        "schema": strict_schema,
    }


class OpenAIProvider(HostedProvider):
    supports_schema_output = True

    def headers(self) -> dict[str, str]:
        if not self.secret:
            raise ProviderError("provider_credential_missing", "The AI provider credential is not configured.", status_code=422)
        return {"Authorization": f"Bearer {self.secret}", "Content-Type": "application/json", "Accept": "text/event-stream"}

    async def stream(self, request: ProviderStreamRequest) -> AsyncIterator[ProviderEvent]:
        input_messages = [turn.model_dump() for turn in request.messages]
        payload = {
            "model": request.model,
            "instructions": request.system,
            "input": input_messages,
            "stream": True,
            "store": False,
            "max_output_tokens": request.max_output_tokens,
        }
        if request.response_schema:
            output_format = _openai_text_format(request.response_schema)
            payload["text"] = {
                "format": output_format,
            }
            # Responses validates JSON mode against input messages, not the
            # separate instructions field that contains our full contract.
            if output_format.get("type") == "json_object":
                payload["input"] = [
                    {"role": "developer", "content": "Return exactly one JSON object."},
                    *input_messages,
                ]
        try:
            async with self.client() as client:
                async with client.stream("POST", f"{OPENAI_API}/responses", headers=self.headers(), json=payload) as response:
                    await self.checked(response)
                    completed = False
                    finish_reason = None
                    async for raw in iter_sse_data(response):
                        event = json_event(raw)
                        event_type = event.get("type")
                        if event_type == "response.output_text.delta" and isinstance(event.get("delta"), str):
                            yield ProviderEvent("text_delta", {"text": event["delta"]})
                        elif event_type in {"response.completed", "response.incomplete"}:
                            completed = True
                            body = event.get("response") or {}
                            usage = body.get("usage") or {}
                            yield ProviderEvent("usage", {
                                "inputTokens": usage.get("input_tokens"),
                                "outputTokens": usage.get("output_tokens"),
                            })
                            # A response cut off by the output budget still finishes; only a stream
                            # with no terminal event at all is an incomplete stream.
                            if event_type == "response.incomplete":
                                finish_reason = (body.get("incomplete_details") or {}).get("reason") or "incomplete"
                        elif event_type in {"response.failed", "error"}:
                            raise ProviderError("provider_rejected", "The AI provider could not complete the request.")
                    if not completed:
                        raise ProviderError("provider_incomplete_stream", "The AI provider stream ended unexpectedly.", retryable=True)
                    if finish_reason:
                        yield ProviderEvent("finish", {"finishReason": finish_reason})
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "The AI provider timed out.", retryable=True) from error
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "The AI provider could not be reached.", retryable=True) from error

    async def health(self, model: str) -> dict[str, object]:
        try:
            async with self.client(health=True) as client:
                response = await client.get(f"{OPENAI_API}/models/{model}", headers=self.headers())
                await self.checked(response)
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "Provider health check failed.", retryable=True) from error
        return {"ok": True, "model": model, "modelFound": True}
