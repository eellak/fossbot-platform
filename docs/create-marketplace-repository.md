# Creating the FOSSBot marketplace repository

The stage marketplace is intentionally stored in a separate GitHub repository from FOSSBot Platform. That repository contains reviewable stage metadata, CI validation workflows, and the generated public `index.json` consumed by the platform. Keeping it separate lets maintainers review and publish stages without deploying the application or storing marketplace entries in the platform database.

The creator script in this repository builds a ready-to-initialize local directory. It does **not** create a GitHub repository, initialize Git, commit, or push. Those remain explicit developer actions.

## Prerequisites

- A checkout of `fossbot-platform` with Node.js 22 or newer.
- A GitHub account or organization where the separate marketplace repository will live.
- The FOSSBot GitHub App installed on that repository before platform publishing is enabled.

## Configure the local scaffold

Local scripts automatically read these files, when present:

1. `<fossbot-platform>/.env`
2. `<fossbot-platform>/back-end/.env`

Variables already set in the shell take precedence. Do not commit either `.env` file.

Only two variables affect repository creation:

```dotenv
# Repository name and default sibling-directory name.
FOSSBOT_MARKETPLACE_REPO=fossbot-marketplace

# Optional absolute or relative output directory.
# Relative paths are resolved from the directory where the command is run.
FOSSBOT_MARKETPLACE_LOCAL_PATH=../fossbot-marketplace
```

`FOSSBOT_MARKETPLACE_LOCAL_PATH` is optional. You can instead pass the target path directly to the script.

## Create the repository outside `fossbot-platform`

Run the creator from the `fossbot-platform` root. The default target is a sibling directory, keeping generated marketplace files outside this repository:

```bash
cd /path/to/fossbot-platform
node scripts/create-marketplace-repo.mjs
```

To choose an explicit target:

```bash
node scripts/create-marketplace-repo.mjs ../fossbot-marketplace
```

The target must be missing or empty. The script refuses to overwrite a non-empty directory.

It creates:

```text
fossbot-marketplace/
├── .github/workflows/
│   ├── build-index.yml
│   └── validate-marketplace.yml
├── scripts/build-marketplace-index.mjs
├── stages/.gitkeep
├── index.json
└── README.md
```

The validator is copied from the current platform checkout, so rerun the creator into a new empty directory when intentionally refreshing the repository template. Do not point it at an existing marketplace checkout.

## Initialize and publish it

Review the generated files before publishing them. Then, from the new directory:

```bash
cd ../fossbot-marketplace
git init -b main
git add README.md index.json stages/.gitkeep scripts/build-marketplace-index.mjs .github/workflows/build-index.yml .github/workflows/validate-marketplace.yml
git commit -F - <<'EOF'
chore: initialize marketplace
EOF
git remote add origin git@github.com:<owner>/fossbot-marketplace.git
git push -u origin main
```

Create the empty GitHub repository before pushing, or use your normal GitHub CLI/UI workflow. The commands above are examples; repository ownership, visibility, branch protection, and review rules remain maintainer decisions.

## Connect FOSSBot Platform

After the remote repository exists, configure the platform backend in `back-end/.env`:

```dotenv
FOSSBOT_MARKETPLACE_OWNER=<github-owner>
FOSSBOT_MARKETPLACE_REPO=fossbot-marketplace
FOSSBOT_MARKETPLACE_BRANCH=main
FOSSBOT_MARKETPLACE_INDEX_PATH=index.json
FOSSBOT_MARKETPLACE_RAW_INDEX_URL=https://raw.githubusercontent.com/<github-owner>/fossbot-marketplace/main/index.json

# Optional: leave blank to discover the installation from owner/repository.
FOSSBOT_MARKETPLACE_INSTALLATION_ID=
```

These variables identify the remote marketplace; they do not create it. Keep GitHub App credentials and private keys in the existing backend secret configuration.

Next:

1. Install the FOSSBot GitHub App on only the marketplace repository.
2. Confirm its Contents and Pull requests permissions are read/write.
3. Restart the backend through the project's normal Docker workflow so it reads the new variables.
4. Open the Stage library and verify `/api/marketplace/index` can read the empty index.
5. Publish a test stage and confirm that FOSSBot creates a marketplace review pull request.

Do not run Docker Compose `up` or `down` as part of this script. Container lifecycle remains a developer-operated step.

## Updating the marketplace validator

The generated repository owns its copy of `scripts/build-marketplace-index.mjs`. When the platform validator changes, review and copy that file into the marketplace repository through a normal pull request. Do not rerun the creator against a non-empty repository.

The workflows use the repository-provided `GITHUB_TOKEN`; no personal access token is required for normal CI validation and index rebuilding.
