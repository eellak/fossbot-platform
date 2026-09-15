import type { LocalStageRecord } from 'src/components/stage-builder/types';
import type { MarketplaceStageEntry } from './MarketplaceApi';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export interface LocalStage {
  id: number;
  slug: string;
  title: string;
  description: string;
  visibility: 'private';
  record: LocalStageRecord;
  recordBytes: number;
  revision: number;
  checksum: string;
  previewUrl?: string | null;
  provenance?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  publication?: { id: number; active: boolean; stageRevision: number; currentReleaseId?: number | null; publishedAt: string; updatedAt: string; unpublishedAt?: string | null } | null;
  submission?: LocalPublicationSubmissionSummary | null;
  unchanged?: boolean;
}

export interface LocalPublicationSubmissionSummary {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'unpublished';
  stageRevision: number;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
}

export interface LocalPublicationReviewItem {
  id: number;
  stageId: number;
  stageRevision: number;
  title: string;
  description: string;
  tags: string[];
  sharingLicense: string;
  recordBytes: number;
  requestedAt: string;
  requestedBy?: string | null;
  recordUrl: string;
}

export class LocalStageRequestError extends Error {
  status: number;
  code?: string;
  currentRevision?: number;

  constructor(message: string, status: number, code?: string, currentRevision?: number) {
    super(message);
    this.name = 'LocalStageRequestError';
    this.status = status;
    this.code = code;
    this.currentRevision = currentRevision;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    if (detail && typeof detail === 'object') {
      throw new LocalStageRequestError(detail.detail || JSON.stringify(detail), response.status, detail.error, detail.currentRevision);
    }
    throw new LocalStageRequestError(typeof detail === 'string' ? detail : 'Local stage request failed.', response.status);
  }
  return payload as T;
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listLocalStages(token: string): Promise<LocalStage[]> {
  const response = await fetch(`${backendUrl}/api/local-stages`, { headers: authHeaders(token) });
  return (await parseJsonResponse<{ stages: LocalStage[] }>(response)).stages;
}

export async function loadLocalStage(token: string, stageId: number): Promise<LocalStage> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-stages/${stageId}`, { headers: authHeaders(token) }));
}

export async function createLocalStage(token: string, record: LocalStageRecord, previewDataUrl?: string | null): Promise<LocalStage> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-stages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ record, title: record.title, description: record.description, previewDataUrl: previewDataUrl ?? undefined }),
  }));
}

export async function updateLocalStage(token: string, stage: LocalStage, record: LocalStageRecord, previewDataUrl?: string | null): Promise<LocalStage> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-stages/${stage.id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      record,
      title: record.title,
      description: record.description,
      visibility: stage.visibility,
      expectedRevision: stage.revision,
      previewDataUrl: previewDataUrl ?? undefined,
    }),
  }));
}

/**
 * Loads a private local-stage preview. The endpoint needs the bearer token, so
 * the panel fetches the bytes and hands back an object URL instead of pointing
 * an `<img>` at the protected URL.
 */
export async function fetchLocalStagePreview(token: string, previewUrl: string): Promise<string> {
  const response = await fetch(previewUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new LocalStageRequestError('Could not load the stage preview.', response.status);
  return URL.createObjectURL(await response.blob());
}

export async function publishLocalStage(
  token: string,
  stage: LocalStage,
  request: { title: string; description: string; tags: string[]; previewDataUrl?: string | null; sharingLicense: 'CC-BY-4.0' | 'CC0-1.0' },
): Promise<{ submission: LocalPublicationSubmissionSummary; detail: string }> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-stages/${stage.id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...request, expectedRevision: stage.revision }),
  }));
}

export async function copyMarketplaceStageToLocal(token: string, entry: MarketplaceStageEntry): Promise<LocalStage> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/marketplace/copy`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(entry.sourceType === 'local'
      ? { sourceType: 'local', localPublicationId: entry.localPublicationId, localReleaseId: entry.localReleaseId }
      : { sourceType: 'github', repoOwner: entry.repoOwner, repoName: entry.repoName }),
  }));
}

export async function copyInstalledGitHubStageToLocal(token: string, repoOwner: string, repoName: string): Promise<LocalStage> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-stages/copy-from-github`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ repoOwner, repoName }),
  }));
}

export async function unpublishLocalStage(token: string, stageId: number): Promise<void> {
  await parseJsonResponse(await fetch(`${backendUrl}/api/local-stages/${stageId}/publish`, { method: 'DELETE', headers: authHeaders(token) }));
}

export async function getLocalPublicationReviewQueue(token: string): Promise<{ requests: LocalPublicationReviewItem[] }> {
  return parseJsonResponse(await fetch(`${backendUrl}/api/local-marketplace/review-queue`, { headers: authHeaders(token) }));
}

export async function reviewLocalPublication(token: string, submissionId: number, approved: boolean, reason?: string): Promise<void> {
  await parseJsonResponse(await fetch(`${backendUrl}/api/local-marketplace/review-queue/${submissionId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ approved, reason }),
  }));
}
