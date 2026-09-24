import React, { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import CardDialog, { type StageSelection } from 'src/components/stage-select-popup/CardDialog';
import type { StageReference } from 'src/courses/types';

interface StageSelectorProps {
  value?: StageReference | null;
  onChange: (value: StageReference | null) => void;
  labels: Record<string, string>;
}

/**
 * Course-authoring stage summary. The picker itself is the shared
 * `CardDialog` used by the simulator and the Python/Blockly editors, so choosing
 * a stage reads the same everywhere. Local stages are embedded into the release
 * at publish time, so they are available here too.
 */
function toStageReference(selection: StageSelection): StageReference {
  return {
    sourceType: selection.sourceType,
    localStageId: selection.localStageId ?? null,
    repoOwner: selection.repoOwner ?? null,
    repoName: selection.repoName ?? null,
    visibility: selection.sourceType === 'local' ? null : selection.visibility ?? null,
    marketplaceEntryPath: selection.marketplaceEntryPath ?? null,
    title: selection.title,
    url: selection.url ?? null,
    commitSha: selection.commitSha ?? null,
  };
}

export default function StageSelector({ value, onChange, labels }: StageSelectorProps) {
  const [open, setOpen] = useState(false);
  const sourceLabel = value ? labels[value.sourceType === 'default' ? 'builtIn' : value.sourceType] : labels.none;
  const pinLabel = value ? (value.commitSha || value.sourceType === 'default' ? labels.pinned : labels.pinOnSave) : labels.optional;

  return <Stack spacing={1.25}>
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
        <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{value?.title || labels.none}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{value ? `${sourceLabel} · ${value.visibility || pinLabel}` : labels.optional}</Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={() => setOpen(true)} sx={{ minHeight: 44 }}>{labels.choose}</Button>
      </Stack>
    </Box>
    <CardDialog
      open={open}
      onClose={() => setOpen(false)}
      onSelect={() => undefined}
      onSelectStage={(selection) => onChange(toStageReference(selection))}
    />
  </Stack>;
}
