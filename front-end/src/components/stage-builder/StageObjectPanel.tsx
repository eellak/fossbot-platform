import React from 'react';
import type { EditorStageObject } from './types';
import { StageInspector } from './StageInspector';

export interface StageObjectPanelProps {
  object: EditorStageObject | null;
  onChange: (object: EditorStageObject) => void;
  onDelete: (id: string) => void;
}

export function StageObjectPanel({ object, onChange, onDelete }: StageObjectPanelProps) {
  return <StageInspector object={object} onChange={onChange} onDelete={onDelete} />;
}
