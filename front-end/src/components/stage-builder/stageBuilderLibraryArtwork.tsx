import React from 'react';
import Box from '@mui/material/Box';
import type { StageSemanticKind } from './types';

const artwork: Partial<Record<StageSemanticKind, string>> = {
  robotSpawn: 'robot_spawn',
  line: 'line_path',
  directionArrow: 'direction_arrow',
  target: 'target',
  checkpoint: 'checkpoint',
  collectible: 'collectible',
  targetZone: 'target_zone',
  dangerZone: 'no_go_zone',
  sensorZone: 'sensor_zone',
  label: 'text_label',
  light: 'light',
  camera: 'camera',
  audio: 'audio',
};

export function hasSemanticArtwork(kind?: StageSemanticKind): boolean {
  return !!(kind && artwork[kind]);
}

export function StageSemanticArtwork({ kind, width, height }: { kind: StageSemanticKind; width: number; height: number }) {
  const mask = `url("${process.env.PUBLIC_URL || ''}/stage-builder/icons/classic/${artwork[kind]}.svg") center / contain no-repeat`;
  return (
    <Box component="span" aria-hidden="true"
      style={{ width, height, mask, WebkitMask: mask }}
      sx={{
        display: 'block', bgcolor: 'currentColor',
        '@media (forced-colors: active)': { bgcolor: 'CanvasText', forcedColorAdjust: 'none' },
      }}
    />
  );
}
