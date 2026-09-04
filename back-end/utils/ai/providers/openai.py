from __future__ import annotations

from typing import AsyncIterator

import httpx

from utils.ai.providers.base import HostedProvider, ProviderError, ProviderEvent, iter_sse_data, json_event
from utils.ai.schemas import ProviderStreamRequest


OPENAI_API = "https://api.openai.com/v1"


class OpenAIProvider(HostedProvider):
    supports_schema_output = True

    def headers(self) -> dict[str, str]:
        if not self.secret:
            raise ProviderError("provider_credential_missing", "The AI provider credential is not configured.", status_code=422)
        return {"Authorization": f"Bearer {self.secret}", "Content-Type": "application/json", "Accept": "text/event-stream"}

    async def stream(self, request: ProviderStreamRequest) -> AsyncIterator[ProviderEvent]:
        payload = {
            "model": request.model,
            "instructions": request.system,
            "input": [turn.model_dump() for turn in request.messages],
            "stream": True,
            "max_output_tokens": request.max_output_tokens,
        }
        try:
            async with self.client() as client:
                async with client.stream("POST", f"{OPENAI_API}/responses", headers=self.headers(), json=payload) as response:
                    await self.checked(response)
                    completed = False
                    async for raw in iter_sse_data(response):
                        event = json_event(raw)
                        event_type = event.get("type")
                        if event_type == "response.output_text.delta" and isinstance(event.get("delta"), str):
                            yield ProviderEvent("text_delta", {"text": event["delta"]})
                        elif event_type == "response.completed":
                            completed = True
                            usage = (event.get("response") or {}).get("usage") or {}
                            yield ProviderEvent("usage", {
                                "inputTokens": usage.get("input_tokens"),
                                "outputTokens": usage.get("output_tokens"),
                            })
                        elif event_type in {"response.failed", "error"}:
                            raise ProviderError("provider_rejected", "The AI provider could not complete the request.")
                    if not completed:
                        raise ProviderError("provider_incomplete_stream", "The AI provider stream ended unexpectedly.", retryable=True)
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
