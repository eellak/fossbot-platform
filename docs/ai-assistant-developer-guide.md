# FOSSBot Buddy developer guide

## Architecture and versions

The backend owns policy resolution, hosted provider credentials/requests, context assembly, prompt construction, quotas, suggestion validation, and content-free usage records. The frontend owns surface integration, previews/apply/undo, WebLLM workers/cache, and browser-direct user-local requests.

Current contracts:

- capability registry, access/admin schema, and policy: version `1`;
- context: version `1`, maximum encoded context 48,000 characters;
- prompt: `fossbot-assistant-v2`, FOSSBot API reference version `1`;
- suggestion schemas: version `1`, maximum provider suggestion 32,000 characters;
- runtime interface and local device settings: version `1`;
- evaluation corpus/results: version `1`.

Capabilities are `code.explain`, `code.suggest_changes`, `blockly.explain`, `blockly.suggest_changes`, `lesson.draft`, `lesson.suggest_changes`, `stage.create`, and `stage.suggest_changes`.

## Request flow

1. `GET /api/ai/access` resolves the authenticated user's current policy and returns secret-free provider metadata.
2. The frontend selects a permitted runtime through `AIAssistantRuntime`.
3. Hosted requests use `POST /api/ai/assist/stream`; context is strictly parsed/truncated and a versioned prompt is built.
4. Provider SSE becomes typed `start`, `text_delta`, `suggestion`, `usage`, `done`, or `error` events.
5. Suggestions are parsed twice: backend structural/domain validation and frontend surface validation against the current fingerprint/revision.
6. The surface shows a preview. Apply/undo remains local to the editor; save/publish stays in the normal product workflow.

WebLLM and user-local runtimes implement the same event interface in the browser. Optional `POST /api/ai/usage` reports only bounded counts/outcomes after policy is checked.

## Adding a provider or capability

Do not add a provider by bypassing the registry. Add the provider/runtime pair and strict admin settings allowlist, implement the provider adapter with safe error mapping and bounded streaming, expose only public metadata, add policy/secret/SSRF/malformed-response tests, then document its processing route.

For a capability, update the registry, strict context model/assembler, prompt boundary, suggestion schema and validator if mutating, surface preview/apply/undo, translations, policy tests, synthetic corpus, and manual rubric. Increment affected versions when compatibility changes.

Generated content must never execute as HTML. Render plain text/code or an explicitly safe Markdown subset. Reject data URLs, scripts, unknown operation types/IDs, invalid schemas, stale fingerprints, and oversized payloads.

## Testing

The development Compose stack seeds `fossbot-test` only when `AI_ENABLE_TEST_PROVIDER=true`. It provides deterministic success, non-stream health, delay, timeout, error, malformed suggestion, and rate-limit markers. It is hidden from OpenAPI and guarded by the environment flag.

Run the AI tests and evaluation validator inside the backend environment:

```bash
pytest -q tests/test_ai_*.py tests/test_dev_seed.py
python tools/ai_evaluation.py --corpus ../evaluation/ai/corpus-v1.json --results ../evaluation/ai/results/mock-baseline-2026-07-31.json
```

Then build the frontend and execute the interaction/accessibility checklist in `docs/ai-assistant-manual-evaluation.md`. Inspect backend/frontend logs and the usage table for leakage using identifiers only—never reproduce raw prompt content in logs.
