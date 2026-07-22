import React, { useState } from 'react';
import {
  Box, Button, ButtonBase, Divider, IconButton, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GitHubIcon from '@mui/icons-material/GitHub';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { activeValidationResults, validationSummary, type StageBuilderValidationResult } from './stageBuilderValidation';
import { useEditorTheme } from './stageBuilderEditorTheme';

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
  onBack: () => void;
  onNew: () => void;
  onDemo: () => void;
  providerLabel?: string;
  providerConnected?: boolean;
  providerBusy?: boolean;
  marketplaceBusy?: boolean;
  marketplaceStatusLoading?: boolean;
  marketplacePullRequest?: { number?: number | null; url?: string | null; state?: string | null } | null;
  onImport: () => void;
  onExport: () => void;
  onRefreshGitHubStatus?: () => void;
  onConnectProvider: () => void;
  onSaveProvider: () => void;
  onOpenProvider: () => void;
  onPublishMarketplace: () => void;
  onRunTest: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenValidation: () => void;
  onOpenSettings: () => void;
  onOpenStageSettings: () => void;
  onOpenPreviewSettings: () => void;
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

function marketplacePrStateLabel(state?: string | null): string {
  if (state === 'merged') return 'Merged';
  if (state === 'closed') return 'Closed';
  if (state === 'open') return 'Open';
  return state ? state.charAt(0).toUpperCase() + state.slice(1) : 'Unknown';
}

function TopStatusText({ label, tone, onClick }: { label: string; tone: string; onClick?: () => void; }) {
  const { colors: editorColors } = useEditorTheme();
  if (onClick) {
    return (
      <ButtonBase
        onClick={onClick}
        sx={{
          minWidth: 0,
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          color: tone,
          fontSize: '0.75rem',
          fontWeight: 750,
          lineHeight: 1.2,
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationColor: editorColors.keycapBorderStrong,
          textUnderlineOffset: '3px',
          '&:hover': { bgcolor: editorColors.keycapBg, textDecorationColor: 'currentColor' },
          '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 2 },
        }}
      >
        {label}
      </ButtonBase>
    );
  }

  return (
    <Typography variant="caption" noWrap sx={{ px: 0.5, color: tone, fontWeight: 750, lineHeight: 1.2 }}>
      {label}
    </Typography>
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
  onBack,
  onNew,
  onDemo,
  providerLabel,
  providerConnected,
  providerBusy,
  marketplaceBusy,
  marketplaceStatusLoading,
  marketplacePullRequest,
  onImport,
  onExport,
  onRefreshGitHubStatus,
  onConnectProvider,
  onSaveProvider,
  onOpenProvider,
  onPublishMarketplace,
  onRunTest,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onOpenValidation,
  onOpenSettings,
  onOpenStageSettings,
  onOpenPreviewSettings,
  onToggleLeftPanel,
  onToggleRightPanel,
}: EditorTopBarProps) {
  const { colors: editorColors } = useEditorTheme();
  const overflow = useMenu();
  const github = useMenu();

  const topbarIconButtonSx = {
    width: 32,
    height: 32,
    borderRadius: 0.75,
    color: editorColors.textMuted,
    '&:hover': { bgcolor: editorColors.panelRaised, color: editorColors.textStrong },
  } as const;

  const exportButtonSx = {
    height: 34,
    borderColor: editorColors.keycapBorder,
    color: editorColors.text,
    bgcolor: 'transparent',
    textTransform: 'none',
    '&:hover': { borderColor: editorColors.keycapBorderStrong, bgcolor: editorColors.keycapBg, color: editorColors.textStrong },
  } as const;

  const runButtonSx = {
    height: 34,
    px: 1.75,
    bgcolor: editorColors.success,
    color: editorColors.successInk,
    fontWeight: 800,
    textTransform: 'none',
    '&:hover': { bgcolor: editorColors.success },
  } as const;

  const active = activeValidationResults(validationResults);
  const hasErrors = active.some((item) => item.severity === 'error');
  const hasWarnings = active.some((item) => item.severity === 'warning');

  return (
    <Toolbar variant="dense" sx={{ minHeight: 48, height: 48, px: 1, gap: 1, bgcolor: editorColors.topbar, color: editorColors.keycapInk, borderBottom: `1px solid ${editorColors.divider}` }}>
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
            '&:hover': { bgcolor: editorColors.keycapBg },
            '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 2 },
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1}>Stage Builder</Typography>
          <Typography variant="caption" sx={{ color: editorColors.textSubtle }} noWrap>{stageName || 'Untitled Stage'}</Typography>
        </ButtonBase>
      </Tooltip>

      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0, color: editorColors.textMuted }}>
        <TopStatusText label={dirty ? 'Unsaved changes' : exportedAt ? 'Exported' : 'No changes'} tone={dirty ? editorColors.warning : editorColors.success} />
        <TopStatusText label={validationSummary(validationResults)} tone={hasErrors ? editorColors.danger : hasWarnings ? editorColors.warning : editorColors.success} onClick={onOpenValidation} />
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: 0.75, ml: 0.25 }}>
        <Button size="small" color="inherit" variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExport} sx={exportButtonSx}>Export JSON</Button>
        <Tooltip title={providerLabel || 'GitHub actions'}>
          <span>
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<GitHubIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(event) => { onRefreshGitHubStatus?.(); github.openMenu(event); }}
              sx={exportButtonSx}
            >
              {providerBusy || marketplaceBusy || marketplaceStatusLoading ? 'GitHub…' : 'GitHub'}
            </Button>
          </span>
        </Tooltip>
        <Button size="small" variant="contained" disableElevation startIcon={<PlayArrowIcon />} onClick={onRunTest} sx={runButtonSx}>Run Test</Button>
        <IconButton size="small" onClick={overflow.openMenu} sx={topbarIconButtonSx}><MoreVertIcon fontSize="small" /></IconButton>
      </Stack>
      <Menu anchorEl={github.anchorEl} open={github.open} onClose={github.closeMenu}>
        <Box sx={{ px: 2, py: 1.25, maxWidth: 360 }}>
          <Typography variant="subtitle2" fontWeight={850}>GitHub</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-word' }}>
            {providerLabel || 'Connect GitHub to save and publish stages.'}
          </Typography>
        </Box>
        <Divider />
        {!providerConnected && <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onConnectProvider(); }}>{providerBusy ? 'Connecting…' : 'Connect GitHub…'}</MenuItem>}
        <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onSaveProvider(); }}>{providerBusy ? 'Saving…' : 'Save to GitHub…'}</MenuItem>
        <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onOpenProvider(); }}>Open from GitHub…</MenuItem>
        <MenuItem disabled={marketplaceBusy} onClick={() => { github.closeMenu(); onPublishMarketplace(); }}>{marketplaceBusy ? 'Publishing…' : 'Publish to Marketplace…'}</MenuItem>
        <Divider />
        {marketplaceStatusLoading ? (
          <MenuItem disabled>Checking marketplace PR…</MenuItem>
        ) : marketplacePullRequest?.url ? (
          <MenuItem component="a" href={marketplacePullRequest.url} target="_blank" rel="noreferrer" onClick={github.closeMenu}>
            Marketplace PR #{marketplacePullRequest.number || '—'} · {marketplacePrStateLabel(marketplacePullRequest.state)}
          </MenuItem>
        ) : (
          <MenuItem disabled>No marketplace PR for this stage</MenuItem>
        )}
      </Menu>
      <Menu anchorEl={overflow.anchorEl} open={overflow.open} onClose={overflow.closeMenu}>
        <MenuItem onClick={() => { overflow.closeMenu(); onNew(); }}>New stage</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onDemo(); }}>Load demo</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onImport(); }}>Import JSON…</MenuItem>
        <Divider />
        <MenuItem disabled={!canUndo} onClick={() => { overflow.closeMenu(); onUndo(); }}>Undo</MenuItem>
        <MenuItem disabled={!canRedo} onClick={() => { overflow.closeMenu(); onRedo(); }}>Redo</MenuItem>
        <MenuItem disabled={!selectedCount} onClick={() => { overflow.closeMenu(); onDuplicate(); }}>Duplicate selection</MenuItem>
        <MenuItem disabled={!selectedCount} onClick={() => { overflow.closeMenu(); onDelete(); }}>Delete selection</MenuItem>
        <Divider />
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenValidation(); }}>Open validation</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onToggleLeftPanel(); }}>{leftPanelVisible ? 'Hide' : 'Show'} library panel</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onToggleRightPanel(); }}>{rightPanelVisible ? 'Hide' : 'Show'} inspector</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenPreviewSettings(); }}>Preview settings</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenSettings(); }}>Editor settings</MenuItem>
      </Menu>
    </Toolbar>
  );
}
