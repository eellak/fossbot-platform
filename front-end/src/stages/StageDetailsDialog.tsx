import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { LocalStage } from './LocalStagesApi';

export type StageDetailRow = [label: string, value: string];

type StageDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | null;
  previewUrl?: string | null;
  rows: StageDetailRow[];
};

export function StageDetailsDialog({ open, onClose, title, description, previewUrl, rows }: StageDetailsDialogProps) {
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
          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 2, rowGap: 1 }}>
            {rows.map(([label, value]) => (
              <React.Fragment key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
              </React.Fragment>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const detailsCache = new Map<string, StageDetailRow[]>();

/**
 * Shapes the local-stage payload the list already returned into details rows.
 * Cached by `id:revision` so reopening a stage is instant and a save that bumps
 * the revision recomputes.
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
