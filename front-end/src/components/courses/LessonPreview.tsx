import React from 'react';
import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { Lesson } from 'src/courses/types';
import { richTextActivity } from 'src/courses/courseAuthoring';

interface LessonPreviewProps {
  lesson: Lesson;
  resetCopy: string;
  labels: { lesson: string; noCode: string; python: string; blockly: string; noStage: string };
}

export default function LessonPreview({ lesson, resetCopy, labels }: LessonPreviewProps) {
  const activity = richTextActivity(lesson);
  const html = generateHTML(activity.content as any, [StarterKit]);
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
        <Box sx={{ maxWidth: '72ch', lineHeight: 1.7, '& p': { my: 1.25 }, '& h2': { mt: 3 } }} dangerouslySetInnerHTML={{ __html: html }} />
        {lesson.editor_type === 'python' && typeof lesson.starter_content === 'string' && <Box component="pre" sx={{ mt: 3, p: 2, borderRadius: 1.5, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto', fontSize: 13 }}>{lesson.starter_content}</Box>}
        {lesson.editor_type === 'blockly' && lesson.starter_content && <Alert severity="info" sx={{ mt: 3 }}>A saved Blockly starter workspace will be restored for the student.</Alert>}
        {lesson.stageReference && <Alert severity="info" sx={{ mt: 3 }}>{resetCopy}</Alert>}
      </Box>
    </Paper>
  );
}
