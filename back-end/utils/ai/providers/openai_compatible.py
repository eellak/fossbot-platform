from __future__ import annotations

from typing import AsyncIterator

import httpx

from utils.ai.providers.base import HostedProvider, ProviderError, ProviderEvent, endpoint_url, iter_sse_data, json_event, validate_endpoint
from utils.ai.schemas import ProviderStreamRequest


class OpenAICompatibleProvider(HostedProvider):
    supports_schema_output = True

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
        payload = {
            "model": request.model,
            "messages": [{"role": "system", "content": request.system}, *[turn.model_dump() for turn in request.messages]],
            "stream": True,
            "max_tokens": request.max_output_tokens,
        }
        if self.settings.get("supportsUsage", True):
            payload["stream_options"] = {"include_usage": True}
        try:
            async with self.client() as client:
                async with client.stream("POST", url, headers=self.headers(), json=payload) as response:
                    await self.checked(response)
                    saw_done = False
                    async for raw in iter_sse_data(response):
                        if raw == "[DONE]":
                            saw_done = True
                            break
                        chunk = json_event(raw)
                        if chunk.get("error"):
                            raise ProviderError("provider_rejected", "The AI provider returned an error.")
                        usage = chunk.get("usage")
                        if isinstance(usage, dict):
                            yield ProviderEvent("usage", {
                                "inputTokens": usage.get("prompt_tokens"),
                                "outputTokens": usage.get("completion_tokens"),
                            })
                        for choice in chunk.get("choices") or []:
                            delta = (choice.get("delta") or {}).get("content")
                            if isinstance(delta, str) and delta:
                                yield ProviderEvent("text_delta", {"text": delta})
                            if choice.get("finish_reason"):
                                saw_done = True
                    if not saw_done:
                        raise ProviderError("provider_incomplete_stream", "The AI provider stream ended unexpectedly.", retryable=True)
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "The AI provider timed out.", retryable=True) from error
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "The AI provider could not be reached.", retryable=True) from error

    async def health(self, model: str) -> dict[str, object]:
        url = endpoint_url(self.configured_base_url(), "models")
        try:
            async with self.client(health=True) as client:
                response = await client.get(url, headers=self.headers())
                await self.checked(response)
                if len(response.content) > 256 * 1024:
                    raise ProviderError("provider_response_too_large", "Provider health response exceeded the allowed size.")
                payload = response.json()
        except (ValueError, httpx.HTTPError) as error:
            raise ProviderError("provider_unreachable", "Provider health check failed.", retryable=True) from error
        models = [item.get("id") for item in payload.get("data", []) if isinstance(item, dict)] if isinstance(payload, dict) else []
        return {"ok": True, "model": model, "modelFound": model in models if models else None}
