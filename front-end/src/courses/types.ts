import type { JSONContent } from '@tiptap/core';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'public' | 'unlisted';
export type LessonEditorType = 'none' | 'python' | 'blockly';
export type LessonStartMode = 'fresh' | 'inherit_previous_code';
export type CompletionPolicy = 'self' | 'activity' | 'teacher_review' | 'hybrid';
export type StageSourceType = 'default' | 'github' | 'marketplace';

export type TiptapNode = JSONContent;

export interface ActivityBase {
  key: string;
  version: 1;
  required: boolean;
  definitionHash?: string;
}

export interface RichTextActivity extends ActivityBase {
  type: 'rich_text';
  content: TiptapNode | string;
}

export interface ChoiceOption { key: string; label: string }

export interface MultipleChoiceActivity extends ActivityBase {
  type: 'multiple_choice';
  prompt: string;
  options: ChoiceOption[];
  correctOptionKey?: string;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface MultipleSelectActivity extends ActivityBase {
  type: 'multiple_select';
  prompt: string;
  options: ChoiceOption[];
  correctOptionKeys?: string[];
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface NumericAnswerActivity extends ActivityBase {
  type: 'numeric_answer';
  prompt: string;
  expectedValue?: number;
  unit: string;
  tolerance: { mode: 'absolute' | 'percentage'; value: number };
  validRange?: { minimum?: number | null; maximum?: number | null } | null;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface ShortReflectionActivity extends ActivityBase {
  type: 'short_reflection';
  prompt: string;
  collectResponse: boolean;
}

export type SensorHelperMode = 'hidden' | 'student_toggle' | 'always_visible';
export type SensorPresentation = 'live' | 'chart' | 'summary';
export type SensorStatistic = 'minimum' | 'maximum' | 'average' | 'finalValue';

export interface SimulatorObservationActivity extends ActivityBase {
  type: 'simulator_observation';
  prompt: string;
  allowedSensors: string[];
  sensorHelperMode: SensorHelperMode;
  presentations: SensorPresentation[];
  capturedStatistics: SensorStatistic[];
  visibleStatistics: SensorStatistic[];
}

export interface HintActivity extends ActivityBase {
  type: 'hint';
  content: TiptapNode | string;
  forActivityKey?: string | null;
}

export type MissionObjectiveRole = 'completion' | 'failure' | 'optional';
export type MissionCondition =
  | { type: 'reach_target'; markerId: string }
  | { type: 'checkpoints'; markerIds: string[]; ordered: boolean }
  | { type: 'collect'; markerIds: string[]; requiredCount: number }
  | { type: 'avoid_zones'; markerIds: string[] }
  | { type: 'stop_in_target'; markerId: string }
  | { type: 'object_in_zone'; objectId: string; zoneId: string }
  | { type: 'no_incident'; incidents: Array<'collision' | 'fall' | 'runtime_error'> }
  | { type: 'sensor_threshold'; sensorId: string; statistic: SensorStatistic; operator: 'lt' | 'lte' | 'eq' | 'gte' | 'gt'; threshold: number }
  | { type: 'actuator_state'; actuator: 'led' | 'buzzer'; state: string }
  | { type: 'limits'; maxDurationMs?: number; maxMovementActions?: number };

export interface MissionObjective {
  key: string;
  role: MissionObjectiveRole;
  summary: string;
  condition: MissionCondition;
}

export interface MissionActivity extends ActivityBase {
  type: 'mission';
  title: string;
  completionMode: 'all' | 'any';
  objectives: MissionObjective[];
  retryLimit?: number | null;
  feedbackMode: 'immediate' | 'after_attempt';
}

export type Activity = RichTextActivity | MultipleChoiceActivity | MultipleSelectActivity | NumericAnswerActivity | ShortReflectionActivity | SimulatorObservationActivity | MissionActivity | HintActivity;

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
  has_unpublished_changes?: boolean;
  unpublished_change_summary?: {
    course: boolean;
    outline: boolean;
    lesson_keys: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface ReleaseLesson {
  lessonKey: string;
  title: string;
  position: number;
  activities: Activity[];
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
  completion_method?: 'self' | 'activity' | 'hybrid' | null;
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
  activities: Activity[];
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
  activities?: Activity[];
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

export interface SensorSummaryValue {
  unit: string;
  minimum?: number;
  maximum?: number;
  average?: number;
  finalValue?: number;
  sampleCount: number;
}

export interface CompactSensorSummary {
  runId: string;
  durationMs: number;
  sensors: Record<string, SensorSummaryValue>;
}

export interface ActivityState {
  activity_key: string;
  type: Activity['type'];
  required: boolean;
  submitted_value?: unknown;
  correctness?: boolean | null;
  satisfied: boolean;
  attempt_count: number;
  sensor_summary?: CompactSensorSummary | null;
  first_submitted_at?: string | null;
  last_submitted_at?: string | null;
  satisfied_at?: string | null;
}

export interface ActivitySubmissionResponse {
  state: ActivityState;
  feedback?: string | null;
  duplicate: boolean;
  lesson_completed: boolean;
}

export interface MissionAttemptMetrics {
  elapsed_ms: number;
  movement_actions: number;
  path_distance: number;
  collisions: number;
  falls: number;
  resets: number;
  collectibles: number;
  sensor_summaries: Record<string, Record<string, number | string>>;
}

export interface MissionAttemptSubmission {
  schema_version: 1;
  client_attempt_id: string;
  started_at: string;
  ended_at: string;
  outcome: 'succeeded' | 'failed' | 'stopped' | 'runtime_error';
  completion_reason: 'objectives_met' | 'failure_objective' | 'program_completed' | 'stop' | 'reset' | 'runtime_error' | 'fall' | 'timeout' | 'navigation';
  objective_results: Array<{ key: string; role: MissionObjectiveRole; status: 'pending' | 'succeeded' | 'failed' }>;
  metrics: MissionAttemptMetrics;
  simulator_revision: string;
  stage_revision: string;
  mission_definition_hash: string;
}

export interface MissionAttemptRecord extends MissionAttemptSubmission {
  id: number;
  enrollment_id: number;
  release_id: number;
  lesson_key: string;
  activity_key: string;
  attempt_number: number;
  created_at: string;
}
