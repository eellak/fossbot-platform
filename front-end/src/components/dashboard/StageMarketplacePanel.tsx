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
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import { getMarketplaceIndex, type MarketplaceIndexResponse, type MarketplaceStageEntry, type MarketplaceValidationState } from 'src/stages/MarketplaceApi';

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
      <Stack spacing={1.25} sx={{ p: 2, flex: 1 }}>
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

function MarketplaceDetailDrawer({ entry, open, onClose }: { entry: MarketplaceStageEntry | null; open: boolean; onClose: () => void }) {
  const stageTestUrl = entry ? `/stage-test?repo=${encodeURIComponent(`${entry.repoOwner}/${entry.repoName}`)}&ref=${encodeURIComponent(entry.defaultBranch || 'main')}` : '#';
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
                <Button component="a" href={entry.repoUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<GitHubIcon />} endIcon={<OpenInNewIcon />}>
                  Source
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export default function StageMarketplacePanel() {
  const [index, setIndex] = useState<MarketplaceIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort] = useState<'updated' | 'published' | 'verified'>('updated');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MarketplaceStageEntry | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
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
  }, [activeTag, page, query, sort]);

  const stages = index?.stages || [];
  const pagination = index?.pagination;
  const tags = index?.tags || [];

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={850}>Stage library</Typography>
          <Typography variant="body2" color="text.secondary">
            Discover reviewed Git-hosted stages for FOSSBot simulations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
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

        {loading ? (
          <Stack sx={{ py: 6, alignItems: 'center' }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Loading marketplace index…</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : index?.warning ? (
          <Alert severity="info" sx={{ m: 2 }}>{index.warning}</Alert>
        ) : null}

        {!loading && !error && (
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
      <MarketplaceDetailDrawer entry={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
