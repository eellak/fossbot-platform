import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { StageBuilderValidationResult } from './stageBuilderValidation';

export interface StageValidationPanelProps {
  results: StageBuilderValidationResult[];
  onToggleOverride?: (id: string, enabled: boolean) => void;
  onFocusObjects?: (ids: string[]) => void;
  compact?: boolean;
}

export function StageValidationPanel({ results, onToggleOverride, onFocusObjects, compact = false }: StageValidationPanelProps) {
  const ignored = (item: StageBuilderValidationResult) => item.severity !== 'error' && item.overridable && item.overridden;
  const sections = [
    { title: 'Errors', items: results.filter(item => item.severity === 'error') },
    { title: 'Warnings', items: results.filter(item => item.severity === 'warning' && !ignored(item)) },
    { title: 'Notices', items: results.filter(item => item.severity === 'info' && !ignored(item)) },
    { title: 'Ignored', items: results.filter(ignored) },
  ];
  return <Stack spacing={1.5}>
    {!results.some(item => item.severity !== 'info' && !ignored(item)) && <Alert severity="success">Stage looks ready.</Alert>}
    {sections.map(section => section.items.length > 0 && <Stack key={section.title} spacing={0.75}>
      <Typography variant="subtitle2">{section.title} ({section.items.length})</Typography>
      {section.items.map(item => <Alert key={item.id} severity={ignored(item) ? 'info' : item.severity}>
        <Stack spacing={0.75}>
          <Typography variant="body2" fontWeight={600}>{item.message}</Typography>
          {!compact && <Typography variant="caption">{item.reason}</Typography>}
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {!!item.objectIds.length && onFocusObjects && <Button size="small" variant="outlined" onClick={() => onFocusObjects(item.objectIds)}>Select and repair</Button>}
            {item.severity !== 'error' && item.overridable && onToggleOverride && <Button size="small" variant="outlined" onClick={() => onToggleOverride(item.id, !ignored(item))}>{ignored(item) ? 'Restore warning' : 'Ignore warning'}</Button>}
          </Stack>
        </Stack>
      </Alert>)}
    </Stack>)}
  </Stack>;
}
