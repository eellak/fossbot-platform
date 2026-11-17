import React, { useMemo } from 'react';
import { Box, Button, Dialog, Stack, Typography } from '@mui/material';
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
  return <Dialog open fullScreen onClose={onBack} aria-labelledby="saved-stage-preview-title">
    <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ p: 1, gap: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography id="saved-stage-preview-title" sx={{ flex: 1 }}>Viewing saved version · read-only</Typography>
      <Button variant="contained" onClick={onBack}>Back to my edits</Button>
      <Button onClick={onEdit}>Edit this version</Button>
    </Stack>
    <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <StageBuilderScene objects={saved.objects} groups={saved.metadata.groups} selectedId={null}
        transformMode="select" keyboardEnabled={false} stageDimensions={saved.floor.dimensions}
        floorColor={saved.floor.color} skybox={saved.metadata.skybox} gridVisible={false}
        stageAssetBaseUrl={assetBaseUrl} onSelect={ignore} onObjectChange={ignore} />
    </Box>
  </Dialog>;
}
