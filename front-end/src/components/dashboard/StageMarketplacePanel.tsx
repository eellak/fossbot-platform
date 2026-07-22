import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import { completeMarketplaceFork, getMarketplaceForkStatus, getMarketplaceIndex, getMarketplacePermissions, reportMarketplaceStage, MarketplaceRequestError, type MarketplaceIndexResponse, type MarketplacePermissions, type MarketplaceReportCategory, type MarketplaceStageEntry, type MarketplaceValidationState } from 'src/stages/MarketplaceApi';
import { invalidateMarketplaceFirstPage, invalidateUserStages, marketplaceFirstPageSnapshot, refreshMarketplaceFirstPage, refreshStageLists, stageListUserKey, subscribeMarketplaceFirstPage } from 'src/stages/stageListCache';
import { formatStageDate, formatStageRelativeTime, GitHubIdentity, StageCard, StageCardSkeleton, StagePreview } from 'src/stages/StageCard';
import { MARKETPLACE_COPY, MARKETPLACE_REPORT_CATEGORIES } from 'src/stages/marketplaceCopy';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';

const validationBadges: Record<MarketplaceValidationState, { label: string; color: 'success' | 'warning' | 'error'; description: string }> = {
  validated: {
    label: 'Validated',
    color: 'success',
    description: 'The indexed commit passed marketplace CI validation.',
  },
  unvalidated: {
    label: 'Unvalidated',
    color: 'warning',
    description: 'Validation has not run yet or the source repo changed after indexing.',
  },
  error: {
    label: 'Error',
    color: 'error',
    description: 'Marketplace CI could not confirm this stage.',
  },
};

function validationMeta(validation?: string | null) {
  return validationBadges[(validation || 'unvalidated') as MarketplaceValidationState] || validationBadges.unvalidated;
}

function ValidationChip({ entry }: { entry: MarketplaceStageEntry }) {
  const meta = validationMeta(entry.badges?.validation);
  const detail = entry.validation?.message ? `${meta.description} ${entry.validation.message}` : meta.description;
  return (
    <Tooltip title={detail} arrow>
      <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
    </Tooltip>
  );
}

const PAGE_SIZE = 24;
const FORK_FLOW_STORAGE_KEY = 'fossbot:marketplace-fork-flow';

type ForkFlowStep = 'create' | 'select' | 'finish' | 'ready';

type ForkFlow = {
  repoOwner: string;
  repoName: string;
  step: ForkFlowStep;
  installationUrl?: string;
};

function readForkFlow(): ForkFlow | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(FORK_FLOW_STORAGE_KEY) || 'null');
    if (!value?.repoOwner || !value?.repoName || !['create', 'select', 'finish', 'ready'].includes(value.step)) return null;
    return {
      repoOwner: value.repoOwner,
      repoName: value.repoName,
      step: value.step,
      installationUrl: typeof value.installationUrl === 'string' ? value.installationUrl : undefined,
    };
  } catch {
    return null;
  }
}

function writeForkFlow(flow: ForkFlow | null): void {
  if (typeof window === 'undefined') return;
  if (!flow) window.sessionStorage.removeItem(FORK_FLOW_STORAGE_KEY);
  else window.sessionStorage.setItem(FORK_FLOW_STORAGE_KEY, JSON.stringify(flow));
}

function MarketplaceStageCard({ entry, onSelect, embedded = false }: { entry: MarketplaceStageEntry; onSelect: (entry: MarketplaceStageEntry) => void; embedded?: boolean }) {
  return (
    <StageCard
      title={entry.title}
      description={entry.description || 'A community FOSSBot stage.'}
      previewUrl={entry.previewUrl}
      metadata={<GitHubIdentity username={entry.author?.githubUsername || entry.repoOwner} />}
      onOpen={() => onSelect(entry)}
      surface={embedded ? 'embedded' : 'outlined'}
      badges={(
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {entry.badges?.verified && <Chip size="small" color="primary" icon={<VerifiedIcon />} label="Verified" variant="outlined" />}
          <ValidationChip entry={entry} />
          {(entry.tags || []).slice(0, 2).map((tag) => <Chip key={tag} size="small" label={tag} />)}
        </Stack>
      )}
    />
  );
}

function MarketplacePanelFrame({ preview, action, children }: { preview: boolean; action: React.ReactNode; children: React.ReactNode }) {
  const subtitle = preview ? 'Discover community stages for FOSSBot simulations.' : 'Browse public stages for FOSSBot simulations.';
  if (preview) {
    return <DashboardCard title={MARKETPLACE_COPY.stageLibrary} subtitle={subtitle} action={action} compact>{children}</DashboardCard>;
  }
  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={850}>{MARKETPLACE_COPY.stageLibrary}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
        {action}
      </Stack>
      {children}
    </>
  );
}

function ForkProgress({ step }: { step: ForkFlowStep }) {
  const steps = [
    { label: 'Create the fork on GitHub', complete: step !== 'create' },
    { label: 'Select the fork for FOSSBot', complete: step === 'finish' || step === 'ready' },
    { label: 'Open your editable copy', complete: step === 'ready' },
  ];
  const activeIndex = step === 'create' ? 0 : step === 'select' ? 1 : 2;
  return (
    <Stack spacing={1} aria-label="Fork progress">
      {steps.map((item, index) => {
        const active = index === activeIndex;
        return (
          <Stack key={item.label} direction="row" spacing={1} alignItems="center">
            {item.complete ? <CheckCircleIcon color="success" fontSize="small" /> : <RadioButtonUncheckedIcon color={active ? 'primary' : 'disabled'} fontSize="small" />}
            <Typography variant="body2" fontWeight={active ? 700 : 400} color={active ? 'text.primary' : 'text.secondary'}>
              {item.label}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function MarketplaceDetailDrawer({
  entry,
  open,
  onClose,
  onOpenFork,
  onCompleteFork,
  onCancelFork,
  forkStep,
  forkBusy,
  forkError,
  forkInstallationUrl,
  reporting,
  onReport,
}: {
  entry: MarketplaceStageEntry | null;
  open: boolean;
  onClose: () => void;
  onOpenFork: (entry: MarketplaceStageEntry) => void;
  onCompleteFork: (entry: MarketplaceStageEntry) => void;
  onCancelFork: () => void;
  forkStep: ForkFlowStep | null;
  forkBusy: boolean;
  forkError: string;
  forkInstallationUrl?: string | null;
  reporting: MarketplacePermissions | null;
  onReport: () => void;
}) {
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const stageTestUrl = entry ? `/stage-test?repo=${encodeURIComponent(`${entry.repoOwner}/${entry.repoName}`)}&ref=${encodeURIComponent(entry.commitSha)}` : '#';
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      {!entry ? null : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={850} noWrap>{entry.title}</Typography>
              <GitHubIdentity username={entry.author?.githubUsername || entry.repoOwner} suffix={`/${entry.repoName}`} />
            </Box>
            <Stack direction="row" spacing={0.5}>
              {(reporting?.reportingEnabled || reporting?.reportingContact) && <IconButton onClick={(event) => setMoreAnchor(event.currentTarget)} aria-label="More stage actions"><MoreVertIcon /></IconButton>}
              <IconButton onClick={onClose} aria-label="Close stage details"><CloseIcon /></IconButton>
            </Stack>
            <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
              {reporting?.reportingEnabled ? <MenuItem onClick={() => { setMoreAnchor(null); onReport(); }}>Report stage</MenuItem> : reporting?.reportingContact ? <MenuItem component="a" href={`mailto:${reporting.reportingContact}`} onClick={() => setMoreAnchor(null)}>Contact marketplace owner</MenuItem> : null}
            </Menu>
          </Stack>
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <StagePreview title={entry.title} previewUrl={entry.previewUrl} />
            <Stack spacing={2} sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">{entry.description || 'No description provided.'}</Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {entry.badges?.verified && (
                  <Tooltip title="Verified by a marketplace maintainer after human review." arrow>
                    <Chip size="small" color="primary" icon={<VerifiedIcon />} label="Verified" />
                  </Tooltip>
                )}
                <ValidationChip entry={entry} />
                {(entry.tags || []).map((tag) => <Chip key={tag} size="small" label={tag} />)}
              </Stack>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 2, rowGap: 1 }}>
                <Typography variant="caption" color="text.secondary">Author</Typography><GitHubIdentity username={entry.author?.githubUsername || entry.repoOwner} />
                <Typography variant="caption" color="text.secondary">Updated</Typography><Typography variant="body2">{formatStageDate(entry.updatedAt)}</Typography>
                <Typography variant="caption" color="text.secondary">Status</Typography><Typography variant="body2">{entry.badges?.verified ? 'Verified' : 'Community published'} · {validationMeta(entry.badges?.validation).label}</Typography>
              </Box>
              <Box component="details">
                <Typography component="summary" variant="body2" fontWeight={700} sx={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Revision</Typography>
                <Stack spacing={1} sx={{ pb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{entry.commitSha}</Typography>
                  <Button size="small" variant="outlined" onClick={() => void navigator.clipboard.writeText(entry.commitSha)} sx={{ alignSelf: 'flex-start' }}>Copy revision</Button>
                </Stack>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button component="a" href={stageTestUrl} target="_blank" rel="noreferrer" variant="contained" startIcon={<PlayArrowIcon />}>
                  Test stage
                </Button>
                {!forkStep && (
                  <Button variant="outlined" onClick={() => onOpenFork(entry)} disabled={forkBusy} startIcon={<GitHubIcon />}>
                    {forkBusy ? 'Checking GitHub…' : MARKETPLACE_COPY.forkStage}
                  </Button>
                )}
                <Button component="a" href={entry.repoUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<GitHubIcon />} endIcon={<OpenInNewIcon />}>
                  Source
                </Button>
              </Stack>
              {forkStep === 'ready' ? (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'success.light', borderRadius: 1.5, bgcolor: 'success.light' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800}>“{entry.title}” is ready to edit</Typography>
                        <Typography variant="body2" color="text.secondary">This fork is already connected to FOSSBot.</Typography>
                      </Box>
                      <IconButton size="small" onClick={onCancelFork} aria-label="Dismiss completed fork status">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Button variant="contained" color="success" onClick={() => onCompleteFork(entry)} disabled={forkBusy} sx={{ alignSelf: 'flex-start' }}>
                      {forkBusy ? 'Opening editable copy…' : 'Open editable copy'}
                    </Button>
                  </Stack>
                </Box>
              ) : forkStep && (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', borderRadius: 1.5, bgcolor: 'primary.light' }}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>Forking “{entry.title}”</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {forkStep === 'create'
                          ? 'Finish the GitHub fork, then continue here.'
                          : forkStep === 'select'
                            ? 'Give FOSSBot access to the new fork, then finish setup.'
                            : 'FOSSBot can access this fork. Finish setting up your editable copy.'}
                      </Typography>
                    </Box>
                    <ForkProgress step={forkStep} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      {forkStep === 'create' ? (
                        <>
                          <Button component="a" href={`${entry.repoUrl}/fork`} target="_blank" rel="noreferrer" variant="outlined" startIcon={<GitHubIcon />}>
                            Open GitHub
                          </Button>
                          <Button variant="contained" onClick={() => onCompleteFork(entry)} disabled={forkBusy}>
                            {forkBusy ? 'Checking fork…' : 'I created the fork'}
                          </Button>
                        </>
                      ) : forkStep === 'select' ? (
                        <>
                          {forkInstallationUrl && (
                            <Button component="a" href={forkInstallationUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<GitHubIcon />}>
                              Select fork in GitHub
                            </Button>
                          )}
                          <Button variant="contained" onClick={() => onCompleteFork(entry)} disabled={forkBusy}>
                            {forkBusy ? 'Finishing setup…' : 'I selected it'}
                          </Button>
                        </>
                      ) : (
                        <Button variant="contained" onClick={() => onCompleteFork(entry)} disabled={forkBusy}>
                          {forkBusy ? 'Finishing setup…' : 'Finish setup'}
                        </Button>
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '68ch' }}>
                      {forkStep === 'create' ? (
                        <>Click <strong>Open GitHub</strong> to create the fork. When it is ready, return here and click <strong>I created the fork</strong>.</>
                      ) : forkStep === 'select' ? (
                        <>Click <strong>Select fork in GitHub</strong>, select this repository for the FOSSBot App, then return here and click <strong>I selected it</strong>.</>
                      ) : (
                        <>Click <strong>Finish setup</strong> to open your editable copy.</>
                      )}
                    </Typography>
                    <Button variant="outlined" size="small" color="inherit" onClick={onCancelFork} sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}>
                      Cancel fork
                    </Button>
                  </Stack>
                </Box>
              )}
              {forkError && (
                <Alert severity="error">
                  {forkError}
                </Alert>
              )}
            </Stack>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export default function StageMarketplacePanel({ embedded = false, preview = false }: { embedded?: boolean; preview?: boolean }) {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [index, setIndex] = useState<MarketplaceIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort] = useState<'updated' | 'published' | 'verified'>('updated');
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [detailLookupKey, setDetailLookupKey] = useState('');
  const [detailUnavailable, setDetailUnavailable] = useState(false);
  const [selected, setSelected] = useState<MarketplaceStageEntry | null>(null);
  const [forkFlow, setForkFlow] = useState<ForkFlow | null>(readForkFlow);
  const [forkBusy, setForkBusy] = useState(false);
  const [forkError, setForkError] = useState('');
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<number | null>(null);
  const [reporting, setReporting] = useState<MarketplacePermissions | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<MarketplaceReportCategory>('broken_misleading');
  const [reportExplanation, setReportExplanation] = useState('');
  const [reportTouched, setReportTouched] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!token || preview) return;
    void getMarketplacePermissions(token).then(setReporting).catch(() => setReporting(null));
  }, [preview, token]);

  const setActiveForkFlow = (flow: ForkFlow | null) => {
    setForkFlow(flow);
    writeForkFlow(flow);
  };

  const handleOpenFork = async (entry: MarketplaceStageEntry) => {
    if (!token) {
      setForkError('Sign in and connect GitHub before forking a stage.');
      return;
    }
    setForkBusy(true);
    setForkError('');
    try {
      const status = await getMarketplaceForkStatus(token, entry.repoOwner, entry.repoName);
      if (status.exists) {
        if (!status.valid) {
          setForkError(status.message || 'A repository with this name already exists but is not the expected fork.');
          return;
        }
        setActiveForkFlow({
          repoOwner: entry.repoOwner,
          repoName: entry.repoName,
          step: status.setupComplete ? 'ready' : status.appAccess ? 'finish' : 'select',
          installationUrl: status.installationUrl || undefined,
        });
        return;
      }
      setActiveForkFlow({ repoOwner: entry.repoOwner, repoName: entry.repoName, step: 'create' });
    } catch (error) {
      setForkError(error instanceof Error ? error.message : 'Could not check GitHub for an existing fork.');
    } finally {
      setForkBusy(false);
    }
  };

  const handleCompleteFork = async (entry: MarketplaceStageEntry) => {
    if (!token) return;
    setForkBusy(true);
    setForkError('');
    try {
      const fork = await completeMarketplaceFork(token, entry.repoOwner, entry.repoName);
      invalidateMarketplaceFirstPage();
      if (userKey) invalidateUserStages(userKey);
      await refreshStageLists(userKey, token, { force: true });
      setActiveForkFlow(null);
      navigate(`/stage-builder?open=github&repo=${encodeURIComponent(`${fork.repoOwner}/${fork.repoName}`)}`);
    } catch (error) {
      setForkError(error instanceof Error ? error.message : 'Could not fork this stage.');
      if (error instanceof MarketplaceRequestError && error.code === 'repo_not_installed') {
        setActiveForkFlow({
          repoOwner: entry.repoOwner,
          repoName: entry.repoName,
          step: 'select',
          installationUrl: error.installationUrl || undefined,
        });
      }
    } finally {
      setForkBusy(false);
    }
  };

  useEffect(() => {
    if (!token || !forkFlow || forkFlow.step !== 'select' || forkFlow.installationUrl) return;
    let active = true;
    getMarketplaceForkStatus(token, forkFlow.repoOwner, forkFlow.repoName)
      .then((status) => {
        if (!active || !status.exists || !status.valid) return;
        const restoredFlow: ForkFlow = {
          repoOwner: forkFlow.repoOwner,
          repoName: forkFlow.repoName,
          step: status.setupComplete ? 'ready' : status.appAccess ? 'finish' : 'select',
          installationUrl: status.installationUrl || undefined,
        };
        setForkFlow(restoredFlow);
        writeForkFlow(restoredFlow);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [forkFlow, token]);

  const canonicalRequest = preview || (!query.trim() && !activeTag && sort === 'updated' && page === 1);

  useEffect(() => {
    if (!canonicalRequest) return undefined;
    const sync = () => {
      const snapshot = marketplaceFirstPageSnapshot();
      setIndex(snapshot.data);
      setLoading(!snapshot.data);
      setError(snapshot.refreshError || '');
      setCacheRefreshing(snapshot.refreshing);
      setCacheUpdatedAt(snapshot.updatedAt);
    };
    sync();
    const unsubscribe = subscribeMarketplaceFirstPage(sync);
    void refreshMarketplaceFirstPage();
    return unsubscribe;
  }, [canonicalRequest]);

  useEffect(() => {
    if (canonicalRequest) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setIndex(null);
    setCacheRefreshing(false);
    const timer = window.setTimeout(() => {
      getMarketplaceIndex({ page, pageSize: PAGE_SIZE, q: query.trim(), tag: activeTag, sort })
        .then((payload) => {
          if (!controller.signal.aborted) setIndex(payload);
        })
        .catch((loadError) => {
          if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load marketplace index.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeTag, canonicalRequest, page, query, retryKey, sort]);

  const stages = preview ? (index?.stages || []).slice(0, 3) : index?.stages || [];
  const pagination = index?.pagination;
  const tags = index?.tags || [];
  const selectedForkFlow = forkFlow && selected && forkFlow.repoOwner === selected.repoOwner && forkFlow.repoName === selected.repoName
    ? forkFlow
    : null;

  useEffect(() => {
    if (preview) return;
    let active = true;
    const stageKey = searchParams.get('stage');
    if (!stageKey) {
      if (selected) setSelected(null);
      if (detailUnavailable) setDetailUnavailable(false);
      return;
    }
    if (selected && `${selected.repoOwner}/${selected.repoName}` !== stageKey) {
      setSelected(null);
      return;
    }
    const match = stages.find((entry) => `${entry.repoOwner}/${entry.repoName}` === stageKey);
    if (match && match !== selected) {
      setDetailUnavailable(false);
      setSelected(match);
      return;
    }
    if (!match && index && detailLookupKey !== stageKey) {
      setDetailLookupKey(stageKey);
      setDetailUnavailable(false);
      void getMarketplaceIndex({ q: stageKey, pageSize: PAGE_SIZE }).then((result) => {
        if (!active) return;
        const exact = result.stages.find((entry) => `${entry.repoOwner}/${entry.repoName}` === stageKey);
        if (exact) setSelected(exact);
        else setDetailUnavailable(true);
      }).catch(() => { if (active) setDetailUnavailable(true); });
      return () => { active = false; };
    }
    return () => { active = false; };
  }, [detailLookupKey, detailUnavailable, index, preview, searchParams, selected, stages]);

  const selectStage = (entry: MarketplaceStageEntry) => {
    if (preview) {
      navigate(`/stages?tab=explore&stage=${encodeURIComponent(`${entry.repoOwner}/${entry.repoName}`)}`);
      return;
    }
    setSelected(entry);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'explore');
    next.set('stage', `${entry.repoOwner}/${entry.repoName}`);
    setSearchParams(next);
  };

  const closeStage = () => {
    setSelected(null);
    setForkError('');
    const next = new URLSearchParams(searchParams);
    next.delete('stage');
    setSearchParams(next, { replace: true });
  };

  const submitReport = async () => {
    if (!reportExplanation.trim()) {
      setReportTouched(true);
      return;
    }
    if (!token || !selected) return;
    setReportBusy(true);
    setReportError('');
    try {
      await reportMarketplaceStage(token, { repoOwner: selected.repoOwner, repoName: selected.repoName, category: reportCategory, explanation: reportExplanation.trim() });
      setReportSent(true);
    } catch (submitError) {
      setReportError(submitError instanceof Error ? submitError.message : 'Could not send this report.');
    } finally {
      setReportBusy(false);
    }
  };

  const panelAction = (
    <Stack direction="row" spacing={1} alignItems="center">
      {canonicalRequest && cacheUpdatedAt && <Typography variant="caption" color="text.secondary">{cacheRefreshing ? 'Refreshing…' : formatStageRelativeTime(cacheUpdatedAt)}</Typography>}
      {preview ? (
        <Button variant="outlined" size="small" onClick={() => navigate('/stages?tab=explore')}>Explore stages</Button>
      ) : (
        <Button variant="outlined" size="small" onClick={() => { void refreshStageLists(userKey, token, { force: true }); }} disabled={cacheRefreshing}>
          {cacheRefreshing ? 'Refreshing…' : 'Refresh stages'}
        </Button>
      )}
    </Stack>
  );

  return (
    <Box sx={embedded ? undefined : { mt: 3 }}>
      <MarketplacePanelFrame preview={preview} action={panelAction}>
        <Box sx={preview ? undefined : { border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        {!preview && <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              size="small"
              placeholder="Search title, author, tag, or repo"
              inputProps={{ 'aria-label': 'Search stages' }}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <Select size="small" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} sx={{ minWidth: 176 }} aria-label="Sort stages">
              <MenuItem value="updated">Recently updated</MenuItem>
              <MenuItem value="published">Recently published</MenuItem>
              <MenuItem value="verified">Verified first</MenuItem>
            </Select>
            {(query || activeTag) && <Button variant="text" onClick={() => { setQuery(''); setActiveTag(''); setPage(1); }}>Clear filters</Button>}
          </Stack>
          {!!tags.length && (
                <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
              {tags.map(({ tag, count }) => (
                <Chip
                  key={tag}
                  size="small"
                  label={`${tag} ${count}`}
                  color={activeTag === tag ? 'primary' : 'default'}
                  variant={activeTag === tag ? 'filled' : 'outlined'}
                  onClick={() => { setActiveTag((current) => current === tag ? '' : tag); setPage(1); }}
                />
              ))}
            </Stack>
          )}
        </Box>}

        {loading && !index ? (
          <Grid container spacing={2} sx={{ p: preview ? 0 : 2 }} aria-label="Loading stages">
            {Array.from({ length: preview ? 3 : 8 }).map((_, item) => <Grid key={item} item xs={12} sm={6} lg={4} xl={preview ? 4 : 3}><StageCardSkeleton surface={preview ? 'embedded' : 'outlined'} /></Grid>)}
          </Grid>
        ) : error ? (
          <Alert severity={index ? "warning" : "error"} sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={() => canonicalRequest ? void refreshStageLists(userKey, token, { force: true }) : setRetryKey((current) => current + 1)}>Retry</Button>}>{error}</Alert>
        ) : index?.warning ? (
          <Alert severity="info" sx={{ m: 2 }}>{index.warning}</Alert>
        ) : null}

        {!loading && (
          stages.length ? (
            <>
              {!preview && pagination && <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 2 }}>{pagination.total} stage{pagination.total === 1 ? '' : 's'}</Typography>}
              <Grid container spacing={2} sx={{ p: preview ? 0 : 2 }}>
                {stages.map((entry) => (
                  <Grid key={`${entry.repoOwner}/${entry.repoName}`} item xs={12} sm={6} lg={4} xl={preview ? 4 : 3}>
                    <MarketplaceStageCard entry={entry} onSelect={selectStage} embedded={preview} />
                  </Grid>
                ))}
              </Grid>
              {pagination && pagination.totalPages > 1 && (
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ px: 2, pb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} stages
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" disabled={!pagination.hasPrevious} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                    <Button variant="outlined" disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)}>Next</Button>
                  </Stack>
                </Stack>
              )}
            </>
          ) : (
            <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" fontWeight={800}>No stages found</Typography>
              <Typography variant="body2" color="text.secondary">Try another search, clear the tag filter, or publish the first stage from Stage Builder.</Typography>
            </Box>
          )
        )}
        </Box>
      </MarketplacePanelFrame>
      <Drawer anchor="right" open={detailUnavailable && !selected && !!searchParams.get('stage')} onClose={closeStage} PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}>
        <Stack spacing={2} sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={800}>Stage unavailable</Typography>
            <IconButton onClick={closeStage} aria-label="Close unavailable stage details"><CloseIcon /></IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary">This stage may have been unpublished, removed, or moved.</Typography>
          <Button variant="contained" onClick={closeStage} sx={{ alignSelf: 'flex-start' }}>Back to {MARKETPLACE_COPY.stageLibrary.toLowerCase()}</Button>
        </Stack>
      </Drawer>
      <MarketplaceDetailDrawer
        entry={selected}
        open={!!selected}
        onClose={closeStage}
        onOpenFork={handleOpenFork}
        onCompleteFork={handleCompleteFork}
        onCancelFork={() => { setActiveForkFlow(null); setForkError(''); }}
        forkStep={selectedForkFlow?.step || null}
        forkBusy={forkBusy}
        forkError={forkError}
        forkInstallationUrl={selectedForkFlow?.installationUrl}
        reporting={reporting}
        onReport={() => { setReportCategory('broken_misleading'); setReportExplanation(''); setReportTouched(false); setReportError(''); setReportSent(false); setReportOpen(true); }}
      />
      <Dialog open={reportOpen} onClose={reportBusy ? undefined : () => setReportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Report stage</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {reportSent ? <Alert severity="success">Report sent to this FOSSBot instance’s moderators.</Alert> : <>
              <Typography variant="body2" color="text.secondary">Reports are private and include the published stage revision.</Typography>
              {reportError && <Alert severity="error">{reportError}</Alert>}
              <TextField select label="Reason" value={reportCategory} onChange={(event) => setReportCategory(event.target.value as MarketplaceReportCategory)} fullWidth>
                {MARKETPLACE_REPORT_CATEGORIES.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}
              </TextField>
              <TextField label="What happened?" value={reportExplanation} onChange={(event) => setReportExplanation(event.target.value)} onBlur={() => setReportTouched(true)} multiline minRows={3} required error={reportTouched && !reportExplanation.trim()} helperText={reportTouched && !reportExplanation.trim() ? 'Add a short explanation.' : ' '} fullWidth />
            </>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)} disabled={reportBusy}>{reportSent ? 'Done' : 'Cancel'}</Button>
          {!reportSent && <Button variant="contained" onClick={submitReport} disabled={reportBusy || !reportExplanation.trim()}>{reportBusy ? 'Sending…' : 'Send report'}</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
