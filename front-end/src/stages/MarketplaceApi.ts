const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export type MarketplaceValidationState = 'validated' | 'unvalidated' | 'error';

export interface MarketplaceValidationDetails {
  state: MarketplaceValidationState;
  commitSha?: string | null;
  checkedAt?: string | null;
  checkRunUrl?: string | null;
  message?: string | null;
}

export interface MarketplaceVerificationDetails {
  verified: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewPullRequest?: string | null;
}

export interface MarketplaceStageEntry {
  marketplaceVersion: number;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  commitSha: string;
  title: string;
  description: string;
  tags: string[];
  previewPath?: string | null;
  previewUrl?: string | null;
  author: {
    platformUsername?: string | null;
    githubUsername?: string | null;
  };
  forkedFrom?: {
    repoOwner: string;
    repoName: string;
    commitSha?: string | null;
  } | null;
  badges: {
    verified: boolean;
    validation: MarketplaceValidationState;
  };
  validation?: MarketplaceValidationDetails | null;
  verification?: MarketplaceVerificationDetails | null;
  publishedAt: string;
  updatedAt: string;
}

export interface MarketplaceIndexPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface MarketplaceTagCount {
  tag: string;
  count: number;
}

export interface MarketplaceIndexResponse {
  generatedAt: string;
  schemaVersion: number;
  stages: MarketplaceStageEntry[];
  warning?: string;
  pagination?: MarketplaceIndexPagination;
  tags?: MarketplaceTagCount[];
}

export interface MarketplaceIndexRequest {
  page?: number;
  pageSize?: number;
  q?: string;
  tag?: string;
  sort?: 'updated' | 'published' | 'verified';
}

export interface PublishMarketplaceRequest {
  repoOwner: string;
  repoName: string;
  title: string;
  description: string;
  tags: string[];
  previewDataUrl?: string | null;
  commitMessage?: string;
}

export type MarketplacePullRequestState = 'open' | 'merged' | 'closed' | string;

export interface MarketplacePullRequestSummary {
  number?: number | null;
  url?: string | null;
  state?: MarketplacePullRequestState | null;
  title?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  mergedAt?: string | null;
}

export interface MarketplaceStageStatusResponse {
  repoOwner: string;
  repoName: string;
  entryPath: string;
  entry?: MarketplaceStageEntry | null;
  pullRequest?: MarketplacePullRequestSummary | null;
  rawBaseUrl?: string | null;
}

export interface PublishMarketplaceResponse {
  entry: MarketplaceStageEntry;
  entryPath: string;
  pullRequest?: MarketplacePullRequestSummary | null;
  pullRequestUrl?: string | null;
  pullRequestNumber?: number | null;
  pullRequestState?: MarketplacePullRequestState | null;
  rawBaseUrl?: string | null;
}

export interface ForkMarketplaceStageResponse {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  commitSha?: string | null;
  rawBaseUrl?: string | null;
  private: false;
  visibility: 'public';
  forkedFrom: {
    repoOwner: string;
    repoName: string;
    commitSha: string;
    forkedAt: string;
  };
  forkedBy: {
    githubUsername?: string | null;
    platformUsername?: string | null;
  };
}

export interface MarketplaceForkStatusResponse {
  exists: boolean;
  valid: boolean;
  appAccess?: boolean;
  setupComplete?: boolean;
  repoOwner?: string;
  repoName?: string;
  message?: string | null;
  installationUrl?: string | null;
}

export class MarketplaceRequestError extends Error {
  code?: string;
  status: number;
  retryAfter?: number | null;
  installationUrl?: string | null;

  constructor(message: string, status: number, code?: string, retryAfter?: number | null, installationUrl?: string | null) {
    super(message);
    this.name = 'MarketplaceRequestError';
    this.status = status;
    this.code = code;
    this.retryAfter = typeof retryAfter === 'number' ? retryAfter : null;
    this.installationUrl = typeof installationUrl === 'string' ? installationUrl : null;
  }
}

function extractMarketplaceError(payload: any): { code?: string; detail: string; retryAfter?: number | null; installationUrl?: string | null } {
  const detail = payload?.detail;
  if (detail && typeof detail === 'object') return { code: detail.error, detail: detail.detail || JSON.stringify(detail), retryAfter: detail.retryAfter, installationUrl: detail.installationUrl };
  if (payload?.error || payload?.detail) return { code: payload.error, detail: payload.detail, retryAfter: payload.retryAfter, installationUrl: payload.installationUrl };
  return { detail: payload?.message || 'Marketplace request failed' };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, detail, retryAfter, installationUrl } = extractMarketplaceError(payload);
    throw new MarketplaceRequestError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, code, retryAfter, installationUrl);
  }
  return payload as T;
}

export async function getMarketplaceIndex(request: MarketplaceIndexRequest = {}): Promise<MarketplaceIndexResponse> {
  const params = new URLSearchParams();
  if (request.page) params.set('page', String(request.page));
  if (request.pageSize) params.set('pageSize', String(request.pageSize));
  if (request.q) params.set('q', request.q);
  if (request.tag) params.set('tag', request.tag);
  if (request.sort) params.set('sort', request.sort);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${backendUrl}/api/marketplace/index${suffix}`, { method: 'GET' });
  return parseJsonResponse<MarketplaceIndexResponse>(response);
}

export async function getMarketplaceStageStatus(token: string, owner: string, repo: string): Promise<MarketplaceStageStatusResponse> {
  const response = await fetch(`${backendUrl}/api/marketplace/status/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse<MarketplaceStageStatusResponse>(response);
}

export async function completeMarketplaceFork(token: string, repoOwner: string, repoName: string): Promise<ForkMarketplaceStageResponse> {
  const response = await fetch(`${backendUrl}/api/marketplace/fork/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ repoOwner, repoName }),
  });
  return parseJsonResponse<ForkMarketplaceStageResponse>(response);
}

export async function getMarketplaceForkStatus(token: string, repoOwner: string, repoName: string): Promise<MarketplaceForkStatusResponse> {
  const response = await fetch(`${backendUrl}/api/marketplace/fork/status/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<MarketplaceForkStatusResponse>(response);
}

export async function publishStageToMarketplace(token: string, request: PublishMarketplaceRequest): Promise<PublishMarketplaceResponse> {
  const response = await fetch(`${backendUrl}/api/marketplace/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<PublishMarketplaceResponse>(response);
}

export async function unpublishStageFromMarketplace(token: string, owner: string, repo: string, reason?: string): Promise<{ pullRequestUrl?: string | null; pullRequestNumber?: number | null; entryPath: string }> {
  const response = await fetch(`${backendUrl}/api/marketplace/unpublish/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
  return parseJsonResponse(response);
}
