import React, { useState } from 'react';
import {
  Box, Button, Chip, Divider, IconButton, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
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

function MenuButton({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const menu = useMenu();
  return (
    <>
      <Button color="inherit" size="small" onClick={menu.openMenu} sx={{ textTransform: 'none' }}>{label}</Button>
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
  onToggleLeftPanel,
  onToggleRightPanel,
}: EditorTopBarProps) {
  const overflow = useMenu();
  const active = activeValidationResults(validationResults);
  const hasErrors = active.some((item) => item.severity === 'error');
  const hasWarnings = active.some((item) => item.severity === 'warning');

  return (
    <Toolbar variant="dense" sx={{ minHeight: 48, height: 48, px: 1, gap: 1, bgcolor: '#0f172a', color: '#e2e8f0', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
      <Tooltip title="Back to Platform">
        <IconButton size="small" onClick={onBack} sx={{ color: 'inherit' }}><ArrowBackIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Box sx={{ minWidth: 0, mr: 1 }}>
        <Typography variant="subtitle2" fontWeight={800} lineHeight={1}>Stage Builder</Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }} noWrap>{stageName || 'Untitled Stage'}</Typography>
      </Box>
      <Divider flexItem orientation="vertical" sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

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

      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
        <Chip size="small" label={dirty ? 'Unsaved changes' : exportedAt ? 'Exported' : 'No changes'} color={dirty ? 'warning' : 'success'} variant={dirty ? 'filled' : 'outlined'} />
        <Chip size="small" clickable onClick={onOpenValidation} label={validationSummary(validationResults)} color={hasErrors ? 'error' : hasWarnings ? 'warning' : 'success'} />
      </Stack>
      <Tooltip title="Toggle left panel"><IconButton size="small" onClick={onToggleLeftPanel} sx={{ color: 'inherit' }}><ViewSidebarIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Editor settings"><IconButton size="small" onClick={onOpenSettings} sx={{ color: 'inherit' }}><SettingsIcon fontSize="small" /></IconButton></Tooltip>
      <Button size="small" color="inherit" variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExport} sx={{ borderColor: 'rgba(226,232,240,0.35)', textTransform: 'none' }}>Export JSON</Button>
      <Button size="small" variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={onRunTest} sx={{ textTransform: 'none' }}>Run Test</Button>
      <IconButton size="small" onClick={overflow.openMenu} sx={{ color: 'inherit' }}><MoreVertIcon fontSize="small" /></IconButton>
      <Menu anchorEl={overflow.anchorEl} open={overflow.open} onClose={overflow.closeMenu}>
        <MenuItem disabled><HelpOutlineIcon fontSize="small" style={{ marginRight: 8 }} />Theme, language, and profile controls remain in the platform.</MenuItem>
      </Menu>
    </Toolbar>
  );
}
