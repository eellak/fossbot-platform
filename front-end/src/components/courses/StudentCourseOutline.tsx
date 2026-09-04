import React from 'react';
import { Box, Chip, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import type { LessonProgress, ReleaseLesson } from 'src/courses/types';

interface Props {
  lessons: ReleaseLesson[];
  progress?: LessonProgress[];
  selectedKey?: string;
  onSelect?: (lessonKey: string) => void;
  title: string;
  completedLabel: string;
}

export default function StudentCourseOutline({ lessons, progress = [], selectedKey, onSelect, title, completedLabel }: Props) {
  const states = new Map(progress.map((item) => [item.lesson_key, item.state]));
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      </Box>
      <List disablePadding aria-label={title}>
        {lessons.map((lesson) => {
          const complete = states.get(lesson.lessonKey) === 'completed';
          return (
            <ListItemButton key={lesson.lessonKey} selected={lesson.lessonKey === selectedKey} onClick={() => onSelect?.(lesson.lessonKey)}>
              <ListItemText primary={`${lesson.position}. ${lesson.title}`} />
              {complete ? <Chip size="small" color="success" icon={<IconCircleCheckFilled size={15} />} label={completedLabel} /> : null}
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}
