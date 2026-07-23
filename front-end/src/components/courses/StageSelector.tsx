import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import type { StageReference } from 'src/courses/types';
import type { MarketplaceStageEntry } from 'src/stages/MarketplaceApi';
import type { ProviderStageListItem } from 'src/stages/StagesApi';
import { marketplaceFirstPageSnapshot, refreshStageLists, stageListUserKey, subscribeMarketplaceFirstPage, subscribeUserStages, userStagesSnapshot } from 'src/stages/stageListCache';
import { GitHubIdentity, StageCard } from 'src/stages/StageCard';

const builtIns: StageReference[] = [
  { sourceType: 'default', title: 'White field', url: '/js-simulator/stages/stage_white_rect.json' },
  { sourceType: 'default', title: 'Object field', url: '/js-simulator/stages/stage_object.json' },
  { sourceType: 'default', title: 'Maze', url: '/js-simulator/stages/stage_maze.json' },
  { sourceType: 'default', title: 'Numbers', url: '/js-simulator/stages/stage_numbers.json' },
  { sourceType: 'default', title: 'Eiffel', url: '/js-simulator/stages/stage_eiffel.json' },
  { sourceType: 'default', title: 'Animals', url: '/js-simulator/stages/stage_animals.json' },
];

interface StageSelectorProps {
  token: string;
  value?: StageReference | null;
  onChange: (value: StageReference | null) => void;
  labels: Record<string, string>;
}

function keyOf(reference?: StageReference | null): string {
  if (!reference) return 'none';
  if (reference.sourceType === 'default') return `default:${reference.url}`;
  return `${reference.sourceType}:${reference.repoOwner}/${reference.repoName}`;
}

function githubReference(stage: ProviderStageListItem): StageReference {
  return { sourceType: 'github', repoOwner: stage.repoOwner, repoName: stage.repoName, title: stage.title || stage.repoName, visibility: stage.visibility || (stage.private ? 'private' : 'public') };
}

function marketplaceReference(stage: MarketplaceStageEntry): StageReference {
  return { sourceType: 'marketplace', repoOwner: stage.repoOwner, repoName: stage.repoName, title: stage.title, visibility: 'public', commitSha: stage.commitSha };
}

export default function StageSelector({ token, value, onChange, labels }: StageSelectorProps) {
  const { user } = useAuth();
  const userKey = stageListUserKey(user);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'builtIn' | 'github' | 'marketplace'>('builtIn');
  const [query, setQuery] = useState('');
  const [github, setGithub] = useState<ProviderStageListItem[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceStageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncMarketplace = () => {
      const snapshot = marketplaceFirstPageSnapshot();
      setMarketplace(snapshot.data?.stages || []); setLoading(snapshot.refreshing); setError(snapshot.refreshError || '');
    };
    const syncGithub = () => {
      if (!userKey) return;
      const snapshot = userStagesSnapshot(userKey);
      setGithub(snapshot.data || []); setLoading((current) => current || snapshot.refreshing); setError((current) => snapshot.refreshError || current);
    };
    syncMarketplace(); syncGithub();
    const unsubMarketplace = subscribeMarketplaceFirstPage(syncMarketplace);
    const unsubGithub = userKey ? subscribeUserStages(userKey, syncGithub) : () => undefined;
    void refreshStageLists(userKey, token);
    return () => { unsubMarketplace(); unsubGithub(); };
  }, [token, userKey]);

  const references = useMemo(() => ({ builtIn: builtIns, github: github.map(githubReference), marketplace: marketplace.map(marketplaceReference) }), [github, marketplace]);
  const filtered = references[tab].filter((stage) => `${stage.title || ''} ${stage.repoOwner || ''} ${stage.repoName || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const choose = (stage: StageReference | null) => { onChange(stage); setOpen(false); };

  return <Stack spacing={1.25}>
    <Typography variant="subtitle2">{labels.label}</Typography>
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700} noWrap>{value?.title || labels.none}</Typography><Typography variant="caption" color="text.secondary">{value ? `${labels[value.sourceType === 'default' ? 'builtIn' : value.sourceType]} · ${value.visibility || (value.sourceType === 'default' ? labels.pinned : labels.pinOnSave)}` : labels.optional}</Typography></Box>
        <Button size="small" variant="outlined" onClick={() => setOpen(true)}>{labels.choose}</Button>
      </Stack>
    </Box>
    {value && <Chip size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} label={`${value.commitSha || value.sourceType === 'default' ? labels.pinned : labels.pinOnSave}`} />}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle>{labels.chooseTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
            <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} InputProps={{ startAdornment: <IconSearch size={17} /> }} />
            <Button size="small" startIcon={loading ? <CircularProgress size={14} /> : <IconRefresh size={16} />} disabled={loading} onClick={() => { setError(''); void refreshStageLists(userKey, token, { force: true }); }}>{labels.refresh}</Button>
          </Stack>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="scrollable"><Tab value="builtIn" label={labels.builtIn} /><Tab value="github" label={labels.github} /><Tab value="marketplace" label={labels.marketplace} /></Tabs>
          {error && <Alert severity="warning">{labels.unavailable}</Alert>}
          {loading && !filtered.length ? <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={24} /><Typography variant="body2" sx={{ mt: 1 }}>{labels.loading}</Typography></Box> : filtered.length ? <Grid container spacing={2}>{filtered.map((stage) => {
            const marketplaceEntry = stage.sourceType === 'marketplace' ? marketplace.find((entry) => keyOf(marketplaceReference(entry)) === keyOf(stage)) : null;
            return <Grid item xs={12} sm={6} md={4} key={keyOf(stage)}><Box sx={{ height: '100%', outline: keyOf(value) === keyOf(stage) ? '3px solid' : 'none', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 2 }}><StageCard title={stage.title || stage.repoName || labels.none} description={marketplaceEntry?.description || (stage.sourceType === 'default' ? labels.builtInHelp : undefined)} previewUrl={marketplaceEntry?.previewUrl} metadata={stage.repoOwner ? <GitHubIdentity username={stage.repoOwner} suffix={`/${stage.repoName}`} /> : <Typography variant="caption" color="text.secondary">{labels.builtIn}</Typography>} badges={<Stack direction="row" gap={0.75}><Chip size="small" label={stage.visibility || (stage.sourceType === 'default' ? labels.pinned : 'public')} /><Chip size="small" variant="outlined" label={stage.commitSha || stage.sourceType === 'default' ? labels.pinned : labels.pinOnSave} /></Stack>} actionLabel={keyOf(value) === keyOf(stage) ? labels.selected : labels.select} onAction={() => choose(stage)} /></Box></Grid>;
          })}</Grid> : <Alert severity="info">{labels.noResults}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button color="inherit" onClick={() => choose(null)}>{labels.clear}</Button><Button onClick={() => setOpen(false)}>{labels.close}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
