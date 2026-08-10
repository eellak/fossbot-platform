from __future__ import annotations

from typing import AsyncIterator
from urllib.parse import quote

import httpx

from utils.ai.providers.base import HostedProvider, ProviderError, ProviderEvent, iter_sse_data, json_event
from utils.ai.schemas import ProviderStreamRequest


GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta"


class GoogleProvider(HostedProvider):
    supports_schema_output = True

    def headers(self) -> dict[str, str]:
        if not self.secret:
            raise ProviderError("provider_credential_missing", "The AI provider credential is not configured.", status_code=422)
        return {"x-goog-api-key": self.secret, "Content-Type": "application/json", "Accept": "text/event-stream"}

    async def stream(self, request: ProviderStreamRequest) -> AsyncIterator[ProviderEvent]:
        model = quote(request.model.removeprefix("models/"), safe="")
        url = f"{GOOGLE_API}/models/{model}:streamGenerateContent?alt=sse"
        role_map = {"assistant": "model", "user": "user"}
        payload = {
            "system_instruction": {"parts": [{"text": request.system}]},
            "contents": [
                {"role": role_map[turn.role], "parts": [{"text": turn.content}]}
                for turn in request.messages
            ],
            "generationConfig": {"maxOutputTokens": request.max_output_tokens},
        }
        completed = False
        try:
            async with self.client() as client:
                async with client.stream("POST", url, headers=self.headers(), json=payload) as response:
                    await self.checked(response)
                    async for raw in iter_sse_data(response):
                        chunk = json_event(raw)
                        for candidate in chunk.get("candidates") or []:
                            for part in (candidate.get("content") or {}).get("parts") or []:
                                text = part.get("text")
                                if isinstance(text, str) and text:
                                    yield ProviderEvent("text_delta", {"text": text})
                            if candidate.get("finishReason"):
                                completed = True
                        usage = chunk.get("usageMetadata") or {}
                        if usage:
                            yield ProviderEvent("usage", {
                                "inputTokens": usage.get("promptTokenCount"),
                                "outputTokens": usage.get("candidatesTokenCount"),
                            })
                    if not completed:
                        raise ProviderError("provider_incomplete_stream", "The AI provider stream ended unexpectedly.", retryable=True)
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout", "The AI provider timed out.", retryable=True) from error
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "The AI provider could not be reached.", retryable=True) from error

    async def health(self, model: str) -> dict[str, object]:
        model_name = quote(model.removeprefix("models/"), safe="")
        try:
            async with self.client(health=True) as client:
                response = await client.get(f"{GOOGLE_API}/models/{model_name}", headers=self.headers())
                await self.checked(response)
        except httpx.HTTPError as error:
            raise ProviderError("provider_unreachable", "Provider health check failed.", retryable=True) from error
        return {"ok": True, "model": model, "modelFound": True}
