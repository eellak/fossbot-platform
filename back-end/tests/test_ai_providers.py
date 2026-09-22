import asyncio
import json
import socket

import httpx
import pytest

from utils.ai.providers.base import MAX_PROVIDER_RESPONSE_BYTES, ProviderError, validate_endpoint
from utils.ai.providers.google import GoogleProvider
from utils.ai.providers.openai import OpenAIProvider, _openai_text_format
from utils.ai.providers.openai_compatible import OpenAICompatibleProvider
from utils.ai.providers.compatibility_profiles import PROFILES, resolve_compatibility_profile
from utils.ai.schemas import ConversationTurn, ProviderStreamRequest


def provider_request():
    return ProviderStreamRequest(
        model="test-model",
        system="Safe system prompt",
        messages=[ConversationTurn(role="user", content="Hello")],
    )


async def collect(provider):
    return [(event.type, event.data) async for event in provider.stream(provider_request())]


async def collect_request(provider, request):
    return [(event.type, event.data) async for event in provider.stream(request)]


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
        public_events = [(kind, data) for kind, data in events if kind not in {"metadata", "finish"}]
        assert [kind for kind, _ in public_events] == ["text_delta", "usage"]
        assert public_events[0][1] == {"text": "Hi"}
        assert public_events[1][1]["inputTokens"] == 3
        assert public_events[1][1]["outputTokens"] == 1


def test_openai_provider_delivers_a_response_truncated_by_the_output_budget(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    body = "".join((
        f"data: {json.dumps({'type': 'response.output_text.delta', 'delta': 'Partial'})}\n\n",
        f"data: {json.dumps({'type': 'response.incomplete', 'response': {'incomplete_details': {'reason': 'max_output_tokens'}, 'usage': {'input_tokens': 3, 'output_tokens': 1024}}})}\n\n",
    ))
    provider = OpenAIProvider(
        secret="secret",
        base_url=None,
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)),
    )
    events = asyncio.run(collect(provider))
    assert ("text_delta", {"text": "Partial"}) in events
    assert ("usage", {"inputTokens": 3, "outputTokens": 1024}) in events
    assert ("finish", {"finishReason": "max_output_tokens"}) in events


def test_openai_provider_uses_responses_structured_output_without_storage(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    requests = []
    body = f"data: {json.dumps({'type': 'response.completed', 'response': {'usage': {'input_tokens': 3, 'output_tokens': 1}}})}\n\n"

    def transport(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    provider = OpenAIProvider(secret="secret", base_url=None, settings={}, transport=httpx.MockTransport(transport))
    schema = {"type": "object", "properties": {"version": {"const": "1"}}, "required": ["version"], "additionalProperties": False}
    request = provider_request().model_copy(update={"response_schema": schema})
    asyncio.run(collect_request(provider, request))

    assert requests[0]["store"] is False
    output_format = requests[0]["text"]["format"]
    assert output_format["type"] == "json_schema"
    assert output_format["name"] == "fossbot_assistant_suggestion"
    assert output_format["strict"] is True
    assert output_format["schema"]["required"] == ["version"]


def test_openai_structured_output_wraps_root_unions_and_falls_back_for_free_form_objects():
    replace = {"type": "object", "properties": {"type": {"const": "python_replace"}}, "required": ["type"], "additionalProperties": False}
    edits = {
        "type": "object",
        "properties": {"version": {"const": "1"}, "type": {"const": "python_edits"}, "edits": {"type": "array", "items": {"type": "string"}}},
        "required": ["type", "edits"],
        "additionalProperties": False,
    }
    output_format = _openai_text_format({"anyOf": [replace, edits]})
    assert output_format["type"] == "json_schema"
    assert output_format["schema"]["required"] == ["outcome"]
    branches = output_format["schema"]["properties"]["outcome"]["anyOf"]
    assert {branch["properties"]["type"]["enum"][0] for branch in branches} == {"python_replace", "python_edits"}

    answer = {"type": "object", "properties": {"type": {"const": "answer"}}, "required": ["type"], "additionalProperties": False}
    answer_format = _openai_text_format({"anyOf": [answer, replace, edits]})
    assert answer_format["type"] == "json_schema"
    assert {branch["properties"]["type"]["enum"][0] for branch in answer_format["schema"]["properties"]["outcome"]["anyOf"]} == {"answer", "python_replace", "python_edits"}
    assert _openai_text_format({"type": "object", "additionalProperties": True}) == {"type": "json_object"}


def test_openai_provider_still_rejects_a_stream_without_a_terminal_event(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    body = f"data: {json.dumps({'type': 'response.output_text.delta', 'delta': 'Partial'})}\n\n"
    provider = OpenAIProvider(
        secret="secret",
        base_url=None,
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)),
    )
    with pytest.raises(ProviderError) as error:
        asyncio.run(collect(provider))
    assert error.value.code == "provider_incomplete_stream"


def test_compatible_profiles_build_provider_specific_structured_requests():
    schema = {"type": "object", "properties": {"version": {"const": "1"}}, "required": ["version"]}
    openrouter = resolve_compatibility_profile({}, "https://openrouter.ai/api/v1")
    assert openrouter.id == "openrouter"
    openrouter_options = openrouter.request_options(schema=schema, deterministic=True)
    assert openrouter_options["response_format"]["json_schema"]["schema"] == schema
    assert "reasoning" not in openrouter_options
    assert openrouter_options["provider"] == {"require_parameters": True}
    assert openrouter_options["temperature"] == 0 and openrouter_options["seed"] == 7

    llama_options = PROFILES["llamacpp"].request_options(schema=schema, deterministic=False)
    assert llama_options["reasoning_effort"] == "none"
    assert llama_options["response_format"] == {"type": "json_object"}
    assert PROFILES["ollama"].status == "stub"
    assert PROFILES["openai"].status == "stub"


def test_openrouter_retries_without_schema_when_model_route_rejects_it(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    requests = []
    response_text = '{"ok":true}'
    body = "".join((
        f"data: {json.dumps({'choices': [{'delta': {'content': response_text}, 'finish_reason': None}]})}\n\n",
        f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}\n\n",
        "data: [DONE]\n\n",
    ))

    def transport(request):
        requests.append(json.loads(request.content))
        if len(requests) == 1:
            return httpx.Response(404, json={"error": {"message": "No endpoints support the requested parameters"}})
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    provider = OpenAICompatibleProvider(
        secret="secret",
        base_url="https://openrouter.ai/api/v1",
        settings={"compatibilityProfile": "openrouter"},
        transport=httpx.MockTransport(transport),
    )
    request = provider_request().model_copy(update={
        "response_schema": {"type": "object"},
        "deterministic": True,
    })
    events = asyncio.run(collect_request(provider, request))

    assert requests[0]["response_format"]["type"] == "json_schema"
    assert requests[0]["provider"] == {"require_parameters": True}
    assert "reasoning" not in requests[0]
    assert "response_format" not in requests[1]
    assert "provider" not in requests[1]
    assert requests[1]["seed"] == 7
    fallback = next(data for kind, data in events if kind == "metadata" and data.get("structuredOutputFallback"))
    assert fallback["upstreamStatus"] == 404
    assert ("text_delta", {"text": '{"ok":true}'}) in events


def test_llamacpp_uses_simple_json_mode_and_falls_back_to_prompt_validation(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    requests = []
    response_text = '{"ok":true}'
    body = "".join((
        f"data: {json.dumps({'choices': [{'delta': {'content': response_text}, 'finish_reason': None}]})}\n\n",
        f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}\n\n",
        "data: [DONE]\n\n",
    ))

    def transport(request):
        requests.append(json.loads(request.content))
        if len(requests) == 1:
            return httpx.Response(400, json={"error": {"message": "Unsupported response format"}})
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    provider = OpenAICompatibleProvider(
        secret=None,
        base_url="https://example.test/v1",
        settings={"compatibilityProfile": "llamacpp"},
        transport=httpx.MockTransport(transport),
    )
    request = provider_request().model_copy(update={"response_schema": {"type": "object"}})
    events = asyncio.run(collect_request(provider, request))

    assert requests[0]["response_format"] == {"type": "json_object"}
    assert requests[0]["reasoning_effort"] == "none"
    assert "response_format" not in requests[1]
    assert requests[1]["reasoning_effort"] == "none"
    fallback = next(data for kind, data in events if kind == "metadata" and data.get("structuredOutputFallback"))
    assert fallback["fallbackReason"] == "llamacpp_rejected_json_object"
    assert ("text_delta", {"text": response_text}) in events


def test_openrouter_retries_retryable_stream_error_before_output(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    requests = []
    error_body = f"data: {json.dumps({'error': {'code': 502, 'message': 'Provider unavailable', 'metadata': {'error_type': 'provider_unavailable'}}})}\n\n"
    success_body = "".join((
        f"data: {json.dumps({'choices': [{'delta': {'content': 'Hi'}, 'finish_reason': None}]})}\n\n",
        f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}\n\n",
        "data: [DONE]\n\n",
    ))

    def transport(request):
        requests.append(json.loads(request.content))
        body = error_body if len(requests) == 1 else success_body
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    provider = OpenAICompatibleProvider(
        secret="secret",
        base_url="https://openrouter.ai/api/v1",
        settings={"compatibilityProfile": "openrouter"},
        transport=httpx.MockTransport(transport),
    )
    events = asyncio.run(collect(provider))

    assert len(requests) == 2
    retry = next(data for kind, data in events if kind == "metadata" and data.get("providerRetry"))
    assert retry == {
        "compatibilityProfile": "openrouter",
        "profileStatus": "supported",
        "providerRetry": True,
        "retryAttempt": 1,
        "maxProviderRetries": 2,
        "upstreamStatus": 502,
        "errorType": "provider_unavailable",
        "responseStarted": False,
        "upstreamMessage": "Provider unavailable",
    }
    assert ("text_delta", {"text": "Hi"}) in events


def test_openrouter_does_not_retry_stream_error_after_output(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    requests = []
    body = "".join((
        f"data: {json.dumps({'choices': [{'delta': {'content': 'partial'}, 'finish_reason': None}]})}\n\n",
        f"data: {json.dumps({'error': {'code': 502, 'message': 'Provider unavailable', 'metadata': {'error_type': 'provider_unavailable'}}})}\n\n",
    ))

    def transport(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    provider = OpenAICompatibleProvider(
        secret="secret",
        base_url="https://openrouter.ai/api/v1",
        settings={"compatibilityProfile": "openrouter"},
        transport=httpx.MockTransport(transport),
    )
    with pytest.raises(ProviderError) as error:
        asyncio.run(collect(provider))

    assert len(requests) == 1
    assert error.value.retryable is True
    assert error.value.details["responseStarted"] is True


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


def test_compatible_provider_health_accepts_large_catalog_but_keeps_response_bound(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])

    large_catalog = json.dumps({"data": [{"id": "test-model", "description": "x" * (256 * 1024)}]})
    provider = OpenAICompatibleProvider(
        secret="secret",
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text=large_catalog)),
    )
    assert asyncio.run(provider.health("test-model")) == {"ok": True, "model": "test-model", "modelFound": True}

    oversized_catalog = json.dumps({"data": [{"id": "test-model", "description": "x" * MAX_PROVIDER_RESPONSE_BYTES}]})
    oversized = OpenAICompatibleProvider(
        secret="secret",
        base_url="https://example.test/v1",
        settings={},
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text=oversized_catalog)),
    )
    with pytest.raises(ProviderError) as too_large:
        asyncio.run(oversized.health("test-model"))
    assert too_large.value.code == "provider_response_too_large"
