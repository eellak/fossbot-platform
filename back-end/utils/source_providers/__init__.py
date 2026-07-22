from utils.source_providers.github_app import GitHubAppProvider


def get_provider(name: str):
    normalized = (name or "").strip().lower()
    if normalized == "github_app":
        return GitHubAppProvider()
    raise ValueError(f"Unknown source provider: {name}")
