# Barry Bear import investigation

Date: 2026-11-11. Scope: design evidence for SE-022, not an implementation or a complete reproduction of sluggish editing.

## Supplied asset

- File: `Barry Bear.stl`, supplied by the author through the upload path.
- SHA-256: `1bfeb28495d45f3431e03e2bc718b68945dce605ef271bd7bf1bc417f9222441`.
- Binary STL length: 22 473 484 bytes (21.43 MiB), exactly matching 84 + 50 × triangle count.
- Triangles: 449 468. Parsed position and normal buffers: 32 361 696 bytes, excluding other geometry, JavaScript overhead and GPU buffers.
- Native bounds: approximately 85.60 × 67.42 × 87.75 coordinate units. STL does not identify their physical unit. The importer fits the longest dimension to 0.5 m.
- Data URL: 29 964 670 characters, approximately 28.58 MiB of ASCII payload before other stage data. This is not an estimate of actual JavaScript string memory.

The supplied file was read without modification and was not copied into the repository.

## Actual editor observation

The existing Compose service was running on port 3100. In a separate browser session, submitting the file through the real custom-model input produced: “Custom object is too large. Keep OBJ/STL/GLB files under 10 MB for now.” The stage continued to show No changes and no model was added.

The source limit is 10 × 1024 × 1024 bytes. The guard runs before parsing in `handleImportCustomObject`. No guard was removed or bypassed in the editor. Consequently, selection, movement, saving, reopening and Run Test with this model were not exercised end to end. The original slowdown is not reproduced by this import attempt. On 12 November 2026, the author confirmed that the reported slowdown occurred on the live website. The deployed build, exact import route, browser, hardware and collision-wire state remain unverified.

## Isolated component measurements

A scratch browser page used this worktree's installed Three.js STLLoader, Box3 and EdgesGeometry. It reproduced the merge preparation used by the editor's collision-edge builder for a single identity-transformed mesh. It also exercised the recursive clone algorithm and JSON stringification on a small representative stage object containing the full data URL. These are component measurements, not timings of the complete React editor or its full save pipeline.

Environment: Headless Chrome 153 on Linux, 20 reported logical cores and 32 GiB reported device memory. The editor's renderer reported ANGLE SwiftShader software rendering. No representative user-device frame-rate claim is made. Each timed CPU operation ran three times, with a short yield between passes. Read and encoding were measured once. No CPU throttling was applied.

| Operation | Median of three runs |
| --- | ---: |
| STL parse | 16.4 ms |
| Bounding-box measurement | 8.3 ms |
| Collision-edge merge preparation | 59.4 ms |
| EdgesGeometry construction | 673.6 ms |
| JSON stringify with one embedded model | 17.4 ms |
| Recursive stage clone | Below the observed timer resolution |

Read: 6.7 ms. Data URL encoding: 38.9 ms. The edge builder emitted 325 736 line segments. A single localStorage write of the representative stage failed with QuotaExceededError after 8.5 ms on the scratch file origin. The test used its own key and removed only that key. This is not a quota measurement for every browser or for the production origin.

[Raw runs and browser details](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/barry-bear-profile/results.json) and the [isolated profile page](/home/jorgen/.codex/visualizations/2026/11/05/01a1acbf-febf-70d2-a89f-9d5ca9c71e8b/barry-bear-profile/profile.html) are retained outside the repository. To repeat, open the page and select the supplied STL. It does not upload the model to a server. The installed library is embedded for reproducibility.

## Interpretation and plan implications

1. Raising the byte limit alone is insufficient. This file exceeds current acceptance and also failed the isolated embedded-data storage test. A larger supported model budget requires a deliberate persistence strategy or an explicit smaller-asset workflow, not just a new constant.
2. Detailed edge construction is the largest measured CPU operation. In the editor it is conditional on visible collision wires. It is a specific candidate for lazy generation, caching or a bounded debug representation, not a demonstrated explanation of normal dragging with wires hidden. Inspect invalidation before deciding whether repeated construction contributes.
3. Do not assume history copies the base64 string on every clone. The current recursive clone returns primitive strings unchanged. The isolated clone was below timer resolution. Geometry duplication and long-lived history references may still retain memory, but this test does not establish a history bottleneck.
4. Imported-model picking currently uses a bounding-box proxy, so do not assume every click raycasts all 449 468 triangles. Crowded selection and rendering costs still need their own evidence.
5. The simulator's immovable-model collider path also prepares debug edges and a triangle mesh. Inspect when debug geometry is generated and measure collider creation separately. This investigation did not run physics or establish its cost.
6. Preserve the already identified recovery failure fixes: failed draft writes must not remove the previous draft, and Run Test must not delete recovery work to free space.

Before choosing a triangle threshold, reproduce a supported-size asset on the target device with wires off/on, then measure selection, dragging, history, save/reopen and Run Test. Agree whether Barry Bear itself must be supported unchanged or is a heavy reference for an import-limit/simplification workflow. No automatic simplification policy or storage migration is approved by this report. Do not silently reduce the author's model or claim the issue fixed.

## Live-site clarification, 12 November 2026

The author confirmed the live website as the location of the slowdown. Keep that report distinct from the observed rejection in this worktree. Local Git history shows the custom-object module already existed in July 2026, so do not assume the mismatch is simply a newly introduced limit without checking the deployed build and route. README identifies fossbot.gr as the platform URL. No live-site reproduction, account access or production-stage changes have occurred in this investigation. Next capture the browser/device and reproduce on a disposable stage, comparing deployed behaviour with this worktree. The issue stays open.

## Target hardware clarification, 12 November 2026

The author reports an Apple M3 Pro for the live-site slowdown. Browser, RAM, operating-system version and GPU acceleration status remain unspecified. Use M3 Pro as the reported hardware baseline, not the Linux headless SwiftShader environment used for component measurements. Do not attribute the complaint to low-end hardware or use software-rendered frame rates to set the supported workload. The existing CPU measurements identify candidates for investigation but do not reproduce the author's hardware/browser combination. Browser details can be captured during the next live reproduction rather than blocking further design work on another questionnaire.

## Implementation measurements, 12 November 2026

The author supplied Apple M3 Pro, 18 GB RAM, Chrome and `https://fossbot.gr`. Exact Chrome/OS versions and acceleration remain unknown. Asked how the 21.43 MiB Barry Bear reached the slow stage, the author answered “I don't know”. The original route therefore remains unresolved.

A read-only check of the public deployed editor chunk, `/static/js/5286.3250f4ea.chunk.js`, found the same `e.size > 10485760` guard before parsing, with the same 10 MB rejection text. The chunk contained 287 918 bytes and SHA-256 `b0dbc1419d449760660e706fd04f054c4ea37463c83027a3ce163d2e0a5a6a99`. No production account or stage was changed. This establishes current button behaviour, not the route or deployed version used when the slowdown occurred.

### Demonstrated curve-rendering bottleneck

The shared visual builder allocated one mesh for each sampled strip and cap. The bounded fix combines the same triangles into one indexed mesh per path. Geometry, sensor evaluation, cap tessellation, persisted intent and all input limits remain unchanged. Regression tests cover strip positions, width/route parity, triangle counts and indices above 65 535 vertices.

| Fixture | Paths / nodes / evaluated segments | Meshes before → after | CPU construction p50 before → after |
| --- | --- | --- | --- |
| Short | 1 / 5 / 52 | 106 → 1 | 0.493 → 0.222 ms |
| Normal | 8 / 96 / 1 368 | 2 744 → 8 | 8.647 → 0.963 ms |
| Stress | 32 / 768 / 9 184 | 18 400 → 32 | 43.644 → 6.142 ms |

Raw [CPU baseline](stage-editor-evidence/curve-cpu-before.json) and [CPU result](stage-editor-evidence/curve-cpu-after.json) include evaluation, construction and full-miss sensor-probe measurements. The [generator](stage-editor-evidence/generate-fixtures.mjs) and [profile](stage-editor-evidence/profile-lines.ts) make these workloads repeatable.

In the isolated Linux software-rendering browser, normal-scene p95 draw calls fell from 2 749 to 195, including editor helpers and other visible canvases. Median rendering-frame interval fell from 49.9 to 16.7 ms and p95 from 50.1 to 33.4 ms. The input-to-second-animation-frame median fell from about 94.1 to 36.3 ms. See [before](stage-editor-evidence/normal-browser-before.json) and [after](stage-editor-evidence/normal-browser-after.json). This is a demonstrated local improvement, not hardware acceptance or a supported-capacity claim.

The [stress result](stage-editor-evidence/stress-browser-after.json) still has a 66.6 ms median rendering-frame interval and 83.3 ms p95. Input proxy median is 131.3 ms and p95 144.8 ms. It does not meet the proposed 30 fps target on SwiftShader. No cutoff was added. The [short handle-drag result](stage-editor-evidence/short-browser-after.json) has 33.4 ms median and 50 ms p95 rendering intervals. Input proxy median is 40.7 ms and p95 54.7 ms. One Undo and save/reopen were verified. The stress stage also loaded in Run Test with telemetry.

A generated 198 484-byte, 3 968-triangle sphere passed the actual importer, displayed its actual geometry preview and saved in the browser with matching recovery cleared. This does not exercise the complete timed import/edit/wires/history/reopen/Run Test sequence and does not establish Barry Bear support.

### Remaining performance decision

The target-device measurements and supported-workload agreement remain open. The connected browser host was unavailable, so the author's M3 Chrome could not be inspected. Continue from the reproducible fixtures in [verification](stage-editor-verification.md), retaining wires-off/on and storage outcomes separately. Any proposed new restriction, simplification, byte-limit increase or storage-policy change must return to the author for approval. None has been introduced.

## Reproduction check, 16 November 2026

The existing fixture generator and CPU profile ran successfully again without policy or implementation changes. The short, normal and stress fixtures and 3 968-triangle sphere were generated in a temporary directory. [Raw CPU results](stage-editor-evidence/review-2026-11-16/curve-profile.json) are retained. This checks reproducibility only. It is not target-device acceptance, a new supported workload, or an end-to-end imported-model performance measurement. The existing 10 MiB guard remains unchanged.
