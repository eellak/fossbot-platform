import React from 'react';
import type { StageSemanticKind } from './types';
import { useEditorTheme } from './stageBuilderEditorTheme';

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
  const { variant } = useEditorTheme();
  const mode = variant === 'studio' ? 'dark' : 'light';
  return <img src={`${process.env.PUBLIC_URL || ''}/stage-builder/icons/${mode}/${artwork[kind]}-${mode}.svg`} width={width} height={height} alt="" draggable={false} style={{ display: 'block', objectFit: 'contain' }} />;
}
