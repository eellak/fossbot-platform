# GitHub Marketplace Security Review

Phase 6 v1 review for GitHub-backed Stage Builder storage and the Git-hosted marketplace.

## Current controls

- Marketplace entries are Git-reviewed pull requests, not direct database writes.
- Publishing requires the caller to be authenticated in the platform.
- Source repositories must be public and named `fossbot-*`.
- Users can only publish repositories selected in their own GitHub App installation.
- The backend verifies `fossbot.json` ownership metadata before publishing.
- Marketplace repository identity is read from backend environment variables and is not exposed through frontend API types.
- Preview uploads accept only PNG data URLs and are capped at 2 MB.
- Marketplace CI validates entries and referenced source repos before index generation.
- Badge semantics distinguish human review (`Verified`) from technical validation (`Validated`).

## Threats and mitigations

| Risk | Mitigation in v1 | Follow-up |
|---|---|---|
| User publishes someone else's repo | Check selected GitHub App installation and `fossbot-*` repo access | Add explicit owner/collaborator check if publishing from org repos is enabled |
| Marketplace repo details leak to frontend | Backend proxies index and strips `source` | Keep env values out of frontend bundles and API responses |
| Stale validation badge | Publish resets changed commits to `Unvalidated`; CI rewrites validation metadata | Add scheduled marketplace revalidation |
| Malicious marketplace entry edit | PR review plus CI validation | Add CODEOWNERS/branch protection in marketplace repo |
| Over-broad GitHub App access | Users select only `fossbot-*` repos; marketplace repo installed by maintainer | Remove Administration permission after bootstrap if no longer needed |
| GitHub API abuse/rate limit | Central rate-limit mapping returns `github_rate_limited` and retry hints | Add request caching/backoff for index and repo reads if needed |
| Large or unexpected preview payload | PNG-only data URL and 2 MB backend cap | Add image dimension validation if previews become performance-heavy |
| Markdown/HTML injection | Marketplace UI renders descriptions as plain text | Sanitize if Markdown descriptions are introduced |
| External asset abuse | v1 validation checks structural repo files only | Add asset allow-list and size/type validation before broad marketplace launch |

## Recommended marketplace repo settings

- Enable branch protection for `main`.
- Require the marketplace validation workflow before merge.
- Require maintainer review before setting `badges.verified` to `true`.
- Add CODEOWNERS for `stages/**/*.json`, workflows, and scripts.
- Keep GitHub Actions permissions minimal: `contents: read`, `checks: write` for PR validation; `contents: write`, `checks: write` for index rebuild.

## Secrets checklist

- [ ] GitHub App private key is stored only in backend secret storage/local `.env`.
- [ ] GitHub OAuth client secret is not present in frontend env files.
- [ ] Marketplace repo owner/name are backend env only.
- [ ] Development and production callback URLs are separate and exact.
- [ ] Token encryption key is backed up securely and rotated intentionally.
- [ ] Logs do not print user tokens, installation tokens, private keys, or raw `.env` values.

## Follow-up security work

- Add scheduled marketplace revalidation for stale entries.
- Add deeper stage validation: spawn/target visibility, floor bounds, asset resolution, asset size/type limits.
- Add branch protection/CODEOWNERS in the marketplace repo.
- Revisit GitHub App Administration permission and remove it if no longer required.
- Add backend tests for repository access denial, rate-limit mapping, and marketplace metadata preservation.
