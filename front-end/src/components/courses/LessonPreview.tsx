import React from 'react';
import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type { Activity, Lesson } from 'src/courses/types';
import RichTextContent from './RichTextContent';

interface LessonPreviewProps {
  lesson: Lesson;
  resetCopy: string;
  labels: { lesson: string; noCode: string; python: string; blockly: string; noStage: string; required: string; answerIn: string };
}

export default function LessonPreview({ lesson, resetCopy, labels }: LessonPreviewProps) {
  return (
    <Paper variant="outlined" sx={{ maxWidth: 920, mx: 'auto', overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">{labels.lesson}</Typography>
            <Typography variant="h4" component="h2" sx={{ textWrap: 'balance' }}>{lesson.title}</Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" alignContent="flex-start">
            <Chip size="small" label={lesson.editor_type === 'none' ? labels.noCode : lesson.editor_type === 'python' ? labels.python : labels.blockly} />
            <Chip size="small" label={lesson.stageReference?.title || labels.noStage} variant="outlined" />
          </Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Stack spacing={2.5} sx={{ maxWidth: '72ch' }}>{lesson.activities.map((activity) => <PreviewActivity key={activity.key} activity={activity} labels={labels} />)}</Stack>
        {lesson.editor_type === 'python' && typeof lesson.starter_content === 'string' && <Box component="pre" sx={{ mt: 3, p: 2, borderRadius: 1.5, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto', fontSize: 13 }}>{lesson.starter_content}</Box>}
        {lesson.editor_type === 'blockly' && lesson.starter_content && <Alert severity="info" sx={{ mt: 3 }}>A saved Blockly starter workspace will be restored for the student.</Alert>}
        {lesson.stageReference && <Alert severity="info" sx={{ mt: 3 }}>{resetCopy}</Alert>}
      </Box>
    </Paper>
  );
}

function PreviewActivity({ activity, labels }: { activity: Activity; labels: LessonPreviewProps['labels'] }) {
  if (activity.type === 'rich_text' || activity.type === 'hint') return <RichTextContent content={activity.content} />;
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={650}>{activity.prompt}</Typography>{activity.required && <Chip size="small" label={labels.required} />}</Stack>{(activity.type === 'multiple_choice' || activity.type === 'multiple_select') && <Stack component="ul" sx={{ my: 1, pl: 3 }}>{activity.options.map((option) => <li key={option.key}>{option.label}</li>)}</Stack>}{activity.type === 'numeric_answer' && <Typography color="text.secondary">{labels.answerIn} {activity.unit}</Typography>}{activity.type === 'simulator_observation' && <Typography color="text.secondary">{activity.allowedSensors.join(', ')}</Typography>}</Paper>;
}
