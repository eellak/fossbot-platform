import React from 'react';
import { Divider, IconButton, MenuItem, Paper, Stack, TextField, ToggleButton, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import MouseIcon from '@mui/icons-material/Mouse';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import SensorsIcon from '@mui/icons-material/Sensors';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnet, faBorderAll } from '@fortawesome/free-solid-svg-icons';
import type { StageBuilderTransformMode } from './StageBuilderScene';
import type { StageBuilderSnapPreset, StageBuilderRotationSnapPreset } from './stageBuilderPreferences';
import { snapPresetLabel, rotationSnapPresetLabel } from './stageBuilderSnapping';
import { useEditorTheme } from './stageBuilderEditorTheme';

export interface EditorViewportToolRailProps {
  transformMode: StageBuilderTransformMode;
  lineOperation?: 'select' | 'edit';
  onFinishLine?: () => void;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  sensorHelpersVisible?: boolean;
  collisionWireVisible?: boolean;
  onTransformModeChange: (mode: StageBuilderTransformMode) => void;
  onSensorHelpersToggle?: () => void;
  onCollisionWireToggle?: () => void;
  onFocusSelected: () => void;
  onPlaceOnFloor?: () => void;
  canPlaceOnFloor?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

export function EditorViewportToolRail({
  transformMode,
  lineOperation = 'select',
  onFinishLine,
  selectedCount,
  canUndo,
  canRedo,
  sensorHelpersVisible = false,
  collisionWireVisible = false,
  onTransformModeChange,
  onSensorHelpersToggle,
  onCollisionWireToggle,
  onFocusSelected,
  onPlaceOnFloor,
  canPlaceOnFloor = false,
  onUndo,
  onRedo,
  onDelete,
}: EditorViewportToolRailProps) {
  const { colors: editorColors } = useEditorTheme();
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
        {lineOperation !== 'select' && <Tooltip disableInteractive title="Finish editing line"><IconButton aria-label="Finish editing line" aria-pressed={true} onClick={onFinishLine} sx={{ ...iconButtonSx, color: editorColors.accentText, bgcolor: editorColors.accentSoft }}><CheckIcon /></IconButton></Tooltip>}
        <Tooltip disableInteractive title="Select"><ToggleButton aria-label="Select" size="small" value="select" selected={lineOperation === 'select' && transformMode === 'select'} onClick={() => onTransformModeChange('select')} sx={toolButtonSx}><MouseIcon fontSize="small" /></ToggleButton></Tooltip>
        <Divider flexItem sx={{ borderColor: editorColors.border }} />
        <Stack spacing={0.5} alignItems="center">
          <Tooltip disableInteractive title="Move"><ToggleButton aria-label="Move" size="small" value="translate" selected={lineOperation === 'select' && transformMode === 'translate'} onClick={() => onTransformModeChange('translate')} sx={toolButtonSx}><OpenWithIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip disableInteractive title="Rotate"><ToggleButton aria-label="Rotate" size="small" value="rotate" selected={lineOperation === 'select' && transformMode === 'rotate'} onClick={() => onTransformModeChange('rotate')} sx={toolButtonSx}><RotateRightIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip disableInteractive title="Scale"><ToggleButton aria-label="Scale" size="small" value="scale" selected={lineOperation === 'select' && transformMode === 'scale'} onClick={() => onTransformModeChange('scale')} sx={toolButtonSx}><AspectRatioIcon fontSize="small" /></ToggleButton></Tooltip>
        </Stack>
        <Divider flexItem sx={{ borderColor: editorColors.border }} />
        <Tooltip disableInteractive title={`${sensorHelpersVisible ? 'Hide' : 'Show'} sensor helpers`}>
          <IconButton size="small" onClick={onSensorHelpersToggle} sx={{ ...iconButtonSx, color: sensorHelpersVisible ? editorColors.accentText : editorColors.textMuted }} aria-label="Toggle sensor helpers">
            <SensorsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip disableInteractive title={`${collisionWireVisible ? 'Hide' : 'Show'} collision wires`}>
          <IconButton size="small" onClick={onCollisionWireToggle} sx={{ ...iconButtonSx, color: collisionWireVisible ? editorColors.warning : editorColors.textMuted }} aria-label="Toggle collision wires">
            <FontAwesomeIcon icon={faBorderAll} style={{ width: 16, height: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip disableInteractive title="Place on floor"><span><IconButton size="small" disabled={!canPlaceOnFloor} aria-label="Place on floor" onClick={onPlaceOnFloor} sx={iconButtonSx}><VerticalAlignBottomIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip disableInteractive title="Focus selected"><span><IconButton size="small" disabled={!selectedCount} aria-label="Focus selected" onClick={onFocusSelected} sx={iconButtonSx}><CenterFocusStrongIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip disableInteractive title="Undo"><span><IconButton size="small" disabled={!canUndo} aria-label="Undo" onClick={onUndo} sx={iconButtonSx}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip disableInteractive title="Redo"><span><IconButton size="small" disabled={!canRedo} aria-label="Redo" onClick={onRedo} sx={iconButtonSx}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip disableInteractive title="Delete"><span><IconButton size="small" disabled={!selectedCount} aria-label="Delete" onClick={onDelete} sx={{ ...iconButtonSx, color: editorColors.danger }}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
      </Stack>
    </Paper>
  );
}

export function EditorViewportSnapControls({ movement, rotation, lastMovement, onChange }: {
  movement: StageBuilderSnapPreset;
  rotation: StageBuilderRotationSnapPreset;
  lastMovement: 'precise' | 'fine' | 'medium' | 'coarse';
  onChange: (patch: { snapPreset?: StageBuilderSnapPreset; rotationSnapPreset?: StageBuilderRotationSnapPreset }) => void;
}) {
  const { colors } = useEditorTheme();
  return <Paper elevation={0} sx={{ display: 'flex', gap: 0.75, alignItems: 'center', p: 0.75, bgcolor: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 1, '& .MuiInputBase-root': { color: colors.text }, '& .MuiInputLabel-root, & .MuiSelect-icon': { color: colors.textMuted }, '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border } }}>
    <Tooltip disableInteractive title="Toggle movement snapping"><IconButton size="small" aria-label="Toggle movement snapping" aria-pressed={movement !== 'off'} onClick={() => onChange({ snapPreset: movement === 'off' ? lastMovement : 'off' })} sx={{ color: movement === 'off' ? colors.textMuted : colors.accentText }}><FontAwesomeIcon icon={faMagnet} /></IconButton></Tooltip>
    <TextField select size="small" label="Movement" value={movement} inputProps={{ 'aria-label': 'Movement snapping' }} onChange={event => onChange({ snapPreset: event.target.value as StageBuilderSnapPreset })} sx={{ minWidth: 100 }}>
      {(['off', 'precise', 'fine', 'medium', 'coarse'] as const).map(value => <MenuItem key={value} value={value}>{snapPresetLabel(value)}</MenuItem>)}
    </TextField>
    <TextField select size="small" label="Rotation" value={rotation} inputProps={{ 'aria-label': 'Rotation snapping' }} onChange={event => onChange({ rotationSnapPreset: event.target.value as StageBuilderRotationSnapPreset })} sx={{ minWidth: 90 }}>
      {(['off', '15', '30', '45'] as const).map(value => <MenuItem key={value} value={value}>{rotationSnapPresetLabel(value)}</MenuItem>)}
    </TextField>
  </Paper>;
}
