import React, { useMemo } from 'react';
import { Box, Button, Dialog, DialogActions, DialogTitle, Typography } from '@mui/material';
import { StageBuilderScene } from './StageBuilderScene';
import { configToEditorStage } from './serialize';
import type { LocalStageRecord } from './types';

const ignore = () => {};

export function SavedStagePreview({ record, assetBaseUrl, onBack, onEdit }: {
  record: LocalStageRecord;
  assetBaseUrl?: string | null;
  onBack: () => void;
  onEdit: () => void;
}) {
  const saved = useMemo(() => {
    const stage = configToEditorStage(record);
    return { ...stage, objects: stage.objects.map(object => ({ ...object, locked: true })) };
  }, [record]);
  return <Dialog open fullWidth maxWidth="lg" onClose={onBack} aria-labelledby="saved-stage-preview-title" aria-describedby="saved-stage-preview-description">
    <DialogTitle id="saved-stage-preview-title">Saved version of {record.title}</DialogTitle>
    <Typography id="saved-stage-preview-description" variant="body2" sx={{ px: 3, pb: 2 }}>
      Preview only. Your unfinished edits are still open behind this window.
    </Typography>
    <Box sx={{ height: '55vh', minHeight: 160, flexShrink: 1, position: 'relative' }}>
      <StageBuilderScene objects={saved.objects} groups={saved.metadata.groups} selectedId={null}
        transformMode="select" keyboardEnabled={false} stageDimensions={saved.floor.dimensions}
        floorColor={saved.floor.color} skybox={saved.metadata.skybox} gridVisible={false}
        stageAssetBaseUrl={assetBaseUrl} onSelect={ignore} onObjectChange={ignore} />
    </Box>
    <Typography variant="body2" sx={{ px: 3, pt: 2 }}>
      Using the saved version starts again from your last save. You can return to your unfinished edits before saving.
    </Typography>
    <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button onClick={onEdit}>Use saved version</Button>
      <Button variant="contained" onClick={onBack}>Continue my edits</Button>
    </DialogActions>
  </Dialog>;
}
