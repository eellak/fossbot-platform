import { useState } from 'react';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import ActivityComposer from 'src/components/courses/activities/ActivityComposer';
import type { Activity } from 'src/courses/types';
import { LocalStageList } from 'src/stages/OpenLocalStageDialog';
import type { LocalStage } from 'src/stages/LocalStagesApi';

const updatedJustNow = new Date().toISOString();
const updatedEarlier = new Date(Date.now() - 42 * 60_000).toISOString();

const initialActivities: Activity[] = [
  {
    key: 'comparison-question',
    version: 1,
    required: true,
    type: 'multiple_choice',
    prompt: 'Which control starts the robot program?',
    options: [
      { key: 'run', label: 'Run' },
      { key: 'reset', label: 'Reset simulation' },
    ],
    correctOptionKey: 'run',
    feedbackCorrect: 'Correct—the Run control starts the program.',
    feedbackIncorrect: 'Look at the primary action above the workspace.',
  },
  {
    key: 'comparison-question-hint',
    version: 1,
    required: false,
    type: 'hint',
    forActivityKey: 'comparison-question',
    content: 'The primary action is filled blue.',
  },
  {
    key: 'comparison-mission',
    version: 1,
    required: true,
    type: 'mission',
    title: 'Reach the finish without a collision',
    completionMode: 'all',
    retryLimit: 2,
    feedbackMode: 'immediate',
    objectives: [
      {
        key: 'comparison-time-limit',
        role: 'completion',
        summary: 'Finish within 60 seconds and 12 movement actions.',
        condition: { type: 'limits', maxDurationMs: 60_000, maxMovementActions: 12 },
      },
      {
        key: 'comparison-no-collision',
        role: 'failure',
        summary: 'The attempt ends after a collision or fall.',
        condition: { type: 'no_incident', incidents: ['collision', 'fall'] },
      },
    ],
  },
];

const previewStages: LocalStage[] = [
  {
    id: -101,
    slug: 'comparison-obstacle-course',
    title: 'Obstacle course',
    description: 'Synthetic comparison fixture',
    visibility: 'private',
    record: { id: 'comparison-obstacle-course', title: 'Obstacle course', description: 'Synthetic comparison fixture', createdAt: updatedEarlier, updatedAt: updatedJustNow, config: [] },
    recordBytes: 18432,
    revision: 4,
    checksum: 'comparison-obstacle-course-r4',
    createdAt: updatedEarlier,
    updatedAt: updatedJustNow,
  },
  {
    id: -102,
    slug: 'comparison-line-following',
    title: 'Line-following practice',
    description: 'Synthetic comparison fixture',
    visibility: 'private',
    record: { id: 'comparison-line-following', title: 'Line-following practice', description: 'Synthetic comparison fixture', createdAt: updatedEarlier, updatedAt: updatedEarlier, config: [] },
    recordBytes: 9216,
    revision: 2,
    checksum: 'comparison-line-following-r2',
    createdAt: updatedEarlier,
    updatedAt: updatedEarlier,
  },
];

export default function CourseAuthoringPreview({ proposed = false }: { proposed?: boolean }) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState(initialActivities);
  const [selectedStage, setSelectedStage] = useState<LocalStage | null>(null);

  return <PageContainer title="Course authoring comparison" description="Development-only blocks and separators fixture">
    <Box data-preview-appearance={proposed ? 'proposed' : 'current'} sx={{ py: 3, maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
        <Box>
          <Typography component="h1" variant="h3">Course authoring</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: '72ch' }}>
            Review activity boundaries, nested mission controls, saved-stage rows, and routine feedback together.
          </Typography>
        </Box>
        <Chip size="small" variant="outlined" label="Synthetic fixture" />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Preview only · Changes reset when this page reloads.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(300px, 0.75fr)' }, gap: 3, mt: 3, alignItems: 'start' }}>
        <Box component="section" aria-labelledby="comparison-activities-title">
          <Typography id="comparison-activities-title" component="h2" variant="h5" sx={{ mb: 2 }}>Activity and nested blocks</Typography>
          <ActivityComposer
            activities={activities}
            onChange={setActivities}
            stageReference={{ sourceType: 'default', title: 'White field', url: '/js-simulator/stages/stage_white_rect.json' }}
            t={t}
          />
        </Box>

        <Stack component="aside" spacing={3}>
          <Box component="section" aria-labelledby="comparison-stages-title">
            <Typography id="comparison-stages-title" component="h2" variant="h5" sx={{ mb: 2 }}>Saved-stage rows</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">Choose a stage saved in this FOSSBot instance.</Typography>
                {selectedStage && <Typography role="status" variant="body2" color="success.main" fontWeight={650}>Selected · {selectedStage.title}</Typography>}
                <LocalStageList stages={previewStages} busy={false} selectedStageId={selectedStage?.id} onOpenStage={setSelectedStage} />
              </Stack>
            </Paper>
          </Box>

          <Box component="section" aria-labelledby="comparison-callouts-title">
            <Typography id="comparison-callouts-title" component="h2" variant="h5" sx={{ mb: 2 }}>Status and guidance</Typography>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">Editor</Typography>
                <Typography variant="body2">Python</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" variant="outlined" color="warning" label="Unpublished changes" />
                <Typography variant="body2" color="text.secondary">Students still see the published version.</Typography>
              </Stack>
              <Alert severity="error">A referenced stage marker is missing.</Alert>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  </PageContainer>;
}
