import type { Enrollment, LessonWorkspace } from 'src/courses/types';
import LessonWorkspacePage from 'src/views/lesson-workspace-page/LessonWorkspacePage';

const previewLesson = {
  lessonKey: 'comparison-movement',
  title: 'Move through the course',
  position: 1,
  activities: [
    {
      key: 'comparison-introduction',
      version: 1 as const,
      required: false,
      type: 'rich_text' as const,
      content: 'Build a short program that moves the robot forward, then run it and review the output.',
    },
    {
      key: 'comparison-check',
      version: 1 as const,
      required: true,
      type: 'multiple_choice' as const,
      prompt: 'Which control starts your program?',
      options: [{ key: 'run', label: 'Run' }, { key: 'reset', label: 'Reset simulation' }],
      correctOptionKey: 'run',
    },
    {
      key: 'comparison-camera-check',
      version: 1 as const,
      required: false,
      type: 'multiple_choice' as const,
      prompt: 'Which control changes the simulator view?',
      options: [{ key: 'camera', label: 'Change camera' }, { key: 'run', label: 'Run' }],
      correctOptionKey: 'camera',
    },
  ],
  completionPolicy: 'hybrid' as const,
  startMode: 'fresh' as const,
  editorType: 'python' as const,
  starterContent: 'move_forward(30)\nturn_left(90)\nmove_forward(20)',
  simulatorSettings: { showSimulator: true },
  stageReference: { sourceType: 'default' as const, title: 'White field', url: '/js-simulator/stages/stage_white_rect.json' },
  definitionHash: 'comparison-fixture',
};

const previewEnrollment: Enrollment = {
  id: -1,
  course_id: -1,
  course: {
    title: 'Robotics foundations',
    description: 'A safe development-only course lesson used to compare workspace layouts.',
    author_name: 'FOSSBot team',
    learning_objectives: ['Control robot movement and interpret program output.'],
    visibility: 'public',
  },
  active_release: { id: -1, version: 1, published_at: '2026-01-01T00:00:00Z', lessons: [previewLesson] },
  progress: [{ lesson_key: previewLesson.lessonKey, state: 'in_progress' }],
  completed_count: 0,
  lesson_count: 1,
  progress_percent: 0,
  resume_lesson_key: previewLesson.lessonKey,
  enrolled_at: '2026-01-01T00:00:00Z',
  update_available: false,
};

const previewWorkspace: LessonWorkspace = {
  id: -1,
  enrollment_id: -1,
  release_id: -1,
  lesson_key: previewLesson.lessonKey,
  editor_type: 'python',
  content: previewLesson.starterContent,
  origin: { type: 'fresh' },
  revision: 1,
  initialized_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export default function LessonWorkspacePreview({ proposed = false }: { proposed?: boolean }) {
  return (
    <LessonWorkspacePage
      previewAppearance={proposed}
      courseIdOverride={previewEnrollment.course_id}
      lessonKeyOverride={previewLesson.lessonKey}
      previewFixture={{ enrollment: previewEnrollment, workspace: previewWorkspace }}
    />
  );
}
