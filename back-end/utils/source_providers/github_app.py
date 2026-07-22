import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional


GITHUB_API_URL = "https://api.github.com"
GITHUB_API_VERSION = "2022-11-28"


class GitHubApiError(Exception):
    def __init__(self, status_code: int, message: str, data: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.data = data


def _headers(token: Optional[str], content_type: Optional[str] = "application/json") -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "fossbot-platform-stage-storage",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def github_request(
    method: str,
    path_or_url: str,
    token: Optional[str] = None,
    body: Optional[dict[str, Any]] = None,
    allowed_statuses: tuple[int, ...] = (),
) -> tuple[Any, dict[str, str], int]:
    url = path_or_url if path_or_url.startswith("http") else f"{GITHUB_API_URL}{path_or_url}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=_headers(token))

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw) if raw else None
            return parsed, dict(response.headers), response.status
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        if error.code in allowed_statuses:
            return parsed, dict(error.headers), error.code
        message = parsed.get("message") if isinstance(parsed, dict) else str(parsed or error)
        raise GitHubApiError(error.code, message, parsed) from error


def encode_path(path: str) -> str:
    return "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))


class GitHubAppProvider:
    name = "github_app"

    def get_authenticated_user(self, user_token: str) -> dict[str, Any]:
        data, _, _ = github_request("GET", "/user", token=user_token)
        return data

    def list_user_installations(self, user_token: str, app_id: str, account_login: Optional[str] = None) -> list[dict[str, Any]]:
        installations: list[dict[str, Any]] = []
        page = 1
        while True:
            data, _, _ = github_request("GET", f"/user/installations?per_page=100&page={page}", token=user_token)
            batch = data.get("installations", []) if isinstance(data, dict) else []
            installations.extend(batch)
            if len(batch) < 100:
                break
            page += 1

        filtered = [item for item in installations if str(item.get("app_id")) == str(app_id)]
        if account_login:
            filtered = [
                item for item in filtered
                if (item.get("account") or {}).get("login", "").lower() == account_login.lower()
            ]
        return filtered

    def list_installation_repositories(self, user_token: str, installation_id: str) -> list[dict[str, Any]]:
        repos: list[dict[str, Any]] = []
        page = 1
        while True:
            data, _, _ = github_request(
                "GET",
                f"/user/installations/{installation_id}/repositories?per_page=100&page={page}",
                token=user_token,
            )
            batch = data.get("repositories", []) if isinstance(data, dict) else []
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return repos

    def create_user_repo(self, user_token: str, name: str, description: str) -> dict[str, Any]:
        data, _, _ = github_request("POST", "/user/repos", token=user_token, body={
            "name": name,
            "description": description,
            "private": False,
            "auto_init": True,
            "has_issues": True,
            "has_projects": False,
            "has_wiki": False,
        })
        return data

    def get_repo(self, token: str, owner: str, repo: str, allowed_statuses: tuple[int, ...] = ()) -> Optional[dict[str, Any]]:
        data, _, status = github_request("GET", f"/repos/{owner}/{repo}", token=token, allowed_statuses=allowed_statuses)
        if status == 404:
            return None
        return data

    def add_repo_to_installation(self, user_token: str, installation_id: str, repo_id: int) -> None:
        github_request("PUT", f"/user/installations/{installation_id}/repositories/{repo_id}", token=user_token)

    def create_installation_token(self, app_jwt: str, installation_id: str, repo_id: Optional[int] = None) -> str:
        body: dict[str, Any] = {}
        if repo_id is not None:
            body["repository_ids"] = [repo_id]
        data, _, _ = github_request(
            "POST",
            f"/app/installations/{installation_id}/access_tokens",
            token=app_jwt,
            body=body,
        )
        return data["token"]

    def get_file(self, token: str, owner: str, repo: str, path: str, allowed_statuses: tuple[int, ...] = (404,)) -> Optional[dict[str, Any]]:
        data, _, status = github_request(
            "GET",
            f"/repos/{owner}/{repo}/contents/{encode_path(path)}",
            token=token,
            allowed_statuses=allowed_statuses,
        )
        if status == 404:
            return None
        return data

    def read_json_file(self, token: str, owner: str, repo: str, path: str) -> tuple[dict[str, Any], str]:
        file_data = self.get_file(token, owner, repo, path, allowed_statuses=())
        if not file_data or file_data.get("encoding") != "base64":
            raise GitHubApiError(404, f"{path} not found or not base64 content")
        raw = base64.b64decode(file_data.get("content", "")).decode("utf-8")
        return json.loads(raw), file_data["sha"]

    def put_file(
        self,
        token: str,
        owner: str,
        repo: str,
        path: str,
        content: bytes,
        message: str,
        sha: Optional[str] = None,
    ) -> dict[str, Any]:
        body = {
            "message": message,
            "content": base64.b64encode(content).decode("ascii"),
        }
        if sha:
            body["sha"] = sha
        data, _, _ = github_request(
            "PUT",
            f"/repos/{owner}/{repo}/contents/{encode_path(path)}",
            token=token,
            body=body,
        )
        return data

    def set_topics(self, token: str, owner: str, repo: str, topics: list[str]) -> None:
        github_request("PUT", f"/repos/{owner}/{repo}/topics", token=token, body={"names": topics})
