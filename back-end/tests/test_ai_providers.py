import asyncio
import json
import socket

import httpx
import pytest

from utils.ai.providers.base import MAX_PROVIDER_RESPONSE_BYTES, ProviderError, validate_endpoint
from utils.ai.providers.google import GoogleProvider
from utils.ai.providers.openai import OpenAIProvider
from utils.ai.providers.openai_compatible import OpenAICompatibleProvider
from utils.ai.schemas import ConversationTurn, ProviderStreamRequest


def provider_request():
    return ProviderStreamRequest(
        model="test-model",
        system="Safe system prompt",
        messages=[ConversationTurn(role="user", content="Hello")],
    )


async def collect(provider):
    return [(event.type, event.data) async for event in provider.stream(provider_request())]


def test_all_hosted_adapters_emit_the_same_product_events(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])

    compatible_body = "".join((
        f"data: {json.dumps({'choices': [{'delta': {'content': 'Hi'}, 'finish_reason': None}]})}\n\n",
        f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 3, 'completion_tokens': 1}})}\n\n",
        "data: [DONE]\n\n",
    ))
    openai_body = "".join((
        f"data: {json.dumps({'type': 'response.output_text.delta', 'delta': 'Hi'})}\n\n",
        f"data: {json.dumps({'type': 'response.completed', 'response': {'usage': {'input_tokens': 3, 'output_tokens': 1}}})}\n\n",
    ))
    google_body = f"data: {json.dumps({'candidates': [{'content': {'parts': [{'text': 'Hi'}]}, 'finishReason': 'STOP'}], 'usageMetadata': {'promptTokenCount': 3, 'candidatesTokenCount': 1}})}\n\n"

    def transport(body):
        return httpx.MockTransport(lambda request: httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body))

    providers = (
        OpenAICompatibleProvider(secret=None, base_url="https://example.test/v1", settings={"allowPrivateNetwork": False}, transport=transport(compatible_body)),
        OpenAIProvider(secret="secret", base_url=None, settings={}, transport=transport(openai_body)),
        GoogleProvider(secret="secret", base_url=None, settings={}, transport=transport(google_body)),
    )
    for provider in providers:
        events = asyncio.run(collect(provider))
        assert [kind for kind, _ in events] == ["text_delta", "usage"]
        assert events[0][1] == {"text": "Hi"}
        assert events[1][1] == {"inputTokens": 3, "outputTokens": 1}


def test_malformed_and_incomplete_compatible_streams_are_normalized(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    malformed = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text="data: not-json\n\n")),
    )
    with pytest.raises(ProviderError, match="invalid stream"):
        asyncio.run(collect(malformed))

    incomplete = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text=f"data: {json.dumps({'choices': []})}\n\n")),
    )
    with pytest.raises(ProviderError) as error:
        asyncio.run(collect(incomplete))
    assert error.value.code == "provider_incomplete_stream"


def test_ssrf_guard_requires_explicit_private_network_opt_in(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 11434))])
    with pytest.raises(ProviderError) as error:
        validate_endpoint("http://localhost:11434/v1", allow_private_network=False)
    assert error.value.code == "private_network_blocked"
    assert validate_endpoint("http://localhost:11434/v1", allow_private_network=True) == "http://localhost:11434/v1"


def test_endpoint_rejects_credentials_fragments_and_non_http(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    for endpoint in ("ftp://example.test/v1", "https://user:pass@example.test/v1", "https://example.test/v1#secret"):
        with pytest.raises(ProviderError):
            validate_endpoint(endpoint, allow_private_network=False)


def test_compatible_provider_rejects_redirects_oversize_and_timeouts(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])

    redirect = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(307, headers={"location": "https://other.test/v1"})),
    )
    with pytest.raises(ProviderError) as redirected:
        asyncio.run(collect(redirect))
    assert redirected.value.code == "provider_rejected"

    oversized = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text="data: " + ("x" * (MAX_PROVIDER_RESPONSE_BYTES + 1)) + "\n\n")),
    )
    with pytest.raises(ProviderError) as too_large:
        asyncio.run(collect(oversized))
    assert too_large.value.code == "provider_response_too_large"

    def timeout(request):
        raise httpx.ReadTimeout("timed out", request=request)

    timed_out = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(timeout),
    )
    with pytest.raises(ProviderError) as timeout_error:
        asyncio.run(collect(timed_out))
    assert timeout_error.value.code == "provider_timeout"
    assert timeout_error.value.retryable is True
