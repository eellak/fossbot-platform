import React, { useState } from 'react';
import { Button, IconButton, Paper, Popover, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useEditorTheme } from './stageBuilderEditorTheme';
import type { EditorLineObject } from './types';
import type { LineOperation } from './stageBuilderLineEditing';

export function StageLineToolbar({ line, operation, onChange }: {
  line?: EditorLineObject;
  operation: LineOperation;
  onChange: (operation: LineOperation) => void;
}) {
  const { colors } = useEditorTheme();
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null);
  const editing = operation.mode !== 'select';
  if (!line && !editing) return null;
  const index = operation.mode === 'edit' && line ? operation.pointIndex ?? line.points.length - 1 : null;
  const instruction = index === null ? 'Click the floor to add the first point.'
    : !line?.closed && index === 0 && line!.points.length > 1 ? 'Click the floor to extend from point 1.'
    : `Click the floor to add after point ${index + 1}.`;
  return <Paper role="region" aria-label="Line editing" elevation={0} sx={{ p: 0.5, bgcolor: colors.panel, color: colors.text, border: `1px solid ${colors.border}`, maxWidth: '100%' }}>
    {editing ? <Stack direction="row" alignItems="center" gap={0.5}>
      <Typography role="status" aria-label={index === null ? 'Editing new line' : `Editing line, point ${index + 1}`} variant="body2" sx={{ px: 0.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {index === null ? 'New line' : `Line · point ${index + 1}`}
      </Typography>
      <IconButton size="small" aria-label="Line editing help" aria-expanded={Boolean(helpAnchor)} onClick={event => setHelpAnchor(helpAnchor ? null : event.currentTarget)} sx={{ color: colors.textMuted }}>
        <HelpOutlineIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Tooltip title="Finish editing (Esc)" disableInteractive>
        <Button size="small" variant="contained" disableElevation onClick={() => { setHelpAnchor(null); onChange({ mode: 'select' }); }} sx={{ minWidth: 0 }}>Done</Button>
      </Tooltip>
      <Popover open={Boolean(helpAnchor)} anchorEl={helpAnchor} onClose={() => setHelpAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }} PaperProps={{ sx: { p: 1.5, maxWidth: 280, bgcolor: colors.panel, color: colors.text } }}>
        <Stack spacing={1}>
          <Typography variant="body2">Drag squares to move points. Drag diamonds to adjust rounding.</Typography>
          <Typography variant="body2">Click a square to choose where to add. Move over the floor to preview the next point. {instruction}</Typography>
          {!line?.closed && <Typography variant="body2">Select an endpoint, then click the opposite endpoint to close the loop.</Typography>}
          <Typography variant="body2">Escape cancels a drag. Otherwise, Escape or Done finishes editing.</Typography>
        </Stack>
      </Popover>
    </Stack> : line && <Button size="small" variant="outlined" disabled={line.locked} onClick={() => onChange({ mode: 'edit', pathId: line.id, pointIndex: line.points.length - 1 })}>Edit line</Button>}
  </Paper>;
}
