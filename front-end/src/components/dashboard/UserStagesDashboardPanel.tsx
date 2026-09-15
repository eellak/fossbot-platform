import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControl, IconButton, InputAdornment, InputLabel, Menu, MenuItem, Pagination, Select, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import AddIcon from '@mui/icons-material/Add';
import { IconLayoutGrid, IconLayoutList, IconSearch, IconX } from '@tabler/icons-react';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import CardDialog, { type StageSelection } from 'src/components/stage-select-popup/CardDialog';
import { useAuth } from 'src/authentication/AuthProvider';
import { listLocalStages, unpublishLocalStage, type LocalStage } from 'src/stages/LocalStagesApi';
import { getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import type { MyMarketplaceStage } from 'src/stages/MarketplaceApi';
import type { ProviderStageListItem } from 'src/stages/StagesApi';
import {
  invalidateMarketplaceFirstPage,
  invalidateMyMarketplaceStages,
  invalidateUserStages,
  myMarketplaceStagesSnapshot,
  refreshMarketplaceFirstPage,
  refreshMyMarketplaceStages,
  refreshUserStages,
  stageListUserKey,
  subscribeLocalStages,
  subscribeMyMarketplaceStages,
  subscribeUserStages,
  userStagesSnapshot,
} from 'src/stages/stageListCache';
import { formatStageRelativeTime } from 'src/stages/StageCard';
import StageListCard from 'src/stages/StageListCard';
import StageDetailsDialog, { localStageDetailRows } from 'src/stages/StageDetailsDialog';
import { useStagePreviews } from 'src/stages/useStagePreviews';
import { MARKETPLACE_COPY } from 'src/stages/marketplaceCopy';
import { useLocation, useNavigate } from 'react-router-dom';

type DashboardStage = {
  key: string;
  title: string;
  updatedAt: string;
  href: string;
  source: 'local' | 'github';
  detail: string;
  description?: string;
  localStage?: LocalStage;
  notice?: string;
  status?: string;
  statusKey: 'draft' | 'published' | 'pending' | 'rejected';
  statusColor?: 'success' | 'warning' | 'error' | 'default';
  previewUrl?: string | null;
};

const STAGES_LIST_PER_PAGE = 5;
const STAGES_CARDS_PER_PAGE = 6;
const STAGE_VIEW_MODE_STORAGE_KEY = 'fossbot-stages-view-mode';

const readStoredStageViewMode = (): 'list' | 'cards' => {
  try {
    return window.localStorage.getItem(STAGE_VIEW_MODE_STORAGE_KEY) === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
};

function githubKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function githubEditorUrl(stage: ProviderStageListItem): string {
  return `/stage-builder?${new URLSearchParams({ open: 'github', repo: githubKey(stage.repoOwner, stage.repoName) }).toString()}`;
}

function publicationAsStage(publication: MyMarketplaceStage): ProviderStageListItem {
  return {
    repoOwner: publication.entry.repoOwner,
    repoName: publication.entry.repoName,
    repoUrl: publication.entry.repoUrl || `https://github.com/${publication.entry.repoOwner}/${publication.entry.repoName}`,
    title: publication.entry.title,
    description: publication.entry.description,
    defaultBranch: publication.entry.defaultBranch,
    updatedAt: publication.entry.updatedAt,
    private: false,
    visibility: 'public',
  };
}

function localStatus(stage: LocalStage): Pick<DashboardStage, 'status' | 'statusKey' | 'statusColor'> {
  if (stage.submission?.status === 'pending') return { status: `v${stage.submission.stageRevision} awaiting review`, statusKey: 'pending', statusColor: 'warning' };
  if (stage.submission?.status === 'rejected') return { status: `v${stage.submission.stageRevision} rejected`, statusKey: 'rejected', statusColor: 'error' };
  if (stage.publication?.active) return { status: stage.publication.stageRevision === stage.revision ? 'Published' : `Published v${stage.publication.stageRevision}`, statusKey: 'published', statusColor: 'success' };
  return { statusKey: 'draft' };
}

export default function UserStagesDashboardPanel({ showViewAll = true, appearance = 'card' }: { showViewAll?: boolean; appearance?: 'card' | 'page' }) {
  const confirmDialog = useConfirmDialog();
  const { notify } = useNotifications();
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userKey = stageListUserKey(user);
  const [localStages, setLocalStages] = useState<LocalStage[]>([]);
  const [githubStages, setGitHubStages] = useState<ProviderStageListItem[]>([]);
  const [publications, setPublications] = useState<MyMarketplaceStage[]>([]);
  const [providerStatus, setProviderStatus] = useState<GitHubProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [localStageBusy, setLocalStageBusy] = useState<number | null>(null);
  const [stageMenu, setStageMenu] = useState<{ anchorEl: HTMLElement; stage: DashboardStage } | null>(null);
  const [detailsStage, setDetailsStage] = useState<DashboardStage | null>(null);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'github'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'pending' | 'rejected'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>(readStoredStageViewMode);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(STAGES_LIST_PER_PAGE);
  const collectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STAGE_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Storage can be unavailable; the in-memory preference still applies.
    }
  }, [viewMode]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('create') === '1') setStagePickerOpen(true);
  }, [location.search]);

  const closeStagePicker = () => {
    setStagePickerOpen(false);
    const params = new URLSearchParams(location.search);
    if (params.has('create')) {
      params.delete('create');
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
    }
  };

  const openStageInBuilder = (selection: StageSelection) => {
    if (selection.sourceType === 'local' && selection.localStageId) {
      navigate(`/stage-builder?${new URLSearchParams({ open: 'local', id: String(selection.localStageId) })}`);
      return;
    }
    if (selection.sourceType === 'github' && selection.repoOwner && selection.repoName) {
      navigate(`/stage-builder?${new URLSearchParams({ open: 'github', repo: `${selection.repoOwner}/${selection.repoName}` })}`);
      return;
    }
    if (selection.url) navigate(`/stage-builder?${new URLSearchParams({ open: 'url', url: selection.url })}`);
  };

  const connectGitHub = useCallback(async () => {
    if (!token) {
      setError('Sign in before connecting GitHub.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      window.location.assign(await getGitHubLoginUrl(token));
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not start GitHub connection.');
      setConnecting(false);
    }
  }, [token]);

  useEffect(() => {
    if (!userKey) return undefined;
    const syncGitHub = () => setGitHubStages(userStagesSnapshot(userKey).data || []);
    const syncPublications = () => setPublications(myMarketplaceStagesSnapshot(userKey).data || []);
    syncGitHub();
    syncPublications();
    const unsubscribeGitHub = subscribeUserStages(userKey, syncGitHub);
    const unsubscribePublications = subscribeMyMarketplaceStages(userKey, syncPublications);
    return () => { unsubscribeGitHub(); unsubscribePublications(); };
  }, [userKey]);

  const refreshLocalStages = useCallback(async () => {
    if (!token) return;
    try {
      setLocalStages(await listLocalStages(token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load local stages.');
    }
  }, [token]);

  // Refetch when a Stage Builder save finishes, including saves that commit
  // after this panel has already mounted.
  useEffect(() => {
    if (!token) return undefined;
    return subscribeLocalStages(() => { void refreshLocalStages(); });
  }, [refreshLocalStages, token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      listLocalStages(token),
      getGitHubProviderStatus(token),
    ]).then(async ([localResult, statusResult]) => {
      if (!active) return;
      if (localResult.status === 'fulfilled') setLocalStages(localResult.value);
      else setError(localResult.reason instanceof Error ? localResult.reason.message : 'Could not load local stages.');
      if (statusResult.status === 'fulfilled') {
        const status = statusResult.value;
        setProviderStatus(status);
        if (userKey) {
          if (status.connected && !status.needsReconnect) {
            await Promise.all([refreshMyMarketplaceStages(userKey, token), refreshUserStages(userKey, token)]);
          } else {
            invalidateMyMarketplaceStages(userKey);
            invalidateUserStages(userKey);
            setPublications([]);
            setGitHubStages([]);
          }
        }
      } else {
        setError((current) => current || (statusResult.reason instanceof Error ? statusResult.reason.message : 'Could not check the GitHub connection.'));
      }
    }).catch((loadError) => {
      if (active) setError((current) => current || (loadError instanceof Error ? loadError.message : 'Could not refresh GitHub stages.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, userKey]);

  const updateLocalPublication = async (stage: LocalStage) => {
    if (!token) return;
    const pending = stage.submission?.status === 'pending';
    const published = !!stage.publication?.active;
    const confirmation = published
      ? pending
        ? `Unpublish “${stage.title}” and cancel its pending update?`
        : `Unpublish “${stage.title}”?`
      : `Cancel the publication request for “${stage.title}”?`;
    const confirmed = await confirmDialog.confirm({
      title: published ? 'Unpublish stage' : 'Cancel publication request',
      message: confirmation,
      confirmLabel: published ? 'Unpublish' : 'Cancel request',
      cancelLabel: 'Keep it published',
      danger: true,
    });
    if (!confirmed) return;

    setLocalStageBusy(stage.id);
    setError('');
    try {
      await unpublishLocalStage(token, stage.id);
      setLocalStages(await listLocalStages(token));
      invalidateMarketplaceFirstPage();
      await refreshMarketplaceFirstPage(token, { force: true });
      notify(published ? 'Stage unpublished.' : 'Publication request cancelled.', { severity: 'success' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the publication.');
    } finally {
      setLocalStageBusy(null);
    }
  };

  const stages = useMemo<DashboardStage[]>(() => {
    const rows: DashboardStage[] = localStages.map((stage) => ({
      key: `local:${stage.id}`,
      title: stage.title,
      description: stage.description,
      updatedAt: stage.updatedAt,
      href: `/stage-builder?open=local&id=${stage.id}`,
      source: 'local',
      detail: `v${stage.revision}`,
      localStage: stage,
      previewUrl: stage.previewUrl,
      notice: stage.submission?.status === 'rejected' ? stage.submission.reviewReason || 'A reviewer rejected this revision.' : undefined,
      ...localStatus(stage),
    }));
    const githubByKey = new Map<string, { stage: ProviderStageListItem; publication: MyMarketplaceStage | null }>();
    githubStages.forEach((stage) => githubByKey.set(githubKey(stage.repoOwner, stage.repoName), { stage, publication: null }));
    publications.forEach((publication) => {
      const key = githubKey(publication.entry.repoOwner, publication.entry.repoName);
      const current = githubByKey.get(key);
      githubByKey.set(key, { stage: current?.stage || publicationAsStage(publication), publication });
    });
    githubByKey.forEach(({ stage, publication }, key) => rows.push({
      key: `github:${key}`,
      title: stage.title || stage.repoName,
      description: stage.description,
      updatedAt: stage.updatedAt || publication?.entry.updatedAt || '',
      href: githubEditorUrl(stage),
      source: 'github',
      detail: `${stage.repoOwner}/${stage.repoName}\u00A0\u00A0${stage.private ? 'Private' : 'Public'}`,
      status: publication ? 'Published' : undefined,
      statusKey: publication ? 'published' : 'draft',
      statusColor: publication ? 'success' : undefined,
      previewUrl: publication?.entry.previewUrl,
    }));
    return rows.sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
  }, [githubStages, localStages, publications]);

  const previewObjectUrls = useStagePreviews(token, stages.map((stage) => stage.previewUrl));

  const query = search.trim().toLowerCase();
  const filteredStages = useMemo(() => stages.filter((stage) => {
    const haystack = [stage.title, stage.description, stage.detail, stage.status, stage.notice].filter(Boolean).join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (sourceFilter === 'all' || stage.source === sourceFilter)
      && (statusFilter === 'all' || stage.statusKey === statusFilter);
  }), [query, sourceFilter, stages, statusFilter]);

  const stagesPerPage = pageSize;
  const pageCount = Math.max(1, Math.ceil(filteredStages.length / stagesPerPage));
  const pageStart = (page - 1) * stagesPerPage;
  const visibleStages = filteredStages.slice(pageStart, pageStart + stagesPerPage);

  // On the browsing page, pack as many rows as the viewport can show. The
  // Dashboard card keeps the fixed page sizes above because it is a small
  // panel inside a dashboard column.
  useLayoutEffect(() => {
    if (appearance !== 'page') {
      setPageSize(viewMode === 'cards' ? STAGES_CARDS_PER_PAGE : STAGES_LIST_PER_PAGE);
      return undefined;
    }
    const measure = () => {
      const container = collectionRef.current;
      if (!container) return;
      // Average the visible items so a short first row (e.g. no description)
      // cannot skew the estimate, while short pages still fill the viewport.
      const heights = Array.from(container.children)
        .map((child) => (child as HTMLElement).getBoundingClientRect().height)
        .filter((height) => height > 0);
      const itemHeight = heights.length ? heights.reduce((sum, height) => sum + height, 0) / heights.length : (viewMode === 'cards' ? 190 : 100);
      const available = window.innerHeight - Math.max(0, container.getBoundingClientRect().top) - 96;
      if (available <= 0 || itemHeight <= 0) return;
      if (viewMode === 'cards') {
        // Match the grid's MUI breakpoints (xs/sm/lg) so the computed page size
        // lines up with the actual number of columns.
        const columns = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 600 ? 2 : 1;
        const gap = 10;
        const rows = Math.max(1, Math.floor((available + gap) / (itemHeight + gap)));
        setPageSize(rows * columns);
      } else {
        setPageSize(Math.max(1, Math.floor(available / itemHeight)));
      }
    };
    measure();
    // Re-measure after the browser settles the toolbar/tab layout so the
    // container top is final before we decide how many rows fit.
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [appearance, filteredStages.length, viewMode]);
  const hasActiveFilters = Boolean(query || sourceFilter !== 'all' || statusFilter !== 'all');
  const clearFilters = () => {
    setSearch('');
    setSourceFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  const showConnect = !loading && (!providerStatus?.connected || providerStatus.needsReconnect);
  const createStageButton = <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => showViewAll ? navigate('/stages?create=1') : setStagePickerOpen(true)}>Create new stage</Button>;
  const connectButton = showConnect ? <Button size="small" variant="outlined" startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <GitHubIcon />} disabled={connecting} onClick={connectGitHub}>{connecting ? 'Connecting…' : MARKETPLACE_COPY.connectGitHub}</Button> : null;
  const actions = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
      {createStageButton}
      {showViewAll && <Button component="a" href="/stages?tab=mine" size="small" variant="outlined">View all</Button>}
    </Stack>
  );

  const renderStageCard = (stage: DashboardStage, index: number) => (
    <StageListCard
      key={stage.key}
      title={stage.title}
      description={stage.description}
      previewUrl={stage.previewUrl ? previewObjectUrls[stage.previewUrl] : undefined}
      status={stage.status ? <Chip size="small" label={stage.status} color={stage.statusColor} variant="outlined" /> : undefined}
      notice={stage.notice}
      fallbackIcon={stage.source === 'local' ? <StorageIcon fontSize="small" /> : <GitHubIcon fontSize="small" />}
      meta={<>{stage.source === 'local' ? 'Local' : 'GitHub'}{'\u00A0\u00A0'}{stage.detail}{'\u00A0\u00A0'}{formatStageRelativeTime(stage.updatedAt).toLowerCase()}</>}
      onOpen={() => navigate(stage.href)}
      surface={viewMode === 'cards' ? 'card' : 'row'}
      divided={viewMode !== 'cards' && index > 0}
      action={stage.source === 'local' ? (
        <Tooltip title="More actions">
          <span>
            <IconButton
              aria-label={`More actions for ${stage.title}`}
              aria-controls={stageMenu?.stage.key === stage.key ? 'local-stage-actions-menu' : undefined}
              aria-haspopup="menu"
              aria-expanded={stageMenu?.stage.key === stage.key ? 'true' : undefined}
              disabled={localStageBusy !== null}
              onClick={(event) => setStageMenu({ anchorEl: event.currentTarget, stage })}
              sx={{ width: 44, height: 44 }}
            >
              {localStageBusy === stage.localStage?.id ? <CircularProgress size={18} color="inherit" /> : <MoreVertIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      ) : undefined}
    />
  );

  const showFilters = stages.length > 0;
  const stageToolbar = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
      {showFilters && <TextField
        size="small"
        value={search}
        onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        placeholder="Search stages"
        inputProps={{ 'aria-label': 'Search stages' }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><IconSearch size={18} aria-hidden="true" /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" aria-label="Clear stage search" onClick={() => { setSearch(''); setPage(1); }}>
                <IconX size={17} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        sx={{ flex: 1, minWidth: 0 }}
      />}
      {showFilters && <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
        <InputLabel id="stages-source-filter-label">Source</InputLabel>
        <Select labelId="stages-source-filter-label" value={sourceFilter} label="Source" onChange={(event) => { setSourceFilter(event.target.value as typeof sourceFilter); setPage(1); }}>
          <MenuItem value="all">All sources</MenuItem>
          <MenuItem value="local">Local</MenuItem>
          <MenuItem value="github">GitHub</MenuItem>
        </Select>
      </FormControl>}
      {showFilters && <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
        <InputLabel id="stages-status-filter-label">Status</InputLabel>
        <Select labelId="stages-status-filter-label" value={statusFilter} label="Status" onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1); }}>
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="pending">Awaiting review</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </Select>
      </FormControl>}
      {appearance === 'page' && (
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ ml: { sm: 'auto' } }}>
          {createStageButton}
          {connectButton}
        </Stack>
      )}
      {showFilters && <ToggleButtonGroup
        exclusive
        size="small"
        value={viewMode}
        onChange={(_, nextView) => { if (!nextView) return; setViewMode(nextView); setPage(1); }}
        aria-label="Stage view mode"
        sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, ml: { xs: 0, sm: appearance === 'page' ? 0 : 'auto' } }}
      >
        <ToggleButton value="list" aria-label="List view" title="List view"><IconLayoutList size={18} /></ToggleButton>
        <ToggleButton value="cards" aria-label="Card view" title="Card view"><IconLayoutGrid size={18} /></ToggleButton>
      </ToggleButtonGroup>}
    </Stack>
  );

  const stageCollection = viewMode === 'cards' ? (
    <Box ref={collectionRef} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
      {visibleStages.map((stage, index) => renderStageCard(stage, index))}
    </Box>
  ) : (
    <Box ref={collectionRef} sx={appearance === 'page' ? { border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' } : undefined}>
      {visibleStages.map((stage, index) => renderStageCard(stage, index))}
    </Box>
  );

  const content = <>
    {error && <Alert severity={stages.length ? 'warning' : 'error'} sx={{ mb: stages.length ? 1.5 : 0 }}>{error}</Alert>}
    {loading && !stages.length ? <Stack spacing={1}>{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} variant="rounded" height={64} />)}</Stack>
      : <>
        {stageToolbar}
        {!stages.length ? <Box sx={{ py: 2 }}><Typography variant="subtitle2" fontWeight={600}>No saved stages yet</Typography><Typography variant="body2" color="text.secondary">Create your first stage here, or connect GitHub to access existing repositories.</Typography></Box>
          : filteredStages.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" fontWeight={600}>{hasActiveFilters ? 'No stages match your filters' : 'No saved stages yet'}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>Try another search or clear the filters.</Typography>
              <Button size="small" onClick={clearFilters} sx={{ mt: 1 }}>Clear filters</Button>
            </Box>
          ) : <>
            {stageCollection}
            {filteredStages.length > stagesPerPage && (
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 1.25, pt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Showing {pageStart + 1}–{Math.min(pageStart + stagesPerPage, filteredStages.length)} of {filteredStages.length}
                </Typography>
                <Pagination count={pageCount} page={page} onChange={(_, nextPage) => setPage(nextPage)} size="small" color="primary" siblingCount={0} aria-label="Stage pages" />
              </Stack>
            )}
          </>}
      </>}
    <Menu id="local-stage-actions-menu" anchorEl={stageMenu?.anchorEl || null} open={Boolean(stageMenu)} onClose={() => setStageMenu(null)}>
      {stageMenu?.stage.localStage && <MenuItem
        onClick={() => { setDetailsStage(stageMenu.stage); setStageMenu(null); }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
        Details
      </MenuItem>}
      {stageMenu?.stage.localStage && <MenuItem
        component="a"
        href={`${stageMenu.stage.href}&action=github-copy`}
        onClick={() => setStageMenu(null)}
      >
        <UploadIcon fontSize="small" sx={{ mr: 1 }} />
        Copy to GitHub…
      </MenuItem>}
      {stageMenu?.stage.localStage && (stageMenu.stage.localStage.publication?.active || stageMenu.stage.localStage.submission?.status === 'pending') && <MenuItem
        sx={{ color: 'error.main' }}
        onClick={() => {
          const localStage = stageMenu.stage.localStage;
          setStageMenu(null);
          if (localStage) void updateLocalPublication(localStage);
        }}
      >
        {stageMenu.stage.localStage.publication?.active ? <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> : <CloseIcon fontSize="small" sx={{ mr: 1 }} />}
        {stageMenu.stage.localStage.publication?.active ? 'Unpublish' : 'Cancel request'}
      </MenuItem>}
    </Menu>
    {detailsStage?.localStage && (
      <StageDetailsDialog
        open
        onClose={() => setDetailsStage(null)}
        title={detailsStage.title}
        description={detailsStage.description}
        previewUrl={detailsStage.localStage.previewUrl ? previewObjectUrls[detailsStage.localStage.previewUrl] : undefined}
        rows={localStageDetailRows(detailsStage.localStage)}
      />
    )}
    <CardDialog
      open={stagePickerOpen}
      onClose={closeStagePicker}
      onSelect={() => undefined}
      onSelectStage={openStageInBuilder}
      onCreateStage={() => navigate('/stage-builder')}
    />
  </>;

  if (appearance === 'page') {
    return content;
  }

  return <DashboardCard title={MARKETPLACE_COPY.myStages} subtitle="Stages saved locally or on GitHub." action={actions} compact>{content}</DashboardCard>;
}
