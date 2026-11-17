## What this proposes

Improve the existing stage editor’s transformations, selection, line drawing, groups, settings and appearance while preserving production integrations. Add rounded corners through a shared line evaluator used by rendering, picking and floor sensors, with explicit migration and recovery rules. Implement the changes through eight work packages, with import performance requiring further measurement and a reviewed fix before complete release acceptance.

## How the existing system works, per this document

The editor page owns stage data, selection, operations and history, while the scene handles picking and rendering. A standalone workspace runs the real editor and simulator with one browser-saved stage, while production also supports accounts, publishing and backend services. Existing stages use straight lines, browser preferences influence snapping, and runtime object order determines camera and robot-spawn selection. A selectable legacy simulator remains available but cannot handle the proposed native curves.

## Findings

**C1 · Major**

- Affected scope: Approval status and review sequence, lines 4–9, 68, 107–121 and 388.
- Discrepancy: The opening says the author approved the consolidated design, technical completion proposals and implementation plan. Line 68 instead says the technical proposals and schedule are submitted for review, and line 388 makes document approval a prerequisite for starting Goldfish review. A fresh reader cannot determine whether author approval is complete, whether this review is the next gate, or which decisions remain pending.
- Action: PROPOSE FIX. State one consistent approval sequence and distinguish prior approval of the overall direction from acceptance of the specific technical contracts. Update the status, approval section and final gate to agree.

**C2 · Nit**

- Affected scope: Integration documentation, line 368.
- Discrepancy: “Reconcile the target-required conflict against actual validation” introduces a conflict that the document never explains. The reader cannot tell whether “target” means a stage object, a task objective or another requirement, nor which behaviours disagree.
- Action: PROPOSE FIX. Add one sentence identifying the conflicting documentation and validation behaviours and the intended resolution process.

Read attestation: I read the Comprehension Goldfish persona in full and the entire target document, lines 1–390. I applied the naive-reader, self-containment review to both specified ranges.

No external sources, history or memory were consulted. No files were changed and no builds or tests were run.
