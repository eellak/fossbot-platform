from __future__ import annotations

import ipaddress
import json
import socket
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional
from urllib.parse import urljoin, urlparse

import httpx

from utils.ai.schemas import ProviderStreamRequest


MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024
STREAM_TIMEOUT = httpx.Timeout(connect=5.0, read=45.0, write=10.0, pool=5.0)
HEALTH_TIMEOUT = httpx.Timeout(connect=3.0, read=8.0, write=5.0, pool=3.0)


class ProviderError(Exception):
    def __init__(self, code: str, message: str, *, retryable: bool = False, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.safe_message = message
        self.retryable = retryable
        self.status_code = status_code


@dataclass(frozen=True)
class ProviderEvent:
    type: str
    data: dict[str, Any]


def _is_private_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return bool(ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


def validate_endpoint(url: str, *, allow_private_network: bool) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ProviderError("invalid_provider_config", "Provider endpoint must be an absolute HTTP(S) URL.", status_code=422)
    if parsed.username or parsed.password or parsed.fragment:
        raise ProviderError("invalid_provider_config", "Provider endpoint cannot contain credentials or fragments.", status_code=422)
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise ProviderError("provider_unreachable", "Provider endpoint could not be resolved.", retryable=True) from error
    if not allow_private_network and any(_is_private_address(address) for address in addresses):
        raise ProviderError("private_network_blocked", "Private-network provider access is not enabled.", status_code=422)
    normalized_path = "/".join(part for part in parsed.path.split("/") if part)
    return parsed._replace(path=f"/{normalized_path}" if normalized_path else "", query="", fragment="").geturl().rstrip("/")


def endpoint_url(base_url: str, path: str) -> str:
    return urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))


async def iter_sse_data(response: httpx.Response) -> AsyncIterator[str]:
    consumed = 0
    data_lines: list[str] = []
    async for line in response.aiter_lines():
        consumed += len(line.encode("utf-8")) + 1
        if consumed > MAX_PROVIDER_RESPONSE_BYTES:
            raise ProviderError("provider_response_too_large", "Provider response exceeded the allowed size.")
        if not line:
            if data_lines:
                yield "\n".join(data_lines)
                data_lines = []
            continue
        if line.startswith(":"):
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if data_lines:
        yield "\n".join(data_lines)


def json_event(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ProviderError("provider_malformed_stream", "Provider returned an invalid stream.") from error
    if not isinstance(payload, dict):
        raise ProviderError("provider_malformed_stream", "Provider returned an invalid stream.")
    return payload


class HostedProvider(ABC):
    supports_streaming = True
    supports_schema_output = False

    def __init__(self, *, secret: Optional[str], base_url: Optional[str], settings: dict[str, Any], transport: Optional[httpx.AsyncBaseTransport] = None):
        self.secret = secret
        self.base_url = base_url
        self.settings = settings
        self.transport = transport

    def client(self, *, health: bool = False) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=HEALTH_TIMEOUT if health else STREAM_TIMEOUT,
            follow_redirects=False,
            transport=self.transport,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    @abstractmethod
    async def stream(self, request: ProviderStreamRequest) -> AsyncIterator[ProviderEvent]:
        raise NotImplementedError

    @abstractmethod
    async def health(self, model: str) -> dict[str, Any]:
        raise NotImplementedError

    @staticmethod
    async def checked(response: httpx.Response) -> None:
        if response.status_code < 300:
            return
        retryable = response.status_code in {408, 409, 429} or response.status_code >= 500
        code = "provider_rate_limited" if response.status_code == 429 else "provider_rejected"
        raise ProviderError(code, "The AI provider rejected the request.", retryable=retryable)
