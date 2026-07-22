const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export type LectureStageSourceType = 'github' | 'marketplace';

export interface LectureStageReference {
  sourceType: LectureStageSourceType;
  repoOwner: string;
  repoName: string;
  visibility?: 'public' | 'private' | string | null;
  marketplaceEntryPath?: string | null;
  title?: string | null;
  url?: string | null;
  commitSha?: string | null;
}

export interface Lecture {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  curriculum_id: number;
  stage_source_type?: LectureStageSourceType | null;
  stage_repo_owner?: string | null;
  stage_repo_name?: string | null;
  stage_repo_visibility?: string | null;
  stage_marketplace_entry_path?: string | null;
  stage_title?: string | null;
  stage_url?: string | null;
  stage_commit_sha?: string | null;
  stageReference?: LectureStageReference | null;
}

export interface LectureSaveRequest {
  title: string;
  description?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  curriculum_id?: number;
  stageReference?: Pick<LectureStageReference, 'sourceType' | 'repoOwner' | 'repoName' | 'marketplaceEntryPath'> | null;
}

export class LectureRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'LectureRequestError';
    this.status = status;
    this.code = code;
  }
}

function extractError(payload: any): { code?: string; detail: string } {
  const detail = payload?.detail;
  if (detail && typeof detail === 'object') return { code: detail.error, detail: detail.detail || JSON.stringify(detail) };
  if (payload?.error || payload?.detail) return { code: payload.error, detail: payload.detail };
  return { detail: payload?.message || 'Lecture request failed' };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, detail } = extractError(payload);
    throw new LectureRequestError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, code);
  }
  return payload as T;
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function listCurriculumLectures(token: string, curriculumId: number): Promise<Lecture[]> {
  const response = await fetch(`${backendUrl}/curriculums/${encodeURIComponent(String(curriculumId))}/lessons`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return parseJsonResponse<Lecture[]>(response);
}

export async function createLecture(token: string, request: LectureSaveRequest & { curriculum_id: number }): Promise<Lecture> {
  const response = await fetch(`${backendUrl}/lectures/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  return parseJsonResponse<Lecture>(response);
}

export async function updateLecture(token: string, lectureId: number, request: LectureSaveRequest): Promise<Lecture> {
  const response = await fetch(`${backendUrl}/lectures/${encodeURIComponent(String(lectureId))}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  return parseJsonResponse<Lecture>(response);
}

export async function getLecture(token: string, lectureId: number): Promise<Lecture> {
  const response = await fetch(`${backendUrl}/lectures/${encodeURIComponent(String(lectureId))}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return parseJsonResponse<Lecture>(response);
}

export async function deleteLecture(token: string, lectureId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/lectures/${encodeURIComponent(String(lectureId))}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonResponse(response);
}
