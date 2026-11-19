# Native stage lines

The coordinated format uses editor metadata version 3 and runtime line `curveVersion: 1` for open paths and `curveVersion: 2` for closed-path support. Deploy the editor, simulator, legacy-mode rejection and backend validators together. Older editors are not supported writers of native curves.

```json
{
  "type": "line",
  "curveVersion": 1,
  "points": [[0, 0], [1, 0], [1, 1]],
  "corners": [null, {"mode": "rounded", "sizing": "auto"}, null],
  "width": 0.03,
  "y": 0.001,
  "color": "black"
}
```

Coordinates are X/Z pairs in metres. `corners` has exactly one entry per point. Open endpoints are null. Interior entries are `{mode: "sharp"}`, `{mode: "rounded", sizing: "auto"}` or `{mode: "rounded", sizing: "manual", trim: positiveNumber}`. Manual trim is a requested distance along each incident segment, not a circular radius. Retain it when space is constrained.

Automatic trim is one quarter of the shorter adjacent non-zero segment. For neighbouring requests r/s sharing length L, the segment factor is min(1, L/(r+s)), or 1 for a zero sum. A corner uses the smaller factor on its two incident segments. Compute factors from requests, not previously limited values. No iterative redistribution or global shrinking occurs. The quadratic joins trimmed endpoints with the original node as its control point.

`lineGeometryCore.js` is the only evaluator. It subdivides to control-point distance at most min(0.001 m, width/8). The existing bound is 4 096 generated segments per path. Failure blocks runnable geometry. No whole-stage cutoff is imposed. Visuals and floor probes consume the identical evaluated route. Rendering batches the same strip/cap triangles into one indexed mesh per path, including 32-bit indices where needed. Rendering changes do not simplify the curve or alter its sensor route.

A missing `curveVersion` is a legacy straight path. Migration preserves sharp corners, coordinates, width, colour and height. New blank editor/catalogue/Buddy paths instead use automatic interior corners. Existing templates retain their authored intent. A lone editor point persists in the sidecar with `[null]` corners and exports no runnable line.

Zero-length sections, non-finite values and invalid widths or trims need repair. Rounded reversals need repair or a Sharp override. Structurally valid repairable geometry can remain editable. Unsupported versions reject before readers discard fields, even when hidden. Current v3 sidecars must agree with native runtime lines through the shared export projection. Legacy sidecars retain their established precedence and exact original source.

Simulator preflight validates before replacing a scene. Failed loads pause driving and expose Retry. The v1 simulator rejects native lines with an explicit switch to the current runtime. It never silently straightens them. The backend validates shapes, while the shared JavaScript evaluator owns geometry semantics. Hidden paths and attached descendants export no runtime geometry.

Tests: `sim/tests/lineGeometry.test.mjs`, `sim/tests/stageFormat.test.mjs`, shared `line-contract.json`, frontend `LineGeometry.test.ts`, serialization/migration/recovery/Buddy suites and backend geometry/storage tests. Physical following is a separate test involving the robot and control programme.


## Closed paths

Closed paths use `curveVersion: 2` and `closed: true`, with at least three authored points. The last point connects to the first without duplicating either point. Every point has a non-null corner record. The evaluator includes the closing section in trim fitting, curve sampling, picking and sensor routes. Its evaluated route ends exactly at its starting coordinate. Existing version 1 paths remain supported and retain their format until closed. Unknown versions still reject before construction.

The editor closes an open path when one endpoint is selected and the opposite endpoint is clicked. Hover previews this action with **Close loop**. A drag moves the endpoint without closing. Closure is one history operation. Former endpoints become automatically Rounded, preserving their authored positions and the other corners' settings. Adding after any selected point inserts within the loop, including the last-to-first section. Removing a point retains closure while three or more points remain, otherwise the remaining path opens. Inspector Close loop provides keyboard access.

Deploy all readers and writers together. Older native-line readers reject version 2 rather than silently dropping the closing segment. Backend persistence and Buddy replacement validation retain the closed-path corner rules.
