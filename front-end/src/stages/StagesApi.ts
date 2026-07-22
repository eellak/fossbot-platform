import type { LocalStageRecord } from 'src/components/stage-builder/types';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export interface ProviderStageRef {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  commitSha?: string | null;
  stageJsonSha?: string | null;
  rawBaseUrl?: string | null;
}

export interface ProviderStageListItem {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  updatedAt?: string | null;
}

export interface SaveStageToProviderRequest {
  record: LocalStageRecord;
  slug?: string;
  repoOwner?: string;
  repoName?: string;
  baseStageJsonSha?: string | null;
  commitMessage?: string;
}

export interface LoadStageFromProviderResponse extends ProviderStageRef {
  record: LocalStageRecord;
  manifest: unknown;
  manifestSha?: string | null;
}

export class ProviderRequestError extends Error {
  code?: string;
  status: number;
  currentStageJsonSha?: string | null;
  currentCommitSha?: string | null;
  retryAfter?: number | null;

  constructor(message: string, status: number, code?: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProviderRequestError';
    this.status = status;
    this.code = code;
    this.currentStageJsonSha = typeof details.currentStageJsonSha === 'string' ? details.currentStageJsonSha : null;
    this.currentCommitSha = typeof details.currentCommitSha === 'string' ? details.currentCommitSha : null;
    this.retryAfter = typeof details.retryAfter === 'number' ? details.retryAfter : null;
  }
}

function extractProviderError(payload: any): { code?: string; detail: string; details?: Record<string, unknown> } {
  const detail = payload?.detail;
  if (detail && typeof detail === 'object') {
    return { code: detail.error, detail: detail.detail || JSON.stringify(detail), details: detail };
  }
  if (payload?.error || payload?.detail) {
    return { code: payload.error, detail: payload.detail, details: payload };
  }
  return { detail: payload?.message || 'Stage provider request failed' };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, detail, details } = extractProviderError(payload);
    throw new ProviderRequestError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, code, details);
  }
  return payload as T;
}

export async function createStageOnProvider(token: string, request: SaveStageToProviderRequest): Promise<ProviderStageRef & { assetCount: number }> {
  const response = await fetch(`${backendUrl}/api/stages/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<ProviderStageRef & { assetCount: number }>(response);
}

export async function updateStageOnProvider(token: string, request: SaveStageToProviderRequest): Promise<ProviderStageRef & { assetCount: number }> {
  const response = await fetch(`${backendUrl}/api/stages/save`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<ProviderStageRef & { assetCount: number }>(response);
}

export async function listProviderStages(token: string): Promise<ProviderStageListItem[]> {
  const response = await fetch(`${backendUrl}/api/stages/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await parseJsonResponse<{ stages: ProviderStageListItem[] }>(response);
  return payload.stages;
}

export async function loadStageFromProvider(token: string, owner: string, repo: string): Promise<LoadStageFromProviderResponse> {
  const response = await fetch(`${backendUrl}/api/stages/load/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse<LoadStageFromProviderResponse>(response);
}
