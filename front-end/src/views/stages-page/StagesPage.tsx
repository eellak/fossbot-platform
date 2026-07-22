import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, Drawer, FormControlLabel, IconButton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageContainer from 'src/components/container/PageContainer';
import StageMarketplacePanel from 'src/components/dashboard/StageMarketplacePanel';
import PublishedMarketplaceStagesPanel from 'src/components/dashboard/PublishedMarketplaceStagesPanel';
import UserGitHubStagesPanel from 'src/components/dashboard/UserGitHubStagesPanel';
import { useAuth } from 'src/authentication/AuthProvider';
import { getModerationOverrides, getModerationReports, getMarketplacePermissions, getVerificationQueue, restoreMarketplaceStage, setModerationOverride, submitMarketplaceVerification, type MarketplaceModerationOverride, type MarketplaceReport, type MarketplaceVerificationQueueItem, type MarketplaceVerificationChecklist } from 'src/stages/MarketplaceApi';

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
      setError('');
      setReviewError('');
      await submitMarketplaceVerification(token, item.entry.repoOwner, item.entry.repoName, { ...checklist, requestId: item.id, verified: true, notes: notes[key] });
      setReviewing(null);
      await load();
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : 'Could not submit verification.');
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
    {loading ? <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}><CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Loading verification queue…</Typography></Stack> : requests.length === 0 ? <Alert severity="info">No publisher verification requests are waiting for review.</Alert> : <Box sx={{ maxWidth: 1120, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>{requests.map((item, index) => {
      const key = keyFor(item);
      const pending = item.status === 'requested';
      return <Box key={item.id} sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto auto' }, gap: 2, alignItems: 'center', borderTop: index ? '1px solid' : 'none', borderColor: 'divider' }}>
        <Box minWidth={0}><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={700}>{item.entry.title}</Typography><Chip size="small" color={pending ? 'warning' : 'info'} label={pending ? 'Awaiting review' : 'Verification PR open'} /></Stack><Typography variant="body2" color="text.secondary" noWrap>{key} · {item.entry.commitSha.slice(0, 10)} · requested by @{item.requestedBy || 'publisher'}</Typography></Box>
        <Typography variant="caption" color="text.secondary">{new Date(item.requestedAt).toLocaleDateString()}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap"><Button size="small" variant="outlined" onClick={() => setDetails(item)}>Details</Button>{pending ? <Button size="small" variant="contained" onClick={() => { setReviewError(''); setReviewing(item); }}>Review</Button> : item.pullRequest?.url && <Button size="small" component="a" href={item.pullRequest.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />}>View PR</Button>}</Stack>
      </Box>;
    })}</Box>}
    <Drawer anchor="right" open={!!details} onClose={() => setDetails(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>{details && <Stack spacing={2} sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h6">{details.entry.title}</Typography><Typography variant="body2" color="text.secondary">{details.entry.repoOwner}/{details.entry.repoName}</Typography></Box><IconButton onClick={() => setDetails(null)} aria-label="Close stage details"><CloseIcon /></IconButton></Stack><Typography variant="body2">{details.entry.description || 'No description provided.'}</Typography><Stack direction="row" gap={1} flexWrap="wrap">{details.entry.badges.verified && <Chip label="Verified" size="small" color="primary" />}{details.entry.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)}</Stack><Stack direction="row" spacing={1}><Button component="a" href={`/stage-test?repo=${encodeURIComponent(`${details.entry.repoOwner}/${details.entry.repoName}`)}&ref=${encodeURIComponent(details.entry.commitSha)}`} target="_blank" rel="noreferrer" variant="contained">Test stage</Button><Button component="a" href={details.entry.repoUrl} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewIcon />}>View source</Button></Stack></Stack>}</Drawer>
    <Drawer anchor="right" open={!!reviewing} onClose={() => setReviewing(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>{reviewing && (() => { const key = keyFor(reviewing); const checklist = checks[key] || emptyChecklist; const ready = Object.values(checklist).every(Boolean); return <Stack spacing={2} sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h6">Verify {reviewing.entry.title}</Typography><Typography variant="body2" color="text.secondary">{reviewing.entry.repoOwner}/{reviewing.entry.repoName}</Typography></Box><IconButton onClick={() => setReviewing(null)} aria-label="Close verification review"><CloseIcon /></IconButton></Stack>{reviewError && <Alert severity="error">{reviewError}</Alert>}<Stack spacing={0}><Typography variant="subtitle2">Reviewer checklist</Typography>{(Object.keys(checklistLabel) as (keyof MarketplaceVerificationChecklist)[]).map((item) => <FormControlLabel key={item} control={<Checkbox checked={checklist[item]} onChange={(event) => setChecks((current) => ({ ...current, [key]: { ...checklist, [item]: event.target.checked } }))} />} label={<Typography variant="body2">{checklistLabel[item]}</Typography>} />)}</Stack><TextField label="Reviewer notes (optional)" value={notes[key] || ''} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} multiline minRows={3} fullWidth /><Button variant="contained" disabled={!ready} onClick={() => submit(reviewing)}>Propose Verified badge</Button></Stack>; })()}</Drawer>
  </Stack>;
}

function ModerationWorkspace({ canModerate, canVerify }: { canModerate: boolean; canVerify: boolean }) {
  const { token } = useAuth();
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [overrides, setOverrides] = useState<MarketplaceModerationOverride[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(canModerate);

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
  const decide = async (report: MarketplaceReport, state: 'hidden' | 'removed') => {
    if (!token) return;
    await setModerationOverride(token, report.repoOwner, report.repoName, { state, reason: `Report #${report.id}: ${report.category}`, reportId: report.id });
    await load();
  };
  const restore = async (override: MarketplaceModerationOverride) => {
    if (!token) return;
    await restoreMarketplaceStage(token, override.repoOwner, override.repoName, { reason: 'Restored after moderator review.' });
    await load();
  };
  return <Stack spacing={3}>
    {canVerify && <><VerificationQueue /><Divider /></>}
    {canModerate && <>
    {error && <Alert severity="error">{error}</Alert>}
    <Box>
      <Typography variant="h6">Report queue</Typography>
      <Typography variant="body2" color="text.secondary">Reports are private to this FOSSBot instance.</Typography>
    </Box>
    {loading ? <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}><CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Loading moderation queue…</Typography></Stack> : reports.length === 0 ? <Alert severity="info">No reports need review.</Alert> : reports.map((report) => <Box key={report.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap"><Typography fontWeight={700}>{report.repoOwner}/{report.repoName}</Typography><Chip size="small" label={report.category.replace('_', ' ')} /></Stack>
        <Typography variant="body2">{report.explanation}</Typography>
        <Stack direction="row" spacing={1}><Button size="small" onClick={() => decide(report, 'hidden')}>Hide locally</Button><Button size="small" color="error" onClick={() => decide(report, 'removed')}>Remove locally</Button></Stack>
      </Stack>
    </Box>)}
    <Divider />
    <Typography variant="h6">Local overrides</Typography>
    {!loading && overrides.filter((override) => override.active).map((override) => <Box key={`${override.repoOwner}/${override.repoName}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><Box><Typography fontWeight={700}>{override.repoOwner}/{override.repoName}</Typography><Typography variant="body2" color="text.secondary">{override.state} · {override.reason}</Typography></Box><Button size="small" onClick={() => restore(override)}>Restore</Button></Box>)}
    </>}
  </Stack>;
}

export default function StagesPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('mine');
  const [canModerate, setCanModerate] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  useEffect(() => { if (token) void getMarketplacePermissions(token).then((permissions) => { setCanModerate(permissions.roles.includes('moderator')); setCanVerify(permissions.roles.includes('verifier')); }).catch(() => { setCanModerate(false); setCanVerify(false); }); }, [token]);
  return <PageContainer title="Stages" description="Discover, publish, and manage FOSSBot stages.">
    <Stack spacing={2}><Box><Typography variant="h4">Stages</Typography><Typography variant="body2" color="text.secondary">Discover public stages or manage your GitHub-backed work.</Typography></Box>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Stages sections"><Tab value="mine" label="My stages" /><Tab value="explore" label="Explore" />{(canModerate || canVerify) && <Tab value="moderation" label="Moderation" />}</Tabs>
      <Box sx={{ pt: 1 }}>
      {tab === 'explore' && <StageMarketplacePanel embedded />}
      {tab === 'mine' && <Stack spacing={3}><Alert severity="info">Publishing creates a review request. Public stages need clear attribution, a useful preview, description, and tags. Validation checks the pinned revision; verification is a separate human review.</Alert><UserGitHubStagesPanel embedded /><PublishedMarketplaceStagesPanel embedded /></Stack>}
      {tab === 'moderation' && (canModerate || canVerify) && <ModerationWorkspace canModerate={canModerate} canVerify={canVerify} />}
      </Box>
    </Stack>
  </PageContainer>;
}
