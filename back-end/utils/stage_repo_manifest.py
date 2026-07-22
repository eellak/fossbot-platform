import datetime
from typing import Any, Optional


MANIFEST_KIND = "fossbot-stage"
MANIFEST_VERSION = 1
SCHEMA_VERSION = 2


def build_stage_manifest(
    record: dict[str, Any],
    platform_username: str,
    github_username: str,
    repo_owner: str,
    repo_name: str,
    validation_state: str = "unvalidated",
    commit_sha: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "manifestVersion": MANIFEST_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "kind": MANIFEST_KIND,
        "title": record.get("title") or "Untitled Stage",
        "description": record.get("description") or "",
        "author": {
            "platformUsername": platform_username,
            "githubUsername": github_username,
        },
        "storage": {
            "provider": "github_app",
            "repoOwner": repo_owner,
            "repoName": repo_name,
        },
        "validation": {
            "state": validation_state,
            "commitSha": commit_sha,
            "checkedAt": datetime.datetime.utcnow().isoformat() + "Z" if commit_sha else None,
        },
    }


def verify_stage_manifest(manifest: dict[str, Any], owner: str, repo: str) -> None:
    if manifest.get("kind") != MANIFEST_KIND:
        raise ValueError("Repository is not a FOSSBot stage repository")
    storage = manifest.get("storage") or {}
    manifest_owner = storage.get("repoOwner")
    manifest_repo = storage.get("repoName")
    if manifest_owner and manifest_owner.lower() != owner.lower():
        raise ValueError("FOSSBot manifest owner does not match repository owner")
    if manifest_repo and manifest_repo.lower() != repo.lower():
        raise ValueError("FOSSBot manifest repo name does not match repository name")
