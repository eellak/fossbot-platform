import React, { useState } from 'react';
import {
  Box, Button, ButtonBase, Chip, Divider, IconButton, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import type { StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { STAGE_BUILDER_LIBRARY_GROUPS, libraryLabel } from './StageObjectLibrary';
import { activeValidationResults, validationSummary, type StageBuilderValidationResult } from './stageBuilderValidation';
import { editorColors } from './stageBuilderEditorTheme';

export interface EditorTopBarProps {
  stageName: string;
  dirty: boolean;
  exportedAt?: string | null;
  validationResults: StageBuilderValidationResult[];
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  prefabs: StageBuilderPrefab[];
  onBack: () => void;
  onNew: () => void;
  onDemo: () => void;
  onImport: () => void;
  onExport: () => void;
  onRunTest: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddKind: (kind: StageSemanticKind) => void;
  onAddPrefab: (prefab: StageBuilderPrefab) => void;
  onOpenValidation: () => void;
  onOpenSettings: () => void;
  onOpenStageSettings: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}

function useMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return {
    anchorEl,
    open: Boolean(anchorEl),
    openMenu: (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    closeMenu: () => setAnchorEl(null),
  };
}

const menuButtonSx = {
  height: 30,
  minWidth: 52,
  px: 1,
  borderRadius: 0.75,
  color: editorColors.text,
  textTransform: 'none',
  '&:hover': { bgcolor: editorColors.panelRaised, color: editorColors.textStrong },
} as const;

const topbarIconButtonSx = {
  width: 32,
  height: 32,
  borderRadius: 0.75,
  color: editorColors.textMuted,
  '&:hover': { bgcolor: editorColors.panelRaised, color: editorColors.textStrong },
} as const;

const exportButtonSx = {
  height: 34,
  borderColor: 'rgba(216, 225, 232, 0.28)',
  color: editorColors.accentText,
  bgcolor: editorColors.viewport,
  textTransform: 'none',
  '&:hover': { borderColor: editorColors.borderStrong, bgcolor: editorColors.accentSoft },
} as const;

const runButtonSx = {
  height: 34,
  px: 1.75,
  bgcolor: editorColors.success,
  color: '#082114',
  fontWeight: 800,
  textTransform: 'none',
  '&:hover': { bgcolor: '#72e7a0' },
} as const;

function MenuButton({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const menu = useMenu();
  return (
    <>
      <Button color="inherit" size="small" onClick={menu.openMenu} sx={menuButtonSx}>{label}</Button>
      <Menu anchorEl={menu.anchorEl} open={menu.open} onClose={menu.closeMenu}>{children(menu.closeMenu)}</Menu>
    </>
  );
}

export function EditorTopBar({
  stageName,
  dirty,
  exportedAt,
  validationResults,
  selectedCount,
  canUndo,
  canRedo,
  leftPanelVisible,
  rightPanelVisible,
  prefabs,
  onBack,
  onNew,
  onDemo,
  onImport,
  onExport,
  onRunTest,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onAddKind,
  onAddPrefab,
  onOpenValidation,
  onOpenSettings,
  onOpenStageSettings,
  onToggleLeftPanel,
  onToggleRightPanel,
}: EditorTopBarProps) {
  const overflow = useMenu();
  const active = activeValidationResults(validationResults);
  const hasErrors = active.some((item) => item.severity === 'error');
  const hasWarnings = active.some((item) => item.severity === 'warning');

  return (
    <Toolbar variant="dense" sx={{ minHeight: 48, height: 48, px: 1, gap: 1, bgcolor: editorColors.topbar, color: '#e2e8f0', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
      <Tooltip title="Back to Platform">
        <IconButton size="small" onClick={onBack} sx={{ color: 'inherit' }}><ArrowBackIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Tooltip title="Open stage settings">
        <ButtonBase
          onClick={onOpenStageSettings}
          sx={{
            minWidth: 0,
            mr: 0.5,
            px: 0.5,
            py: 0.25,
            borderRadius: 0.75,
            color: 'inherit',
            textAlign: 'left',
            display: 'block',
            '&:hover': { bgcolor: 'rgba(156, 175, 184, 0.08)' },
            '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 2 },
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1}>Stage Builder</Typography>
          <Typography variant="caption" sx={{ color: editorColors.textSubtle }} noWrap>{stageName || 'Untitled Stage'}</Typography>
        </ButtonBase>
      </Tooltip>
      <Divider flexItem orientation="vertical" sx={{ borderColor: editorColors.border }} />

      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ px: 0.25, py: 0.25, borderRadius: 1, bgcolor: editorColors.panelInset, border: `1px solid ${editorColors.border}` }}>
        <MenuButton label="File">
        {(close) => [
          <MenuItem key="new" onClick={() => { close(); onNew(); }}>New stage</MenuItem>,
          <MenuItem key="demo" onClick={() => { close(); onDemo(); }}>Load demo</MenuItem>,
          <MenuItem key="import" onClick={() => { close(); onImport(); }}>Import JSON…</MenuItem>,
          <MenuItem key="export" onClick={() => { close(); onExport(); }}>Export JSON</MenuItem>,
        ]}
      </MenuButton>
      <MenuButton label="Edit">
        {(close) => [
          <MenuItem key="undo" disabled={!canUndo} onClick={() => { close(); onUndo(); }}>Undo</MenuItem>,
          <MenuItem key="redo" disabled={!canRedo} onClick={() => { close(); onRedo(); }}>Redo</MenuItem>,
          <MenuItem key="duplicate" disabled={!selectedCount} onClick={() => { close(); onDuplicate(); }}>Duplicate selection</MenuItem>,
          <MenuItem key="delete" disabled={!selectedCount} onClick={() => { close(); onDelete(); }}>Delete selection</MenuItem>,
        ]}
      </MenuButton>
      <MenuButton label="Add">
        {(close) => [
          ...STAGE_BUILDER_LIBRARY_GROUPS.flatMap((group) => [
            <MenuItem key={`${group.id}-header`} disabled>{group.label}</MenuItem>,
            ...group.items.map((kind) => <MenuItem key={kind} onClick={() => { close(); onAddKind(kind); }}>{libraryLabel(kind)}</MenuItem>),
          ]),
          <Divider key="prefab-divider" />,
          <MenuItem key="prefab-header" disabled>Prefabs</MenuItem>,
          ...prefabs.map((prefab) => <MenuItem key={prefab.id} onClick={() => { close(); onAddPrefab(prefab); }}>{prefab.title}</MenuItem>),
        ]}
      </MenuButton>
      <MenuButton label="View">
        {(close) => [
          <MenuItem key="left" onClick={() => { close(); onToggleLeftPanel(); }}>{leftPanelVisible ? 'Hide' : 'Show'} left panel</MenuItem>,
          <MenuItem key="right" onClick={() => { close(); onToggleRightPanel(); }}>{rightPanelVisible ? 'Hide' : 'Show'} inspector</MenuItem>,
          <MenuItem key="validation" onClick={() => { close(); onOpenValidation(); }}>Open Validation</MenuItem>,
          <MenuItem key="settings" onClick={() => { close(); onOpenSettings(); }}>Editor settings</MenuItem>,
        ]}
      </MenuButton>
        <MenuButton label="Help">
          {(close) => [
            <MenuItem key="shortcuts" disabled>Shortcuts: W move, E rotate, R scale, F focus, Delete remove</MenuItem>,
            <MenuItem key="workflow" onClick={close}>Workflow: add objects, inspect, validate, export JSON, run test.</MenuItem>,
          ]}
        </MenuButton>
      </Stack>

      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0 }}>
        <Chip
          size="small"
          label={dirty ? 'Unsaved changes' : exportedAt ? 'Exported' : 'No changes'}
          variant="outlined"
          sx={{
            color: dirty ? editorColors.warning : editorColors.success,
            borderColor: dirty ? 'rgba(243, 184, 77, 0.4)' : 'rgba(91, 220, 139, 0.4)',
            bgcolor: dirty ? 'rgba(243, 184, 77, 0.08)' : 'rgba(91, 220, 139, 0.08)',
            fontWeight: 700,
          }}
        />
        <Chip
          size="small"
          clickable
          onClick={onOpenValidation}
          label={validationSummary(validationResults)}
          variant="outlined"
          sx={{
            color: hasErrors ? editorColors.danger : hasWarnings ? editorColors.warning : editorColors.success,
            borderColor: hasErrors ? 'rgba(242, 139, 116, 0.4)' : hasWarnings ? 'rgba(243, 184, 77, 0.4)' : 'rgba(91, 220, 139, 0.4)',
            bgcolor: hasErrors ? 'rgba(242, 139, 116, 0.08)' : hasWarnings ? 'rgba(243, 184, 77, 0.08)' : 'rgba(91, 220, 139, 0.08)',
            fontWeight: 700,
            '&:hover': { bgcolor: hasErrors ? 'rgba(242, 139, 116, 0.12)' : hasWarnings ? 'rgba(243, 184, 77, 0.12)' : 'rgba(91, 220, 139, 0.12)' },
          }}
        />
      </Stack>
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ px: 0.25 }}>
        <Tooltip title="Toggle left panel"><IconButton size="small" onClick={onToggleLeftPanel} sx={topbarIconButtonSx}><ViewSidebarIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Editor settings"><IconButton size="small" onClick={onOpenSettings} sx={topbarIconButtonSx}><SettingsIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: 0.75, ml: 0.25, borderLeft: `1px solid ${editorColors.border}` }}>
        <Button size="small" color="inherit" variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExport} sx={exportButtonSx}>Export JSON</Button>
        <Button size="small" variant="contained" disableElevation startIcon={<PlayArrowIcon />} onClick={onRunTest} sx={runButtonSx}>Run Test</Button>
        <IconButton size="small" onClick={overflow.openMenu} sx={topbarIconButtonSx}><MoreVertIcon fontSize="small" /></IconButton>
      </Stack>
      <Menu anchorEl={overflow.anchorEl} open={overflow.open} onClose={overflow.closeMenu}>
        <MenuItem disabled><HelpOutlineIcon fontSize="small" style={{ marginRight: 8 }} />Theme, language, and profile controls remain in the platform.</MenuItem>
      </Menu>
    </Toolbar>
  );
}
