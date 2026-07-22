import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import { completeMarketplaceFork, getMarketplaceForkStatus, getMarketplaceIndex, MarketplaceRequestError, type MarketplaceIndexResponse, type MarketplaceStageEntry, type MarketplaceValidationState } from 'src/stages/MarketplaceApi';
import { invalidateMarketplaceFirstPage, invalidateUserStages, marketplaceFirstPageSnapshot, refreshMarketplaceFirstPage, refreshStageLists, stageListUserKey, subscribeMarketplaceFirstPage } from 'src/stages/stageListCache';

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRefreshTime(value: number | null): string {
  if (!value) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes === 1) return 'Updated a minute ago';
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  return `Updated ${Math.floor(minutes / 60)} hours ago`;
}

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

function StagePreview({ entry }: { entry: MarketplaceStageEntry }) {
  if (entry.previewUrl) {
    return (
      <Box
        component="img"
        src={entry.previewUrl}
        alt=""
        sx={{ width: '100%', height: 156, objectFit: 'cover', display: 'block', bgcolor: '#0f172a' }}
      />
    );
  }
  return (
    <Box sx={{ height: 156, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #e8f0ff 0%, #eefcfb 100%)', color: '#475569' }}>
      <Stack spacing={0.5} alignItems="center">
        <Typography variant="h6" fontWeight={800}>FOSSBot</Typography>
        <Typography variant="caption">No preview yet</Typography>
      </Stack>
    </Box>
  );
}

function MarketplaceStageCard({ entry, onSelect }: { entry: MarketplaceStageEntry; onSelect: (entry: MarketplaceStageEntry) => void }) {
  return (
    <Box
      component="article"
      sx={{
        height: '100%',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <StagePreview entry={entry} />
      <Stack spacing={1.5} sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap title={entry.title}>{entry.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {entry.repoOwner}/{entry.repoName}
            </Typography>
          </Box>
          {entry.badges?.verified && <VerifiedIcon color="primary" fontSize="small" titleAccess="Verified by a marketplace maintainer" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.description || 'A community FOSSBot stage.'}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          <ValidationChip entry={entry} />
          {(entry.tags || []).slice(0, 3).map((tag) => <Chip key={tag} size="small" label={tag} />)}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={() => onSelect(entry)}>Details</Button>
      </Stack>
    </Box>
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
}) {
  const stageTestUrl = entry ? `/stage-test?repo=${encodeURIComponent(`${entry.repoOwner}/${entry.repoName}`)}&ref=${encodeURIComponent(entry.commitSha)}` : '#';
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      {!entry ? null : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={850} noWrap>{entry.title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">{entry.repoOwner}/{entry.repoName}</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Close stage details"><CloseIcon /></IconButton>
          </Stack>
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <StagePreview entry={entry} />
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
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Author</Typography>
                <Typography variant="body2" color="text.secondary">
                  @{entry.author?.githubUsername || entry.repoOwner}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Published state</Typography>
                <Typography variant="body2" color="text.secondary">
                  Published {formatDate(entry.publishedAt)} · updated {formatDate(entry.updatedAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                  Commit {entry.commitSha}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Validation</Typography>
                <Typography variant="body2" color="text.secondary">
                  {entry.validation?.message || validationMeta(entry.badges?.validation).description}
                </Typography>
                {entry.validation?.checkedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Checked {formatDate(entry.validation.checkedAt)}
                  </Typography>
                )}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button component="a" href={stageTestUrl} target="_blank" rel="noreferrer" variant="contained" startIcon={<PlayArrowIcon />}>
                  Test stage
                </Button>
                {!forkStep && (
                  <Button variant="outlined" onClick={() => onOpenFork(entry)} disabled={forkBusy} startIcon={<GitHubIcon />}>
                    {forkBusy ? 'Checking GitHub…' : 'Fork stage'}
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

export default function StageMarketplacePanel({ embedded = false }: { embedded?: boolean }) {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const navigate = useNavigate();
  const [index, setIndex] = useState<MarketplaceIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort] = useState<'updated' | 'published' | 'verified'>('updated');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MarketplaceStageEntry | null>(null);
  const [forkFlow, setForkFlow] = useState<ForkFlow | null>(readForkFlow);
  const [forkBusy, setForkBusy] = useState(false);
  const [forkError, setForkError] = useState('');
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<number | null>(null);

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

  const canonicalRequest = !query.trim() && !activeTag && sort === 'updated' && page === 1;

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
  }, [activeTag, canonicalRequest, page, query, sort]);

  const stages = index?.stages || [];
  const pagination = index?.pagination;
  const tags = index?.tags || [];
  const selectedForkFlow = forkFlow && selected && forkFlow.repoOwner === selected.repoOwner && forkFlow.repoName === selected.repoName
    ? forkFlow
    : null;

  return (
    <Box sx={embedded ? undefined : { mt: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={850}>Stage library</Typography>
          <Typography variant="body2" color="text.secondary">
            Discover reviewed Git-hosted stages for FOSSBot simulations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {canonicalRequest && cacheUpdatedAt && <Typography variant="caption" color="text.secondary">{cacheRefreshing ? 'Refreshing…' : formatRefreshTime(cacheUpdatedAt)}</Typography>}
          <Button variant="outlined" size="small" onClick={() => { void refreshStageLists(userKey, token, { force: true }); }} disabled={cacheRefreshing}>
            {cacheRefreshing ? 'Refreshing…' : 'Refresh stages'}
          </Button>
          <Select size="small" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} sx={{ minWidth: 140 }}>
            <MenuItem value="updated">Recently updated</MenuItem>
            <MenuItem value="published">Recently published</MenuItem>
            <MenuItem value="verified">Verified first</MenuItem>
          </Select>
        </Stack>
      </Stack>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              placeholder="Search title, author, tag, or repo"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={() => { setQuery(''); setActiveTag(''); setPage(1); }}>Clear</Button>
          </Stack>
          {!!tags.length && (
            <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
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
        </Box>

        {loading && !index ? (
          <Stack sx={{ py: 6, alignItems: 'center' }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Loading marketplace index…</Typography>
          </Stack>
        ) : error ? (
          <Alert severity={index ? "warning" : "error"} sx={{ m: 2 }}>{error}</Alert>
        ) : index?.warning ? (
          <Alert severity="info" sx={{ m: 2 }}>{index.warning}</Alert>
        ) : null}

        {!loading && (
          stages.length ? (
            <>
              <Grid container spacing={2} sx={{ p: 2 }}>
                {stages.map((entry) => (
                  <Grid key={`${entry.repoOwner}/${entry.repoName}`} item xs={12} sm={6} lg={4} xl={3}>
                    <MarketplaceStageCard entry={entry} onSelect={setSelected} />
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
      <MarketplaceDetailDrawer
        entry={selected}
        open={!!selected}
        onClose={() => { setSelected(null); setForkError(''); }}
        onOpenFork={handleOpenFork}
        onCompleteFork={handleCompleteFork}
        onCancelFork={() => { setActiveForkFlow(null); setForkError(''); }}
        forkStep={selectedForkFlow?.step || null}
        forkBusy={forkBusy}
        forkError={forkError}
        forkInstallationUrl={selectedForkFlow?.installationUrl}
      />
    </Box>
  );
}
