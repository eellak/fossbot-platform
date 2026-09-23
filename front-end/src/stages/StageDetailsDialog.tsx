import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Typography } from '@mui/material';
import { loadLocalStage, type LocalStage, type LocalStageSummary } from './LocalStagesApi';

export type StageDetailRow = [label: string, value: string];

type StageDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | null;
  previewUrl?: string | null;
  rows: StageDetailRow[];
  loading?: boolean;
  error?: string;
};

export function StageDetailsDialog({ open, onClose, title, description, previewUrl, rows, loading, error }: StageDetailsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Stage details</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {previewUrl && <Box component="img" src={previewUrl} alt="" sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />}
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{description || 'No description'}</Typography>
          </Box>
          {loading && <Skeleton variant="rounded" height={160} />}
          {error && <Alert severity="warning">{error}</Alert>}
          {!loading && !error && <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 2, rowGap: 1 }}>
            {rows.map(([label, value]) => (
              <React.Fragment key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
              </React.Fragment>
            ))}
          </Box>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function LocalStageDetailsDialog({ stage, token, onClose, previewUrl }: {
  stage: LocalStageSummary;
  token: string;
  onClose: () => void;
  previewUrl?: string | null;
}) {
  const [loaded, setLoaded] = useState<LocalStage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError('');
    loadLocalStage(token, stage.id)
      .then((result) => { if (active) setLoaded(result); })
      .catch(() => { if (active) setError('Could not load stage details. Close and try again.'); });
    return () => { active = false; };
  }, [token, stage.id, stage.revision]);
  return <StageDetailsDialog
    open
    onClose={onClose}
    title={stage.title}
    description={stage.description}
    previewUrl={previewUrl}
    rows={loaded ? localStageDetailRows(loaded) : []}
    loading={!loaded && !error}
    error={error}
  />;
}

const detailsCache = new Map<string, StageDetailRow[]>();

/**
 * Shapes a full local-stage record fetched on demand into details rows.
 * Cached by `id:revision` so a save that bumps the revision recomputes the rows.
 */
export function localStageDetailRows(stage: LocalStage): StageDetailRow[] {
  const key = `${stage.id}:${stage.revision}`;
  const cached = detailsCache.get(key);
  if (cached) return cached;
  const config = (stage.record?.config || []) as Array<{ type?: string; dimensions?: number[] }>;
  const dimensions = config.find((entry) => entry?.type === 'floor')?.dimensions;
  const objectCount = config.filter((entry) => entry?.type !== 'floor' && entry?.type !== 'skybox').length;
  const provenance = stage.provenance as { sourceType?: string; repoOwner?: string; repoName?: string } | null | undefined;
  const provenanceLabel = provenance?.sourceType
    ? [provenance.sourceType, provenance.repoOwner && provenance.repoName ? `${provenance.repoOwner}/${provenance.repoName}` : undefined].filter(Boolean).join(' · ')
    : 'Created in Stage Builder';
  const publication = stage.submission?.status === 'pending'
    ? `Awaiting review · v${stage.submission.stageRevision}`
    : stage.submission?.status === 'rejected'
      ? `Rejected · v${stage.submission.stageRevision}`
      : stage.publication?.active
        ? stage.publication.stageRevision === stage.revision
          ? `Published · v${stage.revision}`
          : `Published · v${stage.publication.stageRevision} (current v${stage.revision})`
        : 'Not published';
  const rows: StageDetailRow[] = [
    ['Revision', `v${stage.revision}`],
    ['Slug', stage.slug],
    ['Objects', String(objectCount)],
    ['Floor', dimensions && dimensions.length >= 2 ? `${dimensions[0]} × ${dimensions[1]}` : '—'],
    ['Size', `${(stage.recordBytes / 1024).toFixed(1)} KiB`],
    ['Checksum', stage.checksum ? stage.checksum.slice(0, 12) : '—'],
    ['Visibility', stage.visibility],
    ['Publication', publication],
    ['Source', provenanceLabel],
    ['Created', new Date(stage.createdAt).toLocaleString()],
    ['Updated', new Date(stage.updatedAt).toLocaleString()],
  ];
  detailsCache.set(key, rows);
  return rows;
}

export default StageDetailsDialog;
