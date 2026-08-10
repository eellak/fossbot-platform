# FOSSBot Buddy security and privacy review — 2026-07-31

## Decision summary

- AI access is disabled and denied by default; only administrators mutate providers/settings/policies or inspect resolution.
- Policy precedence is deterministic. Active multi-group denies win at group scope; a user rule can finally override the group result.
- Hosted credentials are encrypted at rest, write-only through the API, never included in public provider metadata, prompts, frontend bundles, or usage rows.
- Usage is content-free and bounded to 1–365 days. Local reporting is opt-in and policy checked.
- Context/suggestion schemas reject extra fields, oversize data, stale revisions, unknown operations, data URLs, invalid Python/XML/activity/stage structures, and autonomous mission/scoring changes.
- Hosted responses are streamed with connect/read/write/pool timeouts, a 2 MiB response ceiling, no redirect following, safe error messages, and terminal-event enforcement.
- Browser output is rendered as text/code, not provider HTML; there is no `dangerouslySetInnerHTML` in the AI surfaces.
- User-local endpoint/model preferences use local storage; optional credentials use session storage and do not traverse the FOSSBot backend.

## Endpoint review

Hosted OpenAI-compatible base URLs require HTTP(S), a hostname, and no credentials/query/fragment. Relative paths cannot be absolute, contain `..`, or change origin. DNS results are rejected when private, loopback, link-local, reserved, multicast, or unspecified unless an administrator opts into private networking. Redirects are not followed.

**Residual DNS-rebinding assumption:** validation resolves the hostname before the HTTP client opens its connection; the current client does not pin that resolved address. Deploy hosted-compatible access behind an egress proxy/firewall that blocks private metadata and internal networks, especially when accepting third-party hostnames. Do not treat application validation as the only network boundary.

The private-network opt-in is only for trusted administrator-managed endpoints. User-local URLs are browser-direct and cannot change backend hosted configuration or trigger backend requests.

## Secrets and logs

Production requires `AI_SECRET_ENCRYPTION_KEY`. Provider responses expose `hasSecret` only. Rotation/preservation/clear are explicit. Login request-body logging was removed because it could include plaintext credentials. Provider exception details and raw response bodies are not returned or logged.

Verification must inspect logs, network responses, database rows/dumps, built frontend assets, local/session storage, and service-worker/cache entries for known canary values. Never place a real credential or student record in a test canary.

## Retention and deletion

`ai_instance_settings.usage_retention_days` defaults to 30 and is bounded to 1–365. Expired usage is deleted when settings are updated and before recording a new event. This is opportunistic enforcement, not a guaranteed wall-clock deletion job; deployments that require exact-time deletion should add an administrator-operated scheduled purge in infrastructure.

## Remaining limitations

- Real provider terms, regional processing, pricing, and retention need deployment-specific review.
- WebLLM model artifacts are third-party downloads; administrators should provide integrity metadata and license review. A browser cache is not encrypted by this feature.
- User-local CORS/TLS/server security is controlled by the user and local runtime.
- No supported browser/hardware combination is guaranteed; WebGPU requires a secure context and compatible device.
- This review does not claim penetration testing or real-provider red-team coverage.
