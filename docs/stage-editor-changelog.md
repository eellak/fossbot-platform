# Stage editor changelog

Unreleased. No deployment or release is claimed.

No entries are approved for release yet. The [backlog](stage-editor-improvements.md) records implementation and technical evidence. D5/D10 fitting was accepted by the author. The current line-editing experience is accepted. Other outstanding review coverage, the M3 Pro performance investigation and production integration checks remain release gates in the [verification record](stage-editor-verification.md). Promote only entries whose matching evidence and author acceptance are recorded.

## Verified unreleased candidates, 16 November 2026

- Accepted line editing includes compact point controls, live drawing preview, closed loops and selected-only floor move/rotation handles. Requested corner sizes are retained while competing corners fit available space.
- Backend saves reject malformed editor/config structures that current readers cannot reopen.
- Validation correctly reports a missing robot spawn when its parent is hidden, matching exported runtime visibility.

These are candidates backed by the current review, not a release announcement. Production integration and target-device acceptance remain open.

## 17 November 2026

- Recovery resumes matching unfinished work automatically. Recent drafts preserves other stages without routine discard prompts.
- View saved version keeps unfinished edits available. A newer saved revision asks which version to open before proceeding.
- Legacy drafts and original sources remain available. Saves to account/GitHub remain explicit. No automatic draft expiry was added.

- Saved-version comparison is now a read-only preview with Back to my edits. The recovered editor retains selection, camera and history. Edit this version remains explicit and preserves the unfinished draft.
