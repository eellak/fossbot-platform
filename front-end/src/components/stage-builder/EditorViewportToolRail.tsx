import React from 'react';
import { Divider, IconButton, Paper, Stack, ToggleButton, Tooltip } from '@mui/material';
import MouseIcon from '@mui/icons-material/Mouse';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import SensorsIcon from '@mui/icons-material/Sensors';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnet } from '@fortawesome/free-solid-svg-icons';
import type { StageBuilderTransformMode } from './StageBuilderScene';
import type { StageBuilderSnapPreset } from './stageBuilderPreferences';
import { snapPresetLabel } from './stageBuilderSnapping';
import { useEditorTheme } from './stageBuilderEditorTheme';

export interface EditorViewportToolRailProps {
  transformMode: StageBuilderTransformMode;
  snapPreset: StageBuilderSnapPreset;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  sensorHelpersVisible?: boolean;
  onTransformModeChange: (mode: StageBuilderTransformMode) => void;
  onSnapPresetChange: (preset: StageBuilderSnapPreset) => void;
  onSensorHelpersToggle?: () => void;
  onFocusSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

export function EditorViewportToolRail({
  transformMode,
  snapPreset,
  selectedCount,
  canUndo,
  canRedo,
  sensorHelpersVisible = false,
  onTransformModeChange,
  onSnapPresetChange,
  onSensorHelpersToggle,
  onFocusSelected,
  onUndo,
  onRedo,
  onDelete,
}: EditorViewportToolRailProps) {
  const { colors: editorColors } = useEditorTheme();
  const normalizedSnap = snapPreset === 'free' || snapPreset === 'grid' ? 'medium' : snapPreset;
  const snappingOn = normalizedSnap !== 'off';

  const toolButtonSx = {
    width: 34,
    height: 34,
    minWidth: 34,
    p: 0,
    color: editorColors.textMuted,
    border: 0,
    borderRadius: '6px !important',
    '&:hover': { bgcolor: editorColors.panelRaised },
    '&.Mui-selected': {
      color: editorColors.accentText,
      bgcolor: editorColors.accentSoft,
      '&:hover': { bgcolor: `${editorColors.accent}2b` },
    },
  } as const;

  const iconButtonSx = {
    width: 34,
    height: 34,
    color: editorColors.textMuted,
    borderRadius: 1,
    '&:hover': { bgcolor: editorColors.panelRaised },
    '&.Mui-disabled': { color: editorColors.textSubtle },
  } as const;

  return (
    <Paper elevation={0} sx={{ p: 0.5, bgcolor: editorColors.panel, color: editorColors.text, border: `1px solid ${editorColors.border}`, borderRadius: 1, boxShadow: 'none' }}>
      <Stack spacing={0.5} alignItems="center">
        <Tooltip title="Select"><ToggleButton size="small" value="select" selected={transformMode === 'select'} onClick={() => onTransformModeChange('select')} sx={toolButtonSx}><MouseIcon fontSize="small" /></ToggleButton></Tooltip>
        <Divider flexItem sx={{ borderColor: editorColors.border }} />
        <Stack spacing={0.5} alignItems="center">
          <Tooltip title="Move"><ToggleButton size="small" value="translate" selected={transformMode === 'translate'} onClick={() => onTransformModeChange('translate')} sx={toolButtonSx}><OpenWithIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip title="Rotate"><ToggleButton size="small" value="rotate" selected={transformMode === 'rotate'} onClick={() => onTransformModeChange('rotate')} sx={toolButtonSx}><RotateRightIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip title="Scale"><ToggleButton size="small" value="scale" selected={transformMode === 'scale'} onClick={() => onTransformModeChange('scale')} sx={toolButtonSx}><AspectRatioIcon fontSize="small" /></ToggleButton></Tooltip>
        </Stack>
        <Divider flexItem sx={{ borderColor: editorColors.border }} />
        <Tooltip title={`Snap ${snappingOn ? 'on' : 'off'} · ${snapPresetLabel(normalizedSnap)}. Change snap size in Settings.`}>
          <IconButton size="small" onClick={() => onSnapPresetChange(snappingOn ? 'off' : 'medium')} sx={{ ...iconButtonSx, color: snappingOn ? editorColors.accentText : editorColors.textMuted }} aria-label="Toggle snapping">
            <FontAwesomeIcon icon={faMagnet} style={{ width: 14, height: 14 }} />
          </IconButton>
        </Tooltip>
        <Divider flexItem sx={{ borderColor: editorColors.border }} />
        <Tooltip title={`${sensorHelpersVisible ? 'Hide' : 'Show'} sensor helpers`}>
          <IconButton size="small" onClick={onSensorHelpersToggle} sx={{ ...iconButtonSx, color: sensorHelpersVisible ? editorColors.accentText : editorColors.textMuted }} aria-label="Toggle sensor helpers">
            <SensorsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Focus selected"><span><IconButton size="small" disabled={!selectedCount} onClick={onFocusSelected} sx={iconButtonSx}><CenterFocusStrongIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Undo"><span><IconButton size="small" disabled={!canUndo} onClick={onUndo} sx={iconButtonSx}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Redo"><span><IconButton size="small" disabled={!canRedo} onClick={onRedo} sx={iconButtonSx}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Delete"><span><IconButton size="small" disabled={!selectedCount} onClick={onDelete} sx={{ ...iconButtonSx, color: editorColors.danger }}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
      </Stack>
    </Paper>
  );
}
