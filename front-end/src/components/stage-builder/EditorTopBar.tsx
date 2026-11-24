import React, { useState } from 'react';
import {
  Box, Button, CircularProgress, Divider, IconButton, ListSubheader, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import {
  IconAdjustmentsHorizontal, IconAlertCircle, IconAlertTriangle, IconArrowLeft, IconBrandGithub,
  IconChevronDown, IconCircleCheck, IconCloudUpload, IconDeviceFloppy, IconDotsVertical, IconInfoCircle,
  IconPlayerPlayFilled, IconWorldCog,
} from '@tabler/icons-react';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { activeValidationResults, validationSummary, type StageBuilderValidationResult } from './stageBuilderValidation';
import { MARKETPLACE_COPY } from 'src/stages/marketplaceCopy';

const validationStates = {
  error: { icon: IconAlertCircle, label: 'Review errors' },
  warning: { icon: IconAlertTriangle, label: 'Review warnings' },
  info: { icon: IconInfoCircle, label: 'Review notices' },
  success: { icon: IconCircleCheck, label: 'View validation' },
};

export interface EditorTopBarProps {
  stageName: string;
  dirty: boolean;
  saveStatus?: string | null;
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
  localStageBusy?: boolean;
  marketplaceEnabled?: boolean;
  marketplaceBusy?: boolean;
  marketplaceStatusLoading?: boolean;
  marketplacePullRequest?: { number?: number | null; url?: string | null; state?: string | null } | null;
  marketplacePublishLabel?: string;
  marketplacePublishReady?: boolean;
  onImport: () => void;
  onReviewRecovery?: () => void;
  onSaveLocal: () => void;
  onOpenLocal: () => void;
  allowCloud?: boolean;
  githubEnabled: boolean;
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
  onPlaceOnFloor?: () => void;
  canPlaceOnFloor?: boolean;
  onDelete: () => void;
  onDeleteStage?: () => void;
  deleteStageBusy?: boolean;
  onOpenValidation: () => void;
  onOpenSettings: () => void;
  onOpenStageSettings: () => void;
  onOpenTestSettings: () => void;
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

export function EditorTopBar({
  stageName,
  dirty,
  saveStatus,
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
  localStageBusy,
  marketplaceEnabled = false,
  marketplaceBusy,
  marketplaceStatusLoading,
  marketplacePullRequest,
  marketplacePublishLabel = MARKETPLACE_COPY.publishStage,
  marketplacePublishReady = false,
  onImport,
  onReviewRecovery,
  onSaveLocal,
  onOpenLocal,
  allowCloud = true,
  githubEnabled,
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
  onPlaceOnFloor,
  canPlaceOnFloor = false,
  onDelete,
  onDeleteStage,
  deleteStageBusy,
  onOpenValidation,
  onOpenSettings,
  onOpenStageSettings, onOpenTestSettings,
  onOpenPreviewSettings,
  onToggleLeftPanel,
  onToggleRightPanel,
}: EditorTopBarProps) {
  const overflow = useMenu();
  const github = useMenu();

  const active = activeValidationResults(validationResults);
  const severity = active.find(item => item.severity === 'error')?.severity
    ?? active.find(item => item.severity === 'warning')?.severity
    ?? active[0]?.severity ?? 'success';
  const { icon: ValidationIcon, label: validationAction } = validationStates[severity];
  const summary = validationSummary(validationResults);
  const validationLabel = `${validationAction} (${summary})`;
  const saveDestination = allowCloud ? 'to account' : 'in this browser';
  const saveLabel = localStageBusy ? `Saving ${saveDestination}…` : `Save ${saveDestination}`;
  const wideLabel = { display: { xs: 'none', lg: 'inline' } };
  const mediumLabel = { display: { xs: 'none', md: 'inline' } };

  return (
    <Toolbar component="header" aria-label="Stage Builder" variant="dense" disableGutters sx={{
      flex: '0 0 auto', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'stretch',
      minHeight: 48, px: 1, gap: { xs: 0, sm: 1 },
      bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider',
      '& .MuiIconButton-root, & .MuiButton-root': { minWidth: 44, minHeight: 44, flexShrink: 0 },
      '& .MuiButton-root': { px: { xs: 0.75, md: 1.25 }, gap: 0.75, whiteSpace: 'nowrap' },
    }}>
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Tooltip title={localStageBusy ? 'Saving stage…' : 'Back to stages'}>
          <span>
            <IconButton aria-label="Back to stages" onClick={onBack} disabled={localStageBusy}>
              <IconArrowLeft aria-hidden="true" size={20} />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ minWidth: 0, mr: 0.5 }}>
          <Typography component="h1" variant="subtitle2" fontWeight={600} noWrap title={stageName || 'Untitled Stage'}>
            {stageName || 'Untitled Stage'}
          </Typography>
          <Typography component="div" variant="caption" noWrap color="text.secondary">
            Stage Builder · <Box component="span" role="status" sx={{ color: dirty ? 'warning.main' : 'inherit' }}>
              {dirty ? 'Unsaved changes' : saveStatus || 'No changes'}
            </Box>
          </Typography>
        </Box>
        <Tooltip title="Stage settings">
          <Button color="inherit" aria-label="Stage settings" onClick={onOpenStageSettings}>
            <IconWorldCog aria-hidden="true" size={20} /><Box component="span" sx={wideLabel}>Stage settings</Box>
          </Button>
        </Tooltip>
      </Stack>

      <Stack direction="row" alignItems="center" gap={0.5}>
        <Stack direction="row" alignItems="center" gap={0.5} role="group" aria-label="Save and share">
          <Tooltip title={saveLabel}>
            <span>
              <Button variant="outlined" sx={{ color: 'text.primary' }} aria-label={saveLabel} onClick={onSaveLocal} disabled={localStageBusy}>
                {localStageBusy ? <CircularProgress size={18} color="inherit" /> : <IconDeviceFloppy aria-hidden="true" size={20} />}
                <Box component="span" sx={mediumLabel}>{saveLabel}</Box>
              </Button>
            </span>
          </Tooltip>
          {githubEnabled && (
            <Tooltip title={providerLabel || 'GitHub stage actions'}>
              <Button
                color="inherit" aria-label="GitHub stage actions" aria-haspopup="menu" aria-expanded={github.open}
                aria-controls={github.open ? 'stage-github-menu' : undefined}
                onClick={(event) => { onRefreshGitHubStatus?.(); github.openMenu(event); }}
              >
                <IconBrandGithub aria-hidden="true" size={20} />
                <Box component="span" sx={mediumLabel}>{providerBusy || marketplaceBusy || marketplaceStatusLoading ? 'GitHub…' : 'GitHub'}</Box>
                <Box component="span" sx={{ display: { xs: 'none', md: 'flex' } }}><IconChevronDown aria-hidden="true" size={14} /></Box>
              </Button>
            </Tooltip>
          )}
          {marketplaceEnabled && (
            <Button
              color={marketplacePublishReady ? 'primary' : 'inherit'} variant="outlined"
              onClick={onPublishMarketplace} disabled={marketplaceBusy} sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              {marketplaceBusy ? <CircularProgress size={18} color="inherit" /> : <IconCloudUpload aria-hidden="true" size={20} />}
              {marketplaceBusy ? 'Submitting…' : marketplacePublishLabel}
            </Button>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5} role="group" aria-label="Test stage"
          sx={{ ml: { xs: 'auto', sm: 0.5 }, pl: { sm: 1 }, borderLeft: { sm: 1 }, borderColor: { sm: 'divider' } }}>
          <Tooltip title={validationLabel}>
            <Button aria-label={validationLabel} color="inherit" sx={{ color: `${severity}.main` }} onClick={onOpenValidation}>
              <ValidationIcon aria-hidden="true" size={20} />
              <Box component="span" sx={wideLabel}>{active.length ? summary : 'Validation'}</Box>
            </Button>
          </Tooltip>
          <Tooltip title="Test settings">
            <IconButton aria-label="Test settings" onClick={onOpenTestSettings}>
              <IconAdjustmentsHorizontal aria-hidden="true" size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Run test">
            <Button variant="contained" disableElevation onClick={onRunTest} aria-label="Run test">
              <IconPlayerPlayFilled aria-hidden="true" size={18} />
              <Box component="span" sx={{ display: githubEnabled ? 'none' : 'inline', '@media (min-width: 360px)': { display: 'inline' } }}>Run test</Box>
            </Button>
          </Tooltip>
        </Stack>
        <Tooltip title="More editor actions">
          <IconButton aria-label="More editor actions" aria-haspopup="menu" aria-expanded={overflow.open}
            aria-controls={overflow.open ? 'stage-actions-menu' : undefined} onClick={overflow.openMenu}>
            <IconDotsVertical aria-hidden="true" size={20} />
          </IconButton>
        </Tooltip>
      </Stack>
      {githubEnabled && <Menu anchorEl={github.anchorEl} open={github.open} onClose={github.closeMenu}
        MenuListProps={{
          id: 'stage-github-menu', 'aria-label': 'GitHub stage actions',
          subheader: (
            <ListSubheader disableSticky sx={{ py: 1.25, maxWidth: 360, lineHeight: 'normal', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>GitHub</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                {providerConnected ? providerLabel : 'Connect GitHub to save stages'}
              </Typography>
            </ListSubheader>
          ),
        }}>
        {!providerConnected && <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onConnectProvider(); }}>{providerBusy ? 'Connecting…' : MARKETPLACE_COPY.connectGitHub}</MenuItem>}
        <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onSaveProvider(); }}>{providerBusy ? 'Saving…' : MARKETPLACE_COPY.saveToGitHub}</MenuItem>
        <MenuItem disabled={providerBusy} onClick={() => { github.closeMenu(); onOpenProvider(); }}>{MARKETPLACE_COPY.openFromGitHub}</MenuItem>
        {marketplaceEnabled && marketplacePullRequest?.url && <Divider />}
        {marketplaceEnabled && marketplacePullRequest?.url && (
          <MenuItem component="a" href={marketplacePullRequest.url} target="_blank" rel="noreferrer" onClick={github.closeMenu}>
            Marketplace PR #{marketplacePullRequest.number || '—'} · {marketplacePrStateLabel(marketplacePullRequest.state)}
          </MenuItem>
        )}
      </Menu>}
      <Menu anchorEl={overflow.anchorEl} open={overflow.open} onClose={overflow.closeMenu}
        MenuListProps={{ id: 'stage-actions-menu', 'aria-label': 'More editor actions' }}>
        <MenuItem disabled={localStageBusy} onClick={() => { overflow.closeMenu(); onSaveLocal(); }}><IconDeviceFloppy aria-hidden="true" size={20} style={{ marginInlineEnd: 8 }} />{localStageBusy ? 'Saving…' : allowCloud ? 'Save to my account' : 'Save in this browser'}</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenLocal(); }}><FolderOpenIcon fontSize="small" sx={{ mr: 1 }} />{allowCloud ? 'Open my stage…' : 'Open browser-saved stage…'}</MenuItem>
        {marketplaceEnabled && <MenuItem disabled={marketplaceBusy} onClick={() => { overflow.closeMenu(); onPublishMarketplace(); }}>{marketplaceBusy ? <CircularProgress size={16} sx={{ mr: 1 }} /> : <IconCloudUpload aria-hidden="true" size={20} style={{ marginInlineEnd: 8 }} />}{marketplaceBusy ? 'Submitting…' : marketplacePublishLabel}</MenuItem>}
        <Divider />
        <MenuItem onClick={() => { overflow.closeMenu(); onExport(); }}><FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />Download JSON</MenuItem>
        <Divider />
        <MenuItem onClick={() => { overflow.closeMenu(); onNew(); }}>New stage</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onDemo(); }}>Load demo</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onImport(); }}>Import JSON…</MenuItem>
        {onReviewRecovery && <MenuItem onClick={() => { overflow.closeMenu(); onReviewRecovery(); }}>Recent drafts</MenuItem>}
        <Divider />
        <MenuItem disabled={!canUndo} onClick={() => { overflow.closeMenu(); onUndo(); }}>Undo</MenuItem>
        <MenuItem disabled={!canRedo} onClick={() => { overflow.closeMenu(); onRedo(); }}>Redo</MenuItem>
        <MenuItem disabled={!selectedCount} onClick={() => { overflow.closeMenu(); onDuplicate(); }}>Duplicate selection</MenuItem>
        <MenuItem disabled={!canPlaceOnFloor} onClick={() => { overflow.closeMenu(); onPlaceOnFloor?.(); }}>Place on floor</MenuItem>
        <MenuItem disabled={!selectedCount} onClick={() => { overflow.closeMenu(); onDelete(); }}>Delete selection</MenuItem>
        <Divider />
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenValidation(); }}>Open validation</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onToggleLeftPanel(); }}>{leftPanelVisible ? 'Hide' : 'Show'} library panel</MenuItem>
        <MenuItem onClick={() => { overflow.closeMenu(); onToggleRightPanel(); }}>{rightPanelVisible ? 'Hide' : 'Show'} inspector</MenuItem>
        {process.env.NODE_ENV === 'development' && <MenuItem onClick={() => { overflow.closeMenu(); onOpenPreviewSettings(); }}>Preview settings</MenuItem>}
        <MenuItem onClick={() => { overflow.closeMenu(); onOpenSettings(); }}>Editor settings</MenuItem>
        {onDeleteStage && <Divider />}
        {onDeleteStage && <MenuItem sx={{ color: 'error.main' }} disabled={deleteStageBusy || localStageBusy || providerBusy || marketplaceBusy} onClick={() => { overflow.closeMenu(); onDeleteStage(); }}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />{deleteStageBusy ? 'Deleting stage…' : 'Delete stage'}</MenuItem>}
      </Menu>
    </Toolbar>
  );
}
