const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export interface GitHubProviderStatus {
  connected: boolean;
  providerUsername: string | null;
  installationId: string | null;
  repositorySelection: 'selected' | 'all' | null;
  selectedInstallationReady?: boolean;
}

export interface GitHubBootstrapLinks {
  repoName: string;
  newRepoUrl: string;
  installUrl: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail?.detail || payload?.detail || payload?.message || 'GitHub provider request failed';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload as T;
}

export async function getGitHubProviderStatus(token: string): Promise<GitHubProviderStatus> {
  const response = await fetch(`${backendUrl}/auth/github/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse<GitHubProviderStatus>(response);
}

export async function getGitHubLoginUrl(token: string): Promise<string> {
  const response = await fetch(`${backendUrl}/auth/github/login-url`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await parseJsonResponse<{ url: string }>(response);
  return payload.url;
}

export async function getGitHubBootstrapLinks(token: string, slug: string): Promise<GitHubBootstrapLinks> {
  const response = await fetch(`${backendUrl}/api/stages/bootstrap-links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug }),
  });
  return parseJsonResponse<GitHubBootstrapLinks>(response);
}

export async function disconnectGitHubProvider(token: string): Promise<void> {
  const response = await fetch(`${backendUrl}/auth/github`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  await parseJsonResponse(response);
}
