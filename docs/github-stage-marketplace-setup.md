# GitHub Stage Storage and Marketplace Setup

This document covers the GitHub-backed Stage Builder storage flow and the Git-hosted marketplace v1.

## Architecture

- User stages live in public GitHub repositories named `fossbot-*`.
- Marketplace metadata lives in a separate GitHub repository.
- The platform database does not store marketplace entries.
- Publishing and unpublishing create pull requests against the marketplace repository.
- Marketplace CI validates stage entries and regenerates `index.json` after merge.

## GitHub App permissions

Minimum permissions for the FOSSBot GitHub App:

| Permission | Access | Why |
|---|---:|---|
| Metadata | Read | Required by GitHub Apps |
| Contents / Code | Read & write | Read/write `stage.json`, `fossbot.json`, previews, README, marketplace entries |
| Pull requests | Read & write | Open marketplace publish/unpublish PRs |
| Checks | Read & write | Marketplace CI validation check runs |
| Administration | Read & write | Only needed while using installation repository management flows |

Install the app in two places:

1. Each user selects only their own public `fossbot-*` stage repositories.
2. The platform maintainer installs the app on the single marketplace repository.

Do not ask users to select or install the marketplace repository.

## Backend environment

Configure these variables for marketplace publishing and browsing:

```txt
FOSSBOT_MARKETPLACE_OWNER=jgenc
FOSSBOT_MARKETPLACE_REPO=fossbot-marketplace
FOSSBOT_MARKETPLACE_BRANCH=main
FOSSBOT_MARKETPLACE_INDEX_PATH=index.json
FOSSBOT_MARKETPLACE_RAW_INDEX_URL=https://raw.githubusercontent.com/jgenc/fossbot-marketplace/main/index.json
FOSSBOT_MARKETPLACE_INSTALLATION_ID=
```

`FOSSBOT_MARKETPLACE_INSTALLATION_ID` is optional. Leave it blank to discover the installation from the configured marketplace repository.

## Key management

Required GitHub App secrets are deployment secrets, not frontend config:

- GitHub App ID
- GitHub App client ID/secret
- GitHub App private key
- callback/setup URLs

Guidelines:

- Keep private keys in the server secret store or local `.env`; never commit them.
- Rotate the GitHub App private key if it is copied outside the deployment environment.
- Use separate GitHub Apps or separate private keys for production and development when possible.
- Keep marketplace repository details backend-only. The frontend should only call `/api/marketplace/index` and publish/unpublish endpoints.
- User OAuth tokens should remain encrypted at rest and refreshed through the backend only.

## Marketplace repository CI

Create a ready-to-initialize local repository from the platform's current validator and workflow templates:

```bash
node scripts/create-marketplace-repo.mjs
```

See [Creating the FOSSBot marketplace repository](create-marketplace-repository.md) for prerequisites, environment variables, the outside-this-repository workflow, Git initialization, and backend connection steps.

The script automatically reads `.env` and `back-end/.env`. It uses `FOSSBOT_MARKETPLACE_REPO` for the default sibling-directory name; set `FOSSBOT_MARKETPLACE_LOCAL_PATH` to choose another target, or pass the target path as the first argument. It only writes a local scaffold—it does not initialize Git, create a GitHub repository, or push.

The resulting marketplace repository contains:

```txt
.github/workflows/validate-marketplace.yml
.github/workflows/build-index.yml
scripts/build-marketplace-index.mjs
stages/<owner>/<repo>.json
index.json
```

PR workflow:

```bash
node scripts/build-marketplace-index.mjs . --validate-stage-repos --check-run --fail-on-error
```

Push-to-main workflow:

```bash
node scripts/build-marketplace-index.mjs . --validate-stage-repos --write-entry-validation --check-run
```

The push workflow should commit generated changes to `index.json` and `stages/**/*.json`.

## GitHub App developer spike

The GitHub App spike also reads `.env` and `back-end/.env`, so a configured local run is simply:

```bash
node scripts/github-app-spike.mjs
```

When the selected-repository installation is already configured, FOSSBot programmatically grants it access to each newly created `fossbot-*` stage repository. The app does not automatically open a GitHub page. The first repository and any recovery from denied access remain explicit GitHub actions.

## Badge semantics

- **Verified**: human marketplace maintainer reviewed the stage.
- **Validated**: the indexed commit passed marketplace CI validation.
- **Unvalidated**: validation has not run yet, or the source repo changed after indexing.
- **Error**: marketplace CI could not validate the entry or source repo.

`Verified` and `Validated` are independent. A technically valid stage is not automatically human-reviewed.

## Rate limits

GitHub API rate limits can affect save, load, publish, and CI validation. The backend maps GitHub primary and secondary rate-limit responses to `github_rate_limited` with an optional `retryAfter` value. The UI should show the provided message and avoid automatic retry loops.

For CI, prefer the repository `GITHUB_TOKEN` and avoid unnecessary repeated validation in the same workflow run.
