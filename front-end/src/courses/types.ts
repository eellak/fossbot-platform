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
import type { JSONContent } from '@tiptap/core';
