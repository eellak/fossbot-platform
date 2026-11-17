# Implementation style report

Read attestation: Read the complete Style Goldfish persona, the GoldfishContext file and all 390 lines of `design_draft.md`. Audited lines 230–390, using the rest as context. No additional style standard applied.

## T1 · Major

Line 388, verification and completion gates. CALIBRATE.

“Only after this document is approved should the fresh EGM Goldfish review begin” presents approval as pending, while the opening records approval on 12 November 2026. Context sections also retain “submitted for review” wording. This leaves the implementation reader unsure which gate remains. State the current gate directly: “The author approved this plan on 12 November 2026. Complete Goldfish review and resolve material findings before implementation handoff.” Reconcile the contextual approval statements with the same status.

## T2 · Nit

Lines 294–295, visual invalidation. Clarify.

“Without rebuilding solely for selection or transforms unnecessarily” leaves the exception undefined. The next row provides a clearer distinction. Use: “Invalidate cached visuals when curve geometry changes. Reuse them for selection changes and transforms that can be applied without rebuilding geometry.” This gives the implementer and test author the same rule.

## T3 · Nit

Line 384, physical test caveat. DROP.

“Without treating the absence of one as proof of safety or reliability” describes an implausible inference and adds no concrete testing decision. The preceding sentence already limits automated acceptance. Retain the actionable instruction: “Record any physical robot testing separately from simulator acceptance.”

## T4 · Nit

Lines 253 and 306. Consistent spelling.

Use “Serialisation” and “serialisation” in prose, matching the document’s predominant British English spelling. Preserve filenames such as `serialize.ts`.

No files changed or tests run. Existing-code claims were not independently verified in this editorial review.
