from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator

import httpx

from utils.ai.providers.base import MAX_PROVIDER_RESPONSE_BYTES, HostedProvider, ProviderError, ProviderEvent, endpoint_url, iter_sse_data, json_event, validate_endpoint
from utils.ai.providers.compatibility_profiles import resolve_compatibility_profile
from utils.ai.schemas import ProviderStreamRequest


class OpenAICompatibleProvider(HostedProvider):
    supports_schema_output = True
    max_provider_retries = 2

    @staticmethod
    def _openrouter_schema_fallback(error: ProviderError, profile_id: str, payload: dict[str, object]) -> dict[str, object] | None:
        if profile_id != "openrouter" or error.status_code not in {400, 404, 422} or "response_format" not in payload:
            return None
        fallback = dict(payload)
        fallback.pop("response_format", None)
        fallback.pop("provider", None)
        fallback.pop("reasoning", None)
        fallback.pop("reasoning_effort", None)
        return fallback

    @staticmethod
    def _stream_error(payload: Any, *, response_started: bool) -> ProviderError:
        error = payload if isinstance(payload, dict) else {}
        metadata = error.get("metadata") if isinstance(error.get("metadata"), dict) else {}
        raw_status = error.get("code")
        try:
            status = int(raw_status)
        except (TypeError, ValueError):
            status = 502
        if status < 400 or status > 599:
            status = 502
        retryable = status in {408, 409, 429} or status >= 500
        code = "provider_rate_limited" if status == 429 else "provider_timeout" if status in {408, 504} else "provider_rejected"
        upstream_message = error.get("message")
        details = {
            "errorType": metadata.get("error_type"),
            "providerCode": metadata.get("provider_code"),
            "responseStarted": response_started,
        }
        if isinstance(upstream_message, str):
            details["upstreamMessage"] = upstream_message[:500]
        return ProviderError(
            code,
            "The AI provider returned an error.",
            retryable=retryable,
            status_code=status,
            details={key: value for key, value in details.items() if value is not None},
        )

    def configured_base_url(self) -> str:
        if not self.base_url:
            raise ProviderError("invalid_provider_config", "Provider endpoint is required.", status_code=422)
        return validate_endpoint(self.base_url, allow_private_network=bool(self.settings.get("allowPrivateNetwork")))

    def headers(self) -> dict[str, str]:
        headers = {"Accept": "text/event-stream", "Content-Type": "application/json"}
        if self.secret:
            headers["Authorization"] = f"Bearer {self.secret}"
        return headers

    async def stream(self, request: ProviderStreamRequest) -> AsyncIterator[ProviderEvent]:
        base = self.configured_base_url()
        path = str(self.settings.get("path") or "chat/completions")
        url = endpoint_url(base, path)
        try:
            profile = resolve_compatibility_profile(self.settings, base)
        except ValueError as error:
            raise ProviderError("invalid_provider_config", str(error), status_code=422) from error
        payload = {
            "model": request.model,
            "messages": [{"role": "system", "content": request.system}, *[turn.model_dump() for turn in request.messages]],
            "stream": True,
            "max_tokens": request.max_output_tokens,
            **profile.request_options(schema=request.response_schema, deterministic=request.deterministic),
        }
        if self.settings.get("supportsUsage", True):
            payload["stream_options"] = {"include_usage": True}
        try:
            yield ProviderEvent("metadata", {
                "compatibilityProfile": profile.id,
                "profileStatus": profile.status,
                "structuredOutput": request.response_schema is not None,
                "deterministic": request.deterministic,
            })
            async with self.client() as client:
                current_payload = payload
                provider_retries = 0
                while True:
                    try:
                        async for event in self._stream_payload(client, url, current_payload):
                            yield event
                        break
                    except ProviderError as error:
                        fallback = self._openrouter_schema_fallback(error, profile.id, current_payload)
                        if fallback is not None:
                            current_payload = fallback
                            yield ProviderEvent("metadata", {
                                "compatibilityProfile": profile.id,
                                "profileStatus": profile.status,
                                "structuredOutput": False,
                                "structuredOutputFallback": True,
                                "fallbackReason": "model_route_rejected_json_schema",
                                "upstreamStatus": error.status_code,
                                "deterministic": request.deterministic,
                            })
                            continue
                        response_started = bool(error.details.get("responseStarted"))
                        if not error.retryable or response_started or provider_retries >= self.max_provider_retries:
                            raise
                        provider_retries += 1
                        yield ProviderEvent("metadata", {
                            "compatibilityProfile": profile.id,
                            "profileStatus": profile.status,
                            "providerRetry": True,
                            "retryAttempt": provider_retries,
                            "maxProviderRetries": self.max_provider_retries,
                            "upstreamStatus": error.status_code,
                            **error.details,
                        })
                        await asyncio.sleep(0.25 * provider_retries)
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "The AI provider timed out.", retryable=True) from error
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "The AI provider could not be reached.", retryable=True) from error

    async def _stream_payload(self, client: httpx.AsyncClient, url: str, payload: dict[str, object]) -> AsyncIterator[ProviderEvent]:
        async with client.stream("POST", url, headers=self.headers(), json=payload) as response:
            await self.checked(response)
            saw_done = False
            finish_reason = None
            reasoning_characters = 0
            response_started = False
            async for raw in iter_sse_data(response):
                if raw == "[DONE]":
                    saw_done = True
                    break
                chunk = json_event(raw)
                if chunk.get("error"):
                    raise self._stream_error(chunk.get("error"), response_started=response_started)
                usage = chunk.get("usage")
                if isinstance(usage, dict):
                    details = usage.get("completion_tokens_details") or {}
                    yield ProviderEvent("usage", {
                        "inputTokens": usage.get("prompt_tokens"),
                        "outputTokens": usage.get("completion_tokens"),
                        "reasoningTokens": details.get("reasoning_tokens") if isinstance(details, dict) else None,
                    })
                for choice in chunk.get("choices") or []:
                    choice_delta = choice.get("delta") or {}
                    delta = choice_delta.get("content")
                    if isinstance(delta, str) and delta:
                        response_started = True
                        yield ProviderEvent("text_delta", {"text": delta})
                    reasoning = choice_delta.get("reasoning_content") or choice_delta.get("reasoning")
                    if isinstance(reasoning, str):
                        reasoning_characters += len(reasoning)
                        response_started = response_started or bool(reasoning)
                    if choice.get("finish_reason"):
                        finish_reason = choice.get("finish_reason")
                        saw_done = True
            if not saw_done:
                raise ProviderError(
                    "provider_incomplete_stream",
                    "The AI provider stream ended unexpectedly.",
                    retryable=True,
                    details={"responseStarted": response_started},
                )
            yield ProviderEvent("finish", {
                "finishReason": finish_reason,
                "reasoningCharacters": reasoning_characters,
            })

    async def health(self, model: str) -> dict[str, object]:
        url = endpoint_url(self.configured_base_url(), "models")
        try:
            async with self.client(health=True) as client:
                response = await client.get(url, headers=self.headers())
                await self.checked(response)
                if len(response.content) > MAX_PROVIDER_RESPONSE_BYTES:
                    raise ProviderError("provider_response_too_large", "Provider health response exceeded the allowed size.")
                payload = response.json()
        except (ValueError, httpx.HTTPError) as error:
            raise ProviderError("provider_unreachable", "Provider health check failed.", retryable=True) from error
        models = [item.get("id") for item in payload.get("data", []) if isinstance(item, dict)] if isinstance(payload, dict) else []
        return {"ok": True, "model": model, "modelFound": model in models if models else None}
