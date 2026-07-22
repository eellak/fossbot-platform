const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export interface GitHubProviderStatus {
  connected: boolean;
  providerUsername: string | null;
  installationId: string | null;
  repositorySelection: 'selected' | 'all' | null;
  selectedInstallationReady?: boolean;
  requiresReconnect?: boolean;
  needsReconnect?: boolean;
  statusError?: string | null;
  statusDetail?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}

export interface GitHubBootstrapLinks {
  repoName: string;
  newRepoUrl: string;
  installUrl: string;
}

export class ProviderAuthRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ProviderAuthRequestError';
    this.status = status;
    this.code = code;
  }
}

function extractProviderError(payload: any): { code?: string; detail: string } {
  const detail = payload?.detail;
  if (detail && typeof detail === 'object') return { code: detail.error, detail: detail.detail || JSON.stringify(detail) };
  if (payload?.error || payload?.detail) return { code: payload.error, detail: payload.detail };
  return { detail: payload?.message || 'GitHub provider request failed' };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, detail } = extractProviderError(payload);
    throw new ProviderAuthRequestError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, code);
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

export async function getGitHubBootstrapLinks(token: string, slug: string, visibility: 'public' | 'private' = 'public'): Promise<GitHubBootstrapLinks> {
  const response = await fetch(`${backendUrl}/api/stages/bootstrap-links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug, visibility }),
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
