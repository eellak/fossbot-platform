import type { JSONContent } from '@tiptap/core';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'public' | 'unlisted';
export type LessonEditorType = 'none' | 'python' | 'blockly';
export type LessonStartMode = 'fresh' | 'inherit_previous_code';
export type CompletionPolicy = 'self' | 'activity' | 'teacher_review' | 'hybrid';
export type StageSourceType = 'default' | 'github' | 'marketplace';

export type TiptapNode = JSONContent;

export interface RichTextActivity {
  key: string;
  type: 'rich_text';
  version: 1;
  content: TiptapNode | string;
}

export interface StageReference {
  sourceType: StageSourceType;
  repoOwner?: string | null;
  repoName?: string | null;
  visibility?: string | null;
  marketplaceEntryPath?: string | null;
  title?: string | null;
  url?: string | null;
  commitSha?: string | null;
}

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  author_id: number;
  learning_objectives: string[];
  status: CourseStatus;
  visibility: CourseVisibility;
  cover_image_url?: string | null;
  age_range?: string | null;
  difficulty?: string | null;
  estimated_duration_minutes?: number | null;
  prerequisites?: string | null;
  tags?: string[] | null;
  latest_published_release_id?: number | null;
  latest_published_release_version?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseLesson {
  lessonKey: string;
  title: string;
  position: number;
  activities: RichTextActivity[];
  completionPolicy: CompletionPolicy;
  startMode: LessonStartMode;
  editorType: LessonEditorType;
  starterContent?: string | Record<string, unknown> | null;
  simulatorSettings?: Record<string, unknown> | null;
  stageReference?: StageReference | null;
  definitionHash: string;
}

export interface StudentCourse extends CourseSummary {
  author_name: string;
  latest_release: {
    id: number;
    version: number;
    published_at: string;
    lessons: ReleaseLesson[];
  };
}

export interface LessonProgress {
  lesson_key: string;
  state: 'not_started' | 'in_progress' | 'completed';
  started_at?: string | null;
  completed_at?: string | null;
  completion_method?: 'self' | null;
}

export interface Enrollment {
  id: number;
  course_id: number;
  course: {
    title: string;
    description: string;
    author_name: string;
    learning_objectives: string[];
    cover_image_url?: string | null;
    age_range?: string | null;
    difficulty?: string | null;
    estimated_duration_minutes?: number | null;
    prerequisites?: string | null;
    tags?: string[] | null;
    visibility: CourseVisibility;
  };
  active_release: { id: number; version: number; published_at: string; lessons: ReleaseLesson[] };
  progress: LessonProgress[];
  completed_count: number;
  lesson_count: number;
  progress_percent: number;
  resume_lesson_key?: string | null;
  enrolled_at: string;
  completed_at?: string | null;
  release_updated_at?: string | null;
  update_available: boolean;
}

export interface ReleaseUpdate {
  available: boolean;
  current: { id: number; version: number; published_at: string };
  latest: { id: number; version: number; published_at: string };
  added_lessons: number;
  removed_lessons: number;
  changed_lessons: number;
  unchanged_lessons: number;
  stage_revisions_changed: boolean;
}

export interface LessonWorkspace {
  id: number;
  enrollment_id: number;
  release_id: number;
  lesson_key: string;
  editor_type: LessonEditorType;
  content?: string | Record<string, unknown> | null;
  origin: { type: 'fresh' | 'inherited'; sourceLessonKey?: string; sourceWorkspaceRevision?: number };
  revision: number;
  initialized_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  lesson_key: string;
  course_id: number;
  title: string;
  position: number;
  activities: RichTextActivity[];
  completion_policy: CompletionPolicy;
  start_mode: LessonStartMode;
  editor_type: LessonEditorType;
  starter_content?: string | Record<string, unknown> | null;
  simulator_settings?: Record<string, unknown> | null;
  stageReference?: StageReference | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseDraft extends CourseSummary {
  lessons: Lesson[];
}

export interface CourseCreateRequest {
  title: string;
  description: string;
  learning_objectives: string[];
  visibility?: CourseVisibility;
  cover_image_url?: string | null;
  age_range?: string | null;
  difficulty?: string | null;
  estimated_duration_minutes?: number | null;
  prerequisites?: string | null;
  tags?: string[] | null;
}

export interface CourseUpdateRequest extends Partial<CourseCreateRequest> {
  expected_updated_at?: string;
}

export interface LessonSaveRequest {
  title: string;
  activities?: RichTextActivity[];
  completion_policy?: CompletionPolicy;
  start_mode?: LessonStartMode;
  editor_type?: LessonEditorType;
  starter_content?: string | Record<string, unknown> | null;
  simulator_settings?: Record<string, unknown> | null;
  stageReference?: StageReference | null;
  expected_updated_at?: string;
}

export interface PublicationIssue {
  group: 'Course' | 'Lesson' | 'Stage' | 'Starter content';
  code: string;
  message: string;
  lesson_id?: number | null;
  field?: string | null;
}

export interface PublicationValidation {
  valid: boolean;
  errors: PublicationIssue[];
}

export interface CourseRelease {
  id: number;
  course_id: number;
  version: number;
  schema_version: number;
  created_by_id: number;
  published_at: string;
  snapshot: Record<string, unknown>;
}
