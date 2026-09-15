import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, Drawer, FormControlLabel, IconButton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageContainer from 'src/components/container/PageContainer';
import StageMarketplacePanel from 'src/components/dashboard/StageMarketplacePanel';
import UserStagesDashboardPanel from 'src/components/dashboard/UserStagesDashboardPanel';
import { useAuth } from 'src/authentication/AuthProvider';
import { getModerationOverrides, getModerationReports, getMarketplacePermissions, getVerificationQueue, restoreMarketplaceStage, setModerationOverride, submitMarketplaceVerification, type MarketplaceModerationOverride, type MarketplaceReport, type MarketplaceVerificationQueueItem, type MarketplaceVerificationChecklist } from 'src/stages/MarketplaceApi';
import { getLocalPublicationReviewQueue, reviewLocalPublication, type LocalPublicationReviewItem } from 'src/stages/LocalStagesApi';
import { pageTabsSx, TabbedPageHeader } from 'src/components/shared/PageHeader';
import BetaBadge from 'src/components/shared/BetaBadge';
import { useSearchParams } from 'react-router-dom';
import { MARKETPLACE_COPY, marketplaceReportCategoryLabel } from 'src/stages/marketplaceCopy';
import { invalidateMarketplaceFirstPage, refreshMarketplaceFirstPage, refreshStageLists, stageListUserKey } from 'src/stages/stageListCache';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { useFeatureFlags } from 'src/config/FeatureFlags';

function LocalPublicationQueue() {
  const confirmDialog = useConfirmDialog();
  const { token } = useAuth();
  const [requests, setRequests] = useState<LocalPublicationReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setRequests((await getLocalPublicationReviewQueue(token)).requests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load local publication requests.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [token]);
  const review = async (item: LocalPublicationReviewItem, approved: boolean) => {
    if (!token) return;
    const reason = await confirmDialog.prompt({
      title: approved ? 'Approve publication request' : 'Reject publication request',
      message: approved
        ? `Approve “${item.title}” for the Stage library? A note is optional.`
        : `Reject “${item.title}”? A reason is required so the author can fix it.`,
      inputLabel: approved ? 'Approval note (optional)' : 'Reason for rejection',
      inputRequired: !approved,
      inputRequiredMessage: 'Add a reason when rejecting a publication request.',
      confirmLabel: approved ? 'Approve' : 'Reject',
      danger: !approved,
    });
    if (reason === null) return;
    try {
      setBusy(item.id);
      setError('');
      await reviewLocalPublication(token, item.id, approved, reason.trim() || undefined);
      if (approved) {
        invalidateMarketplaceFirstPage();
        await refreshMarketplaceFirstPage(token, { force: true });
      }
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review this publication request.');
    } finally {
      setBusy(null);
    }
  };
  return <Stack spacing={2}>
    <Box><Typography variant="h6">Local publication queue</Typography><Typography variant="body2" color="text.secondary">Every local release must be approved before it appears in the Stage library.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><Typography variant="body2">Loading publication requests…</Typography></Stack> : requests.length === 0 ? <Alert severity="info">No local publication requests are waiting for review.</Alert> : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>{requests.map((item, index) => <Box key={item.id} sx={{ p: 2, borderTop: index ? '1px solid' : 'none', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}><Box><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={700}>{item.title}</Typography><Chip size="small" color="warning" label="Pending" /></Stack><Typography variant="body2" color="text.secondary">Local r{item.stageRevision} · {(item.recordBytes / 1024).toFixed(1)} KiB · @{item.requestedBy || 'publisher'}</Typography><Typography variant="body2">{item.description || 'No description provided.'}</Typography></Box><Stack direction="row" spacing={1}><Button size="small" color="error" disabled={busy === item.id} onClick={() => void review(item, false)}>Reject</Button><Button size="small" variant="contained" disabled={busy === item.id} onClick={() => void review(item, true)}>{busy === item.id ? 'Reviewing…' : 'Approve'}</Button></Stack></Box>)}</Box>}
  </Stack>;
}

const emptyChecklist: MarketplaceVerificationChecklist = {
  stageRuns: false,
  metadataAccurate: false,
  attributionAcceptable: false,
  contentAppropriate: false,
  categoriesAppropriate: false,
};

function VerificationQueue() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<MarketplaceVerificationQueueItem[]>([]);
  const [checks, setChecks] = useState<Record<string, MarketplaceVerificationChecklist>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewError, setReviewError] = useState('');
  const [reviewing, setReviewing] = useState<MarketplaceVerificationQueueItem | null>(null);
  const [details, setDetails] = useState<MarketplaceVerificationQueueItem | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const data = await getVerificationQueue(token);
      setRequests(data.requests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load stages awaiting verification.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [token]);
  const keyFor = (item: MarketplaceVerificationQueueItem) => `${item.entry.repoOwner}/${item.entry.repoName}`;
  const submit = async (item: MarketplaceVerificationQueueItem) => {
    if (!token) return;
    const key = keyFor(item);
    const checklist = checks[key] || emptyChecklist;
    try {
      setReviewBusy(true);
      setError('');
      setReviewError('');
      await submitMarketplaceVerification(token, item.entry.repoOwner, item.entry.repoName, { ...checklist, requestId: item.id, verified: true, notes: notes[key] });
      setReviewing(null);
      await load();
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : 'Could not submit verification.');
    } finally {
      setReviewBusy(false);
    }
  };
  const checklistLabel: Record<keyof MarketplaceVerificationChecklist, string> = {
    stageRuns: 'The stage runs from the pinned revision',
    metadataAccurate: 'Title, description, preview, and tags are accurate',
    attributionAcceptable: 'Attribution and licensing are acceptable',
    contentAppropriate: 'Content is safe, non-spam, and appropriate',
    categoriesAppropriate: 'Audience and categories are appropriate',
  };
  return <Stack spacing={2}>
    <Box><Typography variant="h6">Verification queue</Typography><Typography variant="body2" color="text.secondary">Publisher-requested reviews only. Review opens in a focused panel; submitted verification PRs remain visible here.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}><CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Loading verification queue…</Typography></Stack> : requests.length === 0 ? <Alert severity="info">No publisher verification requests are waiting for review.</Alert> : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>{requests.map((item, index) => {
      const key = keyFor(item);
      const pending = item.status === 'requested';
      return <Box key={item.id} sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto auto' }, gap: 2, alignItems: 'center', borderTop: index ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Box minWidth={0}><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={700}>{item.entry.title}</Typography><Chip size="small" color={pending ? 'warning' : 'info'} label={pending ? 'Awaiting review' : 'Verification PR open'} /></Stack><Typography variant="body2" color="text.secondary" noWrap>{key} · {item.entry.commitSha.slice(0, 10)} · requested by @{item.requestedBy || 'publisher'}</Typography></Box>
        <Typography variant="caption" color="text.secondary">{new Date(item.requestedAt).toLocaleDateString()}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap"><Button size="small" variant="outlined" onClick={() => setDetails(item)}>Details</Button>{pending ? <Button size="small" variant="contained" onClick={() => { setReviewError(''); setReviewing(item); }}>Review</Button> : item.pullRequest?.url && <Button size="small" component="a" href={item.pullRequest.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />}>View PR</Button>}</Stack>
      </Box>;
    })}</Box>}
    <Drawer anchor="right" open={!!details} onClose={() => setDetails(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>{details && <Stack spacing={2} sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h6">{details.entry.title}</Typography><Typography variant="body2" color="text.secondary">{details.entry.repoOwner}/{details.entry.repoName}</Typography></Box><IconButton onClick={() => setDetails(null)} aria-label="Close stage details"><CloseIcon /></IconButton></Stack><Typography variant="body2">{details.entry.description || 'No description provided.'}</Typography><Stack direction="row" gap={1} flexWrap="wrap">{details.entry.badges.verified && <Chip label="Verified" size="small" color="primary" />}{details.entry.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)}</Stack><Stack direction="row" spacing={1}><Button component="a" href={`/stage-test?repo=${encodeURIComponent(`${details.entry.repoOwner}/${details.entry.repoName}`)}&ref=${encodeURIComponent(details.entry.commitSha)}`} target="_blank" rel="noreferrer" variant="contained">Test stage</Button><Button component="a" href={details.entry.repoUrl} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewIcon />}>View source</Button></Stack></Stack>}</Drawer>
    <Drawer anchor="right" open={!!reviewing} onClose={reviewBusy ? undefined : () => setReviewing(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>{reviewing && (() => { const key = keyFor(reviewing); const checklist = checks[key] || emptyChecklist; const ready = Object.values(checklist).every(Boolean); return <Stack spacing={2} sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h6">Verify {reviewing.entry.title}</Typography><Typography variant="body2" color="text.secondary">{reviewing.entry.repoOwner}/{reviewing.entry.repoName}</Typography></Box><IconButton disabled={reviewBusy} onClick={() => setReviewing(null)} aria-label="Close verification review"><CloseIcon /></IconButton></Stack>{reviewError && <Alert severity="error">{reviewError}</Alert>}<Stack spacing={0}><Typography variant="subtitle2">Reviewer checklist</Typography>{(Object.keys(checklistLabel) as (keyof MarketplaceVerificationChecklist)[]).map((item) => <FormControlLabel key={item} disabled={reviewBusy} control={<Checkbox checked={checklist[item]} onChange={(event) => setChecks((current) => ({ ...current, [key]: { ...checklist, [item]: event.target.checked } }))} />} label={<Typography variant="body2">{checklistLabel[item]}</Typography>} />)}</Stack><TextField disabled={reviewBusy} label="Reviewer notes (optional)" value={notes[key] || ''} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} multiline minRows={3} fullWidth /><Button variant="contained" disabled={!ready || reviewBusy} onClick={() => submit(reviewing)}>{reviewBusy ? 'Submitting…' : 'Propose Verified badge'}</Button></Stack>; })()}</Drawer>
  </Stack>;
}

type ModerationAction =
  | { kind: 'hide' | 'remove'; report: MarketplaceReport }
  | { kind: 'restore'; override: MarketplaceModerationOverride };

function ModerationWorkspace({ canModerate, canVerify }: { canModerate: boolean; canVerify: boolean }) {
  const { token } = useAuth();
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [overrides, setOverrides] = useState<MarketplaceModerationOverride[]>([]);
  const confirmDialog = useConfirmDialog();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(canModerate);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  const load = async () => {
    if (!token || !canModerate) return;
    try {
      setLoading(true);
      setError('');
      const [reportData, overrideData] = await Promise.all([getModerationReports(token), getModerationOverrides(token)]);
      setReports(reportData.reports);
      setOverrides(overrideData.overrides);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load moderation work.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [token, canModerate]);
  const runAction = async (action: ModerationAction) => {
    if (!token) return;
    const target = action.kind === 'restore' ? `${action.override.repoOwner}/${action.override.repoName}` : `${action.report.repoOwner}/${action.report.repoName}`;
    const confirmed = await confirmDialog.confirm({
      title: action.kind === 'restore' ? 'Restore stage?' : action.kind === 'hide' ? 'Hide stage locally?' : 'Remove stage locally?',
      message: `${target}\n\n${action.kind === 'restore' ? 'The stage will become visible and, if published, directly accessible on this FOSSBot instance again.' : action.kind === 'hide' ? 'The stage will leave discovery on this instance, but existing pinned references will keep working.' : 'The stage will be quarantined: discovery, direct access, copying, and republishing are blocked until a moderator restores it.'}`,
      confirmLabel: action.kind === 'restore' ? 'Restore' : action.kind === 'hide' ? 'Hide locally' : 'Remove locally',
      cancelLabel: 'Cancel',
      danger: action.kind !== 'restore',
    });
    if (!confirmed) return;
    setBusyTarget(target);
    setError('');
    try {
      if (action.kind === 'restore') {
        await restoreMarketplaceStage(token, action.override.repoOwner, action.override.repoName, { reason: 'Restored after moderator review.', sourceType: action.override.sourceType, localPublicationId: action.override.localPublicationId });
      } else {
        const state = action.kind === 'hide' ? 'hidden' : 'removed';
        await setModerationOverride(token, action.report.repoOwner, action.report.repoName, { state, reason: `Report #${action.report.id}: ${action.report.category}`, sourceType: action.report.sourceType, localPublicationId: action.report.localPublicationId, reportId: action.report.id });
      }
      invalidateMarketplaceFirstPage();
      await Promise.all([load(), refreshMarketplaceFirstPage(token, { force: true })]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this stage.');
    } finally {
      setBusyTarget(null);
    }
  };
  const activeOverrides = overrides.filter((override) => override.active);
  return <Stack spacing={3}>
    {(canVerify || canModerate) && <><LocalPublicationQueue /><Divider /></>}
    {canVerify && <><VerificationQueue /><Divider /></>}
    {canModerate && <>
    {error && <Alert severity="error">{error}</Alert>}
    <Box>
      <Typography variant="h6">Report queue</Typography>
      <Typography variant="body2" color="text.secondary">Reports are private to this FOSSBot instance.</Typography>
    </Box>
    {loading ? <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}><CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Loading moderation queue…</Typography></Stack> : reports.length === 0 ? <Alert severity="info">No reports need review.</Alert> : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>{reports.map((report, index) => <Box key={report.id} sx={{ p: 2, borderTop: index ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap"><Typography fontWeight={700}>{report.repoOwner}/{report.repoName}</Typography><Chip size="small" label={marketplaceReportCategoryLabel(report.category)} /></Stack>
        <Typography variant="body2">{report.explanation}</Typography>
        <Stack direction="row" spacing={1}><Button size="small" disabled={busyTarget === `${report.repoOwner}/${report.repoName}`} onClick={() => void runAction({ kind: 'hide', report })}>Hide locally</Button><Button size="small" color="error" disabled={busyTarget === `${report.repoOwner}/${report.repoName}`} onClick={() => void runAction({ kind: 'remove', report })}>Remove locally</Button></Stack>
      </Stack>
    </Box>)}</Box>}
    <Typography variant="h6">Local overrides</Typography>
    {!loading && (activeOverrides.length === 0 ? <Alert severity="info">No local moderation overrides.</Alert> : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>{activeOverrides.map((override, index) => <Box key={`${override.sourceType}:${override.localPublicationId || `${override.repoOwner}/${override.repoName}`}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 2, borderTop: index ? '1px solid' : 'none', borderColor: 'divider' }}><Box><Typography fontWeight={700}>{override.repoOwner}/{override.repoName}</Typography><Typography variant="body2" color="text.secondary">{override.sourceType} · {override.state} · {override.reason}</Typography></Box><Button size="small" disabled={busyTarget === `${override.repoOwner}/${override.repoName}`} onClick={() => void runAction({ kind: 'restore', override })}>Restore</Button></Box>)}</Box>)}
    </>}
  </Stack>;
}

export default function StagesPage() {
  const { token, user } = useAuth();
  const { marketplace } = useFeatureFlags();
  const [searchParams, setSearchParams] = useSearchParams();
  const userKey = stageListUserKey(user);
  const requestedTab = searchParams.get('tab');
  const [canModerate, setCanModerate] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tab = marketplace && (requestedTab === 'explore' || (requestedTab === 'moderation' && (canModerate || canVerify))) ? requestedTab : 'mine';
  useEffect(() => {
    if (!marketplace || !token) {
      setCanModerate(false);
      setCanVerify(false);
      return;
    }
    void getMarketplacePermissions(token).then((permissions) => { setCanModerate(permissions.roles.includes('moderator')); setCanVerify(permissions.roles.includes('verifier')); }).catch(() => { setCanModerate(false); setCanVerify(false); });
  }, [marketplace, token]);
  const refreshStages = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await refreshStageLists(userKey, token, { force: true });
    } finally {
      setRefreshing(false);
    }
  };
  return <PageContainer title="Stages" description="Discover, publish, and manage FOSSBot stages.">
    <Stack spacing={3}>
      <TabbedPageHeader
        title="Stages"
        description="Discover public stages or manage stages stored here. GitHub is optional."
        titleAdornment={<BetaBadge feature="stages" />}
        action={marketplace && tab === 'explore' ? <Button variant="contained" onClick={() => void refreshStages()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh stages'}</Button> : undefined}
        tabs={<Tabs value={tab} onChange={(_, value) => { const next = new URLSearchParams(searchParams); next.set('tab', value); next.delete('stage'); setSearchParams(next); }} aria-label="Stages sections" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={pageTabsSx}><Tab value="mine" label={MARKETPLACE_COPY.myStages} />{marketplace && <Tab value="explore" label="Explore" />}{marketplace && (canModerate || canVerify) && <Tab value="moderation" label="Moderation" />}</Tabs>}
      />
      {marketplace && tab === 'explore' && <StageMarketplacePanel appearance="page" />}
      {tab === 'mine' && <UserStagesDashboardPanel showViewAll={false} appearance="page" />}
      {marketplace && tab === 'moderation' && (canModerate || canVerify) && <ModerationWorkspace canModerate={canModerate} canVerify={canVerify} />}
    </Stack>
  </PageContainer>;
}
