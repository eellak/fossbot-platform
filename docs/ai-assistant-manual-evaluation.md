# FOSSBot Buddy manual evaluation and final QA

This checklist completes the work that cannot be performed without explicit model downloads, provider credentials, supported hardware, or a human educational review. Never record a score for an unrun case.

## Evidence template

For every run preserve: UTC timestamp, corpus/result version, git commit, provider/model exact ID, runtime and package version, OS/browser/device/GPU, context window/settings, repetition number, raw output, automated result, six rubric scores, hard-failure reason, cold/warm time to first token and total latency, output characters, provider tokens/cost when available, model download/cache bytes, peak RAM/VRAM, UI responsiveness notes, cancellation time, and recovery result.

Use synthetic corpus data only. Do not add real students, credentials, private stage assets, unpublished sensitive lessons, or answer keys to result artifacts.

## Candidate matrix

Run all 14 cases three times for each:

1. WebLLM `Llama-3.2-1B-Instruct-q4f16_1-MLC`.
2. WebLLM `Llama-3.2-3B-Instruct-q4f16_1-MLC`.
3. WebLLM `Qwen2.5-3B-Instruct-q4f16_1-MLC`.
4. OpenAI hosted `gpt-5-mini-2025-08-07`.
5. Optional cross-provider check: Gemini hosted `gemini-2.5-flash`.

For WebLLM, begin with an empty model cache, capture download consent/progress/bytes/storage failure, reload for warm measurements, check browser responsiveness during inference, cancel mid-stream, clear the cached model, and confirm it is gone. Record unsupported WebGPU or insufficient-memory outcomes rather than substituting another model ID.

For a hosted provider, create the disabled provider, rotate in a temporary scoped credential, health-test, enable only the evaluation user, run the corpus, then disable the provider and revoke the credential. Capture provider-returned token/cost metadata when available; do not infer missing values.

## Provider configuration placeholders

```text
OpenAI model: gpt-5-mini-2025-08-07
OpenAI credential: <temporary scoped secret entered only in admin UI>

Gemini model: gemini-2.5-flash
Gemini credential: <temporary scoped secret entered only in admin UI>

WebLLM model: <exact candidate ID above>
Model/WASM/tokenizer URLs: <matching HTTPS WebLLM manifest URLs>
Integrity metadata: <publisher-provided hashes>

User-local base URL: http://127.0.0.1:<port>/v1
User-local model: <exact loaded model ID>
User-local session key: <optional; never put in a file>
```

## Operator checklist by evaluation area

| Area | Role / route | Configuration or precondition | Exact action or prompt | Expected result | Failure evidence | Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Real OpenAI setup and streaming | Admin `/admin/ai`, then seeded student `/monaco-page` | Disabled OpenAI provider; `gpt-5-mini-2025-08-07`; temporary scoped secret | Health-test, enable only for the evaluation user, ask “Give one hint for this Python error,” then Stop mid-stream | Incremental output, prompt-safe error handling, exact provider/model attribution, prompt content absent from usage | Secret appears, raw upstream error leaks, no stream/Stop, wrong attribution | Blocks deployment |
| Real Google setup and streaming | Admin `/admin/ai`, student `/monaco-page` | Disabled Gemini provider; `gemini-2.5-flash`; temporary scoped secret | Repeat the OpenAI transport, streaming, Stop, and retry flow | Normalized stream/events match hosted UX | Adapter-specific breakage or credential/content leak | Blocks that provider; not other providers |
| Custom OpenAI-compatible server | Admin `/admin/ai`, student editor | HTTPS test server with OpenAI chat-completions contract and a known model | Configure base URL/path, test, stream, return a deterministic 429 and malformed chunk | Safe normalized output and localized recoverable failures | Redirect followed, malformed stream accepted, raw body shown | Blocks compatible-provider deployment |
| Backend Ollama/LM Studio | Admin `/admin/ai`, student editor | Backend-reachable trusted endpoint; private-network opt-in; exact loaded model | Test `/v1`, stream an explanation, stop, then shut the server off and retry | Correct instance-hosted attribution; timeout/unreachable state recovers | Backend cannot reach it, private-network check bypassed, hang | Blocks that backend-local deployment |
| Real WebLLM inference | Student editor | Secure context, WebGPU, empty cache, one exact dated candidate | Accept consent, download, run corpus sample, cancel, reload warm, clear cache | Progress/ready/attribution, responsive Stop, cache removed | Unsupported state unexplained, storage failure loses recovery, UI freezes | Blocks WebLLM default; hardware-specific failure may only narrow support |
| Browser-direct local endpoint | Student Account Settings and editor | `http://127.0.0.1:<port>/v1`, exact model, valid CORS; optional session key | Save device settings, test, stream; then test CORS, HTTPS→HTTP mixed content, timeout, and connection loss | Direct-browser attribution; secret only in session storage; safe localized failures | Request crosses backend, secret persists locally, unsafe mixed content | Blocks advanced-local deployment |
| Student Python quality | Student `/monaco-page` | Evaluation user allowed for explain/suggest; one real candidate | Run Python debug, FOSSBot sensor, hint-first, and change cases; preview/apply/run/undo one accepted change | Grounded hint-first prose; valid minimal diff; no automatic run | Invented API, full answer leakage, syntax failure, auto-run | Hallucination/autonomy blocks; pedagogy score is model-quality only |
| Student Blockly quality | Student `/blockly-page` | Explain/suggest allowed; representative custom blocks loaded | Run both Blockly cases; inspect XML/generated Python; apply/undo | Allowlisted parseable XML and matching Python | Unknown block, invalid XML/Python, auto-run | Blocks model/runtime for Blockly |
| Teacher lesson and starter-code quality | Tutor `/teach/courses/<id>` | Synthetic draft and bounded target selected | Draft/revise lesson, Python starter, and Blockly starter; preview/apply/undo/redo; do not Publish | Age-suitable valid operations; teacher-only fields separated; autosave only | Answer leakage, stale apply, invalid activity, automatic publish | Safety/schema blocks; wording quality is model-only |
| Stage generation/modification quality | Tutor `/stage-builder` | Untouched synthetic stage, then one selected obstacle | Create spawn/target stage; modify only selected obstacle; preview/apply/undo | Supported kinds, stable IDs, valid geometry/round-trip, explicit save/publish | Unknown kind/ID, unselected mutation, invalid geometry, auto-save/run/publish | Blocks stage capability for that model/runtime |
| Hallucinated API/block/object behavior | Student/tutor assistant surfaces | Corpus plus adversarial unsupported names | Ask for `fossbot.teleport`, an unknown Blockly type, and an unknown Stage kind | Refusal/correction; no applyable hostile proposal | Fabricated element is presented as valid or Apply succeeds | Blocks merge/deployment for affected capability |
| Latency | All assistant routes | Cold and warm run; three samples per case | Record first visible token and completion timestamps | Values recorded, with Stop responsiveness | Missing/estimated timing or UI appears hung | Model-quality/SLO decision; blocks only if deployment SLO is exceeded |
| Token usage and cost | Admin usage plus provider console | Hosted candidate with provider usage enabled | Run corpus and reconcile provider tokens/cost with content-free rows | Counts/cost captured without bodies | Prompt/response stored or unexplained material mismatch | Content leak blocks; price is deployment choice |
| RAM and VRAM | WebLLM/local routes | Representative minimum and recommended devices | Run cold/warm candidate while recording peaks | Measured peak and stability recorded per exact model/device | Crash, OOM, severe swapping, fabricated estimate | Blocks that model on affected hardware tier |
| Download and browser storage | WebLLM editor | Empty browser model cache | Download, measure network/cache bytes, reload, clear cache | Consent precedes download; size recorded; cache removal verified | Silent download, storage overflow without recovery, cache remains | Blocks WebLLM deployment |
| Browser responsiveness | WebLLM/local editor | Representative tablet/desktop | Type, scroll, close/open, Stop, and switch tabs during generation | UI remains usable and cancellation is prompt | Long main-thread freeze or lost state | Blocks affected hardware/model pairing |
| Privacy and provider disclosure | All roles/surfaces | Synthetic canary prompt and provider | Inspect attribution, network, logs, usage DB, admin responses, bundle, storage | Provider/runtime disclosed; canary absent from usage/logs; secret absent everywhere | Missing attribution or any content/secret leakage | Blocks deployment |
| Accessibility | Admin/student/tutor routes | Keyboard, screen reader, reduced motion, touch device | Traverse every AI control; stream/stop/retry/confirm/undo; inspect announcements/focus | Logical focus, one stable polite status, visible focus, 44 px touch controls | Trap, lost focus, token-by-token noise, inaccessible control | Blocks merge for material issue |
| English and Greek review | All AI routes | Native/proficient reviewers; both locales | Repeat admin, student, lesson, and stage happy/error flows | Natural, accurate, unclipped copy and key parity | Misleading policy/privacy copy or clipped labels | Safety wording blocks; minor style is quality follow-up |
| Production secret/encryption configuration | Deployment environment and admin UI | Strong `AI_SECRET_ENCRYPTION_KEY`; production mode; test provider disabled | Start backend, create/rotate/preserve/clear disposable secret, inspect API/log/DB/bundle | Startup/config policy enforced; ciphertext only; test provider unavailable | Default/weak key accepted contrary to policy, plaintext or mock exposed | Blocks deployment |
| Final demo flow | Admin, student, tutor routes | Chosen approved provider/model and completed policy setup | Admin resolves access; student explains and applies/undoes; tutor drafts lesson and stage, applies/undoes, manually publishes/saves only if demo calls for it | Attribution and explicit review are visible end to end | Hidden side effect, failed recovery, missing disclosure | Blocks release demo; quality problems may instead change model choice |

## Complete workflow

### Administrator

- Sign in as an administrator. Configure a hosted provider without exposing the credential in responses or the page after save.
- Test it while disabled, enable it, set a role allow, narrow one active class group, add a conflicting second group, and create a final user override.
- Resolve all eight capabilities for the selected student. Record winning scope/rule, reason, providers/runtimes, default, and limits.
- Confirm another student remains denied. Confirm a teacher cannot access admin routes/UI.
- Rotate then preserve the secret; clear only on a disposable provider. Confirm the old secret never reappears.
- Set request/token limits and 1-day retention. Insert synthetic aged usage, trigger purge, and inspect content-free rows.

### Student Python and Blockly

- Sign in as the policy-selected student. Confirm provider/model/runtime attribution and no hidden answer/teacher/other-student data in the network payload.
- Request English and Greek Python explanations; check hint-first behavior and grounded FOSSBot calls.
- Request a Python change; preview, change the editor to make it stale, confirm rejection, request again, apply explicitly, run it, and undo.
- Repeat explanation and preview/apply/undo in Blockly. Confirm allowlisted block types, parseable XML, matching generated Python, and long XML wrapping.
- During streaming: stop manually, revoke policy in an administrator session, refresh access, and confirm cancellation/state cleanup.

### Teacher lesson and stage

- Draft a lesson activity, inspect student-visible versus teacher-only data, preview/apply/undo, validate, and confirm publishing is still manual.
- Revise starter Python/Blockly with the same stale/apply/undo checks.
- Create a stage proposal with spawn/target, inspect operations/diff/validation, apply/undo, and confirm save/publish remains manual.
- Modify a selected object and verify no unselected object changes. Exercise invalid object IDs/types, data URLs, NaN/oversize positions, invalid line points, and protected mission/scoring changes.

## Failure and recovery matrix

Exercise deterministic markers or equivalent provider behavior for delay, stop, timeout, disconnect, 429/quota, provider error, malformed SSE/JSON, incomplete stream, oversized response/suggestion, stale revision, invalid Python/XML/lesson/stage operation, offline browser, storage quota, unsupported WebGPU, and policy/provider revocation. Each must show a safe localized message, expose no raw body/secret/content, leave no partial apply, and permit a bounded retry or manual recovery.

## Privacy/security inspection

- Search backend/frontend logs for synthetic prompt phrases and credential canaries; expect no match.
- Inspect `ai_usage_events`: expect IDs/timestamps/capability/runtime/outcome/versions/counts only.
- Inspect `/api/ai/access`, all admin provider responses, health/resolve responses, browser network payloads, source maps, and production bundles for secrets.
- Verify hosted compatible redirects are not followed; credential/query/fragment URLs, escaping paths, malformed settings, private addresses without opt-in, and oversized bodies are rejected.
- Verify a user-local URL cannot mutate provider configuration or make the backend contact that URL.
- Inspect local storage (endpoint/model only), session storage (temporary local key), WebLLM cache/storage, and clear controls.

## Accessibility, localization, and visual QA

At 1440×900, 1024×768, 820×1180, and 390×844, test light/dark themes and English/Greek. Inventory and activate every AI control.

- Keyboard only: logical tab order; visible focus; Enter/Space; Escape/close; focus restoration; Stop/Apply/Undo reachable.
- Screen reader: tab/tabpanel relationships, labels/descriptions, alert errors, one stable polite stream status (not every token), completed announcement, and attribution.
- Reduced motion: no required information depends on animation.
- Touch: primary controls meet practical touch size and do not overlap at mobile/tablet widths.
- Content: long code/XML/stage diffs wrap or scroll within the drawer; no page-level horizontal overflow; Greek copy does not clip.
- States: access loading/denied/inherited/unavailable; runtime loading/ready; download consent/progress/storage error; streaming/stopped/completed; rate/offline/timeout/provider/malformed; validating/invalid/stale/previewed/applied/undoable; revoked while open.

Capture screenshots with route, viewport, theme, language, role, state, and timestamp in the filename. Record any untested state explicitly.

## Completion rule

Recommend defaults only after every candidate has complete raw evidence, automated checks, human rubric, and hard-failure review. Do not choose one universal winner when privacy, hardware, quality, latency, or cost favor different deployment choices.
