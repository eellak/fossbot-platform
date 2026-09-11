import type {
  CourseCreateRequest,
  CourseDraft,
  CourseRelease,
  CourseSummary,
  CourseUpdateRequest,
  Lesson,
  LessonSaveRequest,
  PublicationValidation,
  Enrollment,
  ReleaseUpdate,
  StudentCourse,
  LessonWorkspace,
  LessonWorkspaceHistory,
  ActivityState,
  ActivitySubmissionResponse,
  CompactSensorSummary,
  MissionAttemptSubmission,
  MissionAttemptRecord,
  MissionAttemptResponse,
  MissionPersonalFeedback,
  TeacherClassGroup,
  StudentClassGroup,
  ClassChallenge,
  ClassLeaderboard,
  ClassChallengeStatistics,
  CourseAssignment,
  CourseProgressAnalytics,
  LeaderboardType,
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
  if (payload === null) throw new CourseRequestError('Course response was empty', response.status, 'empty_response');
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

export async function listPublishedCourses(token: string): Promise<StudentCourse[]> {
  return parse(await fetch(`${backendUrl}/courses`, { headers: headers(token) }));
}

export async function readPublishedCourse(token: string, courseId: number): Promise<StudentCourse> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}`, { headers: headers(token) }));
}

export async function enrollInCourse(token: string, courseId: number): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/courses/${courseId}/enroll`, { method: 'POST', headers: headers(token) }));
}

export async function listMyEnrollments(token: string): Promise<Enrollment[]> {
  return parse(await fetch(`${backendUrl}/enrollments/mine`, { headers: headers(token) }));
}

export async function readEnrollment(token: string, enrollmentId: number): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}`, { headers: headers(token) }));
}

export async function startLesson(token: string, enrollmentId: number, lessonKey: string): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/start`, { method: 'POST', headers: headers(token) }));
}

export async function completeLesson(token: string, enrollmentId: number, lessonKey: string): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/complete`, { method: 'POST', headers: headers(token) }));
}

export async function uncompleteLesson(token: string, enrollmentId: number, lessonKey: string): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/complete`, { method: 'DELETE', headers: headers(token) }));
}

export async function readReleaseUpdate(token: string, enrollmentId: number): Promise<ReleaseUpdate> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/updates`, { headers: headers(token) }));
}

export async function updateEnrollmentRelease(token: string, enrollmentId: number, currentReleaseId: number, targetReleaseId: number): Promise<Enrollment> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/update-release`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ current_release_id: currentReleaseId, target_release_id: targetReleaseId }),
  }));
}

export async function readLessonWorkspace(token: string, enrollmentId: number, lessonKey: string): Promise<LessonWorkspace> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/workspace`, { headers: headers(token) }));
}

export async function saveLessonWorkspace(token: string, enrollmentId: number, lessonKey: string, content: LessonWorkspace['content'], revision: number): Promise<LessonWorkspace> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/workspace`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ content, revision }) }));
}

export async function resetLessonWorkspace(token: string, enrollmentId: number, lessonKey: string, revision: number): Promise<LessonWorkspace> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/workspace/reset`, { method: 'POST', headers: headers(token), body: JSON.stringify({ revision }) }));
}

export async function readLessonWorkspaceHistory(token: string, enrollmentId: number, lessonKey: string): Promise<LessonWorkspaceHistory[]> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/workspace-history`, { headers: headers(token) }));
}

export async function readActivityStates(token: string, enrollmentId: number, lessonKey: string): Promise<ActivityState[]> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/activities`, { headers: headers(token) }));
}

export async function submitActivity(
  token: string,
  enrollmentId: number,
  lessonKey: string,
  activityKey: string,
  submissionId: string,
  value?: unknown,
  sensorSummary?: CompactSensorSummary | null,
): Promise<ActivitySubmissionResponse> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/activities/${encodeURIComponent(activityKey)}/submit`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ submission_id: submissionId, value, sensor_summary: sensorSummary || null }),
  }));
}

export async function submitMissionAttempt(
  token: string,
  enrollmentId: number,
  lessonKey: string,
  activityKey: string,
  attempt: MissionAttemptSubmission,
): Promise<MissionAttemptResponse> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/missions/${encodeURIComponent(activityKey)}/attempts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(attempt),
  }));
}

export async function readMissionAttempts(
  token: string,
  enrollmentId: number,
  lessonKey: string,
  activityKey: string,
): Promise<MissionAttemptRecord[]> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/missions/${encodeURIComponent(activityKey)}/attempts`, {
    headers: headers(token),
  }));
}

export async function readMissionSummary(
  token: string,
  enrollmentId: number,
  lessonKey: string,
  activityKey: string,
): Promise<MissionPersonalFeedback> {
  return parse(await fetch(`${backendUrl}/enrollments/${enrollmentId}/lessons/${encodeURIComponent(lessonKey)}/missions/${encodeURIComponent(activityKey)}/summary`, {
    headers: headers(token),
  }));
}

export async function readCourseProgress(token: string, courseId: number): Promise<CourseProgressAnalytics> {
  return parse(await fetch(`${backendUrl}/teach/courses/${courseId}/progress`, { headers: headers(token) }));
}

export async function listTeacherClassGroups(token: string): Promise<TeacherClassGroup[]> {
  return parse(await fetch(`${backendUrl}/class-groups/mine`, { headers: headers(token) }));
}

export async function createClassGroup(token: string, name: string): Promise<TeacherClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ name }),
  }));
}

export async function updateClassGroup(
  token: string,
  groupId: number,
  request: Partial<Pick<TeacherClassGroup, 'name' | 'status' | 'leaderboards_enabled'>>,
): Promise<TeacherClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups/${groupId}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(request),
  }));
}

export async function regenerateClassJoinCode(token: string, groupId: number): Promise<TeacherClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups/${groupId}/join-code`, {
    method: 'POST', headers: headers(token),
  }));
}

export async function resetClassChallengeSeason(token: string, groupId: number): Promise<TeacherClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups/${groupId}/reset-season`, {
    method: 'POST', headers: headers(token),
  }));
}

export async function removeClassMember(token: string, groupId: number, membershipId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/class-groups/${groupId}/members/${membershipId}`, {
    method: 'DELETE', headers: headers(token),
  });
  if (!response.ok) await parse(response);
}

export async function assignCourseToClass(
  token: string,
  groupId: number,
  courseId: number,
  updatePolicy: CourseAssignment['update_policy'] = 'student_choice',
): Promise<CourseAssignment> {
  return parse(await fetch(`${backendUrl}/class-groups/${groupId}/assignments`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ course_id: courseId, update_policy: updatePolicy }),
  }));
}

export async function updateCourseAssignment(
  token: string,
  assignmentId: number,
  request: Partial<Pick<CourseAssignment, 'release_id' | 'update_policy' | 'due_at'>>,
): Promise<CourseAssignment> {
  return parse(await fetch(`${backendUrl}/course-assignments/${assignmentId}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(request),
  }));
}

export async function createClassChallenge(
  token: string,
  assignmentId: number,
  request: { lesson_key: string; activity_key: string; board_type: LeaderboardType; tie_tolerance: number; enabled: boolean },
): Promise<ClassChallenge> {
  return parse(await fetch(`${backendUrl}/course-assignments/${assignmentId}/challenges`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(request),
  }));
}

export async function updateClassChallenge(
  token: string,
  challengeId: number,
  request: Partial<Pick<ClassChallenge, 'board_type' | 'tie_tolerance' | 'enabled'>>,
): Promise<ClassChallenge> {
  return parse(await fetch(`${backendUrl}/class-challenges/${challengeId}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(request),
  }));
}

export async function listJoinedClassGroups(token: string): Promise<StudentClassGroup[]> {
  return parse(await fetch(`${backendUrl}/class-groups/joined`, { headers: headers(token) }));
}

export async function joinClassGroup(token: string, joinCode: string): Promise<StudentClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups/join`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ join_code: joinCode }),
  }));
}

export async function updateClassMembership(
  token: string,
  groupId: number,
  request: Partial<StudentClassGroup['membership']>,
): Promise<StudentClassGroup> {
  return parse(await fetch(`${backendUrl}/class-groups/${groupId}/membership`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(request),
  }));
}

export async function leaveClassGroup(token: string, groupId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/class-groups/${groupId}/membership`, {
    method: 'DELETE', headers: headers(token),
  });
  if (!response.ok) await parse(response);
}

export async function readClassLeaderboard(token: string, challengeId: number): Promise<ClassLeaderboard> {
  return parse(await fetch(`${backendUrl}/class-challenges/${challengeId}/leaderboard`, { headers: headers(token) }));
}

export async function readClassChallengeStatistics(token: string, challengeId: number): Promise<ClassChallengeStatistics> {
  return parse(await fetch(`${backendUrl}/class-challenges/${challengeId}/statistics`, { headers: headers(token) }));
}
