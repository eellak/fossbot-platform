import React, { useState } from 'react';
import { Box, ButtonBase, Chip, Collapse, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { IconChevronDown, IconCircleCheckFilled } from '@tabler/icons-react';
import type { LessonProgress, ReleaseLesson } from 'src/courses/types';

interface Props {
  lessons: ReleaseLesson[];
  progress?: LessonProgress[];
  selectedKey?: string;
  onSelect?: (lessonKey: string) => void;
  title: string;
  completedLabel: string;
  /** Renders the header as a toggle and starts with the outline hidden. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function StudentCourseOutline({ lessons, progress = [], selectedKey, onSelect, title, completedLabel, collapsible = false, defaultOpen = true }: Props) {
  const states = new Map(progress.map((item) => [item.lesson_key, item.state]));
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;
  const list = (
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
  );

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {collapsible ? (
        <ButtonBase
          onClick={() => setOpen((value) => !value)}
          aria-expanded={expanded}
          sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', px: 2, py: 1.5, borderBottom: expanded ? '1px solid' : 'none', borderColor: 'divider' }}
        >
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>{title}</Typography>
          <IconChevronDown size={18} aria-hidden style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </ButtonBase>
      ) : (
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        </Box>
      )}
      {collapsible ? <Collapse in={expanded}>{list}</Collapse> : list}
    </Paper>
  );
}
