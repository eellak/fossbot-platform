# Publish a stage

Marketplace stages can be submitted from a private local stage or from a public GitHub stage repository.

## Local publication

1. Save the stage locally.
2. Add an accurate title, concise description, optional preview image, useful tags, and a sharing licence.
3. Choose **Request publication** in Stage Builder.
4. The saved revision enters the local publication queue.
5. A marketplace verifier, moderator, or administrator approves or rejects the immutable release.

The currently approved release remains public while an update waits for review. Unpublishing removes the listing from discovery but preserves approved immutable release URLs for existing projects and lessons.

## GitHub publication

1. Save the stage to a public `fossbot-*` GitHub repository.
2. Add an accurate title, concise description, preview image, and useful tags.
3. Confirm that you have permission to publish every asset and credit original authors and licences.
4. Choose **Publish stage** in Stage Builder. FOSSBot creates a review request for the pinned revision.

Published users continue to receive the previous approved revision until an update review is merged. You can request unpublishing from **Stages → My stages**.

## Validation, verification, and moderation

Publication approval decides whether a release may enter the Stage library. Validation confirms that a pinned revision can be checked technically. Verification is separate: a trusted reviewer checks quality, safety, metadata, attribution, and suitability before applying the Verified badge.

A locally hidden stage disappears from discovery while existing pinned references continue to work. A locally removed stage is quarantined: direct record, preview, copy, and republish access remain blocked until a moderator restores it.

Report a public stage if it is broken or misleading, inappropriate, unsafe, spam, or has copyright or attribution concerns. Reports are private to the FOSSBot instance that receives them.
