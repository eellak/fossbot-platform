# FOSSBot Buddy administrator guide

FOSSBot Buddy is deny-by-default. An administrator must configure an enabled provider, enable the instance, and create an allow rule for each capability before users receive access.

## Production prerequisites

Run database migrations before enabling AI. Set `AI_SECRET_ENCRYPTION_KEY` to a stable Fernet key in production; startup and credential writes must not rely on the development `SECRET_KEY` fallback. Keep the development-only `AI_ENABLE_TEST_PROVIDER` disabled in production.

Back up the database before rotating the encryption key. Existing provider credentials are encrypted at rest with the old key and cannot be recovered with a replacement key.

## Provider setup

Open **Administration → AI assistant**. Add one provider, leave it disabled while reviewing the configuration, then run its health test.

- **OpenAI / hosted**: enter a dated model ID and the API credential. Optional organization/project values are non-secret settings.
- **Google / hosted**: enter the exact Gemini model code and credential.
- **OpenAI-compatible / hosted**: enter a credential-free absolute base URL. Private/link-local/loopback/reserved destinations are blocked unless **Allow private network** is explicitly enabled. The relative path cannot escape the base URL.
- **WebLLM / browser**: enter credential-free HTTPS model/WASM URLs, exact model ID, declared byte/memory requirements, cache backend, license URL, required WebGPU features, and optional integrity metadata. A user must still consent before a model download.
- **OpenAI-compatible / user local**: the admin publishes only the provider policy/metadata. Each user enters their own endpoint/model in the browser; their optional key is held in session storage and is never sent to FOSSBot's backend.

Credentials are write-only: API responses expose `hasSecret`, never the value. Editing a provider requires an explicit **preserve**, **rotate**, or **clear** action. Test after rotation, then disable the old credential at its issuer.

**Remove** deletes a provider after a confirmation. Removal clears it as the instance default and drops it from policy rules; an allow rule left with no providers is deleted rather than widened to every provider. Usage history keeps the recorded provider name and model, so token/latency reports stay readable. Removal cannot be undone, so health-test the replacement provider before removing the old one.

## Instance settings and limits

Choose the default provider, optional daily request/token ceilings, whether content-free local usage counts should be reported, and usage retention from 1–365 days (default 30). Retention is enforced when settings change and before a new usage event is recorded. Disabling the instance revokes every capability immediately.

Provider limits and instance limits combine using the smallest configured value. Usage contains identifiers, timestamps, capability/runtime, outcome, policy/prompt versions, and optional token counts—never prompts, responses, source code, Blockly XML, lesson/stage bodies, answers, or credentials.

## Policy resolution

Create a separate rule for each capability. Precedence is:

`instance → role → active class group → user`

The last matching scope wins. Among multiple active class-group rules, any deny wins; otherwise provider/runtime allowlists are combined. An unrestricted allow at that group level keeps the group unrestricted. Disabled providers are removed after policy resolution.

Use **Resolve access** with a real user and capability after every policy change. Confirm the winning scope/rule, reason code, allowed provider IDs/runtimes, selected default, and effective limits. Test a student in multiple active groups and a final user override. Revocation is immediate for the next request; an open local/browser run is cancelled when refreshed access no longer permits it.

## Safe rollout

1. Configure and health-test a disabled provider.
2. Enable only explanation capabilities for an administrator/test teacher.
3. Review provider disclosure, usage retention, logs, and failure states.
4. Add teacher suggestion capabilities; verify preview/apply/undo and manual publication.
5. Add a small student group with hint-first explanation only.
6. Resolve representative users, then widen access deliberately.

## Troubleshooting

- **Provider unavailable**: provider is disabled, filtered by the winning rule, or its runtime is not allowed.
- **Private network blocked**: keep it blocked for public hosted services. Enable only for a trusted administrator-managed LAN endpoint after network review.
- **Health succeeds but streaming fails**: verify the exact model ID, relative chat path, SSE compatibility, output limits, and reverse-proxy buffering.
- **Browser model unavailable**: require HTTPS, WebGPU, sufficient device/storage limits, and explicit download consent. Clear the cached model from the assistant panel before retrying a changed manifest.
- **User-local endpoint fails**: the user must start the local server, permit browser CORS, use its OpenAI-compatible chat endpoint, and keep the page open for session-only credentials.
- **Quota/rate limit**: wait for the displayed retry window or change an approved limit; do not bypass policy with a different provider.
- **Malformed/oversized response**: the request fails closed. Inspect provider compatibility without logging raw content.

The deterministic provider at `/api/ai/test/mock/v1` is for development regression tests only. Never expose or recommend it as a real model.
