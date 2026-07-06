import React from 'react';
import { Alert, Box, Button, ButtonGroup, Chip, Divider, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import type { EditorStageObject, StageBuilderMode } from './types';
import type { StageBuilderSnapPreset } from './stageBuilderPreferences';
import type { StageBuilderTransformMode, StageBuilderPlacementStatus } from './StageBuilderScene';
import type { StageBuilderSnapSettings } from './stageBuilderSnapping';
import { snapLabel } from './stageBuilderSnapping';
import { displayObjectType } from './stageBuilderCatalog';
import { validationSummary, type StageBuilderValidationResult } from './stageBuilderValidation';

export interface StageBuilderToolbarProps {
  mode: StageBuilderMode;
  transformMode: StageBuilderTransformMode;
  snapPreset: StageBuilderSnapPreset;
  snapSettings: StageBuilderSnapSettings;
  selectedObject: EditorStageObject | null;
  selectedCount: number;
  validationResults: StageBuilderValidationResult[];
  placementStatus: StageBuilderPlacementStatus | null;
  shortcutsEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  studio?: boolean;
  onModeChange: (mode: StageBuilderMode) => void;
  onTransformModeChange: (mode: StageBuilderTransformMode) => void;
  onSnapPresetChange: (preset: StageBuilderSnapPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocusSelected: () => void;
  onSave: () => void;
  onTest: () => void;
}

const modeHelp: Record<StageBuilderMode, string> = {
  navigate: 'Camera only',
  place: 'Click the stage to place objects',
  edit: 'Select and adjust objects',
  test: 'Validate and preview in the simulator',
};

export function StageBuilderToolbar({
  mode,
  transformMode,
  snapPreset,
  snapSettings,
  selectedObject,
  selectedCount,
  validationResults,
  placementStatus,
  shortcutsEnabled,
  canUndo,
  canRedo,
  studio = false,
  onModeChange,
  onTransformModeChange,
  onSnapPresetChange,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onFocusSelected,
  onSave,
  onTest,
}: StageBuilderToolbarProps) {
  const selectedLabel = selectedObject ? `${displayObjectType(selectedObject)}: ${selectedObject.name}` : 'Nothing selected';

  return (
    <Paper sx={{ p: 1.25, borderRadius: studio ? 1.5 : 4, bgcolor: studio ? 'rgba(15,23,42,.94)' : 'rgba(255,255,255,.94)', color: studio ? '#fff' : 'inherit', maxWidth: 'min(980px, calc(100vw - 32px))' }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, value) => value && onModeChange(value)} aria-label="Builder mode">
            <ToggleButton value="navigate">Navigate{shortcutsEnabled ? ' Q' : ''}</ToggleButton>
            <ToggleButton value="place">Place</ToggleButton>
            <ToggleButton value="edit">Edit</ToggleButton>
            <ToggleButton value="test">Test</ToggleButton>
          </ToggleButtonGroup>
          <Chip size="small" label={modeHelp[mode]} />
          <Divider flexItem orientation="vertical" />
          <ButtonGroup size="small" variant="outlined" disabled={mode !== 'edit'}>
            <Button variant={transformMode === 'translate' ? 'contained' : 'outlined'} onClick={() => onTransformModeChange('translate')}>Move{shortcutsEnabled ? ' W' : ''}</Button>
            <Button variant={transformMode === 'rotate' ? 'contained' : 'outlined'} onClick={() => onTransformModeChange('rotate')}>Turn{shortcutsEnabled ? ' E' : ''}</Button>
            <Button variant={transformMode === 'scale' ? 'contained' : 'outlined'} onClick={() => onTransformModeChange('scale')}>Resize{shortcutsEnabled ? ' R' : ''}</Button>
          </ButtonGroup>
          <Divider flexItem orientation="vertical" />
          <ToggleButtonGroup size="small" exclusive value={snapPreset} onChange={(_, value) => value && onSnapPresetChange(value)} aria-label="Snapping preset">
            <ToggleButton value="free">Free</ToggleButton>
            <ToggleButton value="fine">Fine</ToggleButton>
            <ToggleButton value="grid">Grid</ToggleButton>
          </ToggleButtonGroup>
          <Chip size="small" label={snapLabel(snapSettings)} />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" sx={{ minWidth: 180 }}>{selectedCount > 1 ? `${selectedCount} objects selected` : selectedLabel}</Typography>
          <Tooltip title="Undo"><span><Button size="small" disabled={!canUndo} onClick={onUndo} startIcon={<UndoIcon />}>{shortcutsEnabled ? 'Ctrl-Z' : 'Undo'}</Button></span></Tooltip>
          <Tooltip title="Redo"><span><Button size="small" disabled={!canRedo} onClick={onRedo} startIcon={<RedoIcon />}>{shortcutsEnabled ? 'Ctrl-Y' : 'Redo'}</Button></span></Tooltip>
          <Tooltip title="Duplicate"><span><Button size="small" disabled={!selectedCount} onClick={onDuplicate} startIcon={<ContentCopyIcon />}>{shortcutsEnabled ? 'Ctrl-D' : 'Duplicate'}</Button></span></Tooltip>
          <Tooltip title="Delete"><span><Button size="small" color="error" disabled={!selectedCount} onClick={onDelete} startIcon={<DeleteIcon />}>{shortcutsEnabled ? 'Delete' : 'Delete'}</Button></span></Tooltip>
          <Tooltip title="Focus selected"><span><Button size="small" disabled={!selectedCount} onClick={onFocusSelected} startIcon={<CenterFocusStrongIcon />}>{shortcutsEnabled ? 'F' : 'Focus'}</Button></span></Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" variant="outlined" onClick={onSave} startIcon={<SaveIcon />}>Save</Button>
          <Button size="small" variant="contained" color="success" onClick={onTest} startIcon={<PlayArrowIcon />}>Run test</Button>
        </Stack>
        {mode === 'place' && placementStatus && (
          <Alert severity={placementStatus.valid ? 'success' : 'error'} sx={{ py: 0 }}>{placementStatus.reason}</Alert>
        )}
        {mode === 'test' && (
          <Alert severity={validationResults.some((item) => item.severity === 'error' && !(item.overridable && item.overridden)) ? 'error' : 'info'} sx={{ py: 0 }}>
            {validationSummary(validationResults)} · Press Run test to preview the current stage.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
