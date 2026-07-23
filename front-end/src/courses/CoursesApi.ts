import type {
  CourseCreateRequest,
  CourseDraft,
  CourseRelease,
  CourseSummary,
  CourseUpdateRequest,
  Lesson,
  LessonSaveRequest,
  PublicationValidation,
} from './types';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export class CourseRequestError extends Error {
  status: number;
  code?: string;
  currentUpdatedAt?: string;

  constructor(message: string, status: number, code?: string, currentUpdatedAt?: string) {
    super(message);
    this.name = 'CourseRequestError';
    this.status = status;
    this.code = code;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === 'object' ? detail.detail : detail;
    throw new CourseRequestError(
      message || payload?.message || 'Course request failed',
      response.status,
      typeof detail === 'object' ? detail.error : undefined,
      typeof detail === 'object' ? detail.currentUpdatedAt : undefined,
    );
  }
  return payload as T;
}

export async function listAuthoredCourses(token: string): Promise<CourseSummary[]> {
  return parse(await fetch(`${backendUrl}/courses/mine`, { headers: headers(token) }));
}

export async function createCourse(token: string, request: CourseCreateRequest): Promise<CourseDraft> {
  return parse(await fetch(`${backendUrl}/courses`, { method: 'POST', headers: headers(token), body: JSON.stringify(request) }));
}

export async function readCourseDraft(token: string, courseId: number): Promise<CourseDraft> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/draft`, { headers: headers(token) }));
}

export async function updateCourse(token: string, courseId: number, request: CourseUpdateRequest): Promise<CourseDraft> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(request) }));
}

export async function archiveCourse(token: string, courseId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/courses/${courseId}`, { method: 'DELETE', headers: headers(token) });
  if (!response.ok) await parse(response);
}

export async function addLesson(token: string, courseId: number, request: LessonSaveRequest): Promise<Lesson> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/lessons`, { method: 'POST', headers: headers(token), body: JSON.stringify(request) }));
}

export async function updateLesson(token: string, courseId: number, lessonId: number, request: LessonSaveRequest): Promise<Lesson> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/lessons/${lessonId}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(request) }));
}

export async function deleteLesson(token: string, courseId: number, lessonId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE', headers: headers(token) });
  if (!response.ok) await parse(response);
}

export async function reorderLessons(token: string, courseId: number, lessonIds: number[]): Promise<Lesson[]> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/lessons/reorder`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ lesson_ids: lessonIds }),
  }));
}

export async function validateCourse(token: string, courseId: number): Promise<PublicationValidation> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/validate`, { method: 'POST', headers: headers(token) }));
}

export async function publishCourse(token: string, courseId: number): Promise<CourseRelease> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/publish`, { method: 'POST', headers: headers(token) }));
}
