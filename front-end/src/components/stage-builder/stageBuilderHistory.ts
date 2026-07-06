import type { EditorStage } from './types';
import { cloneStage } from './stageBuilderGeometry';

export type StageBuilderHistory = {
  past: EditorStage[];
  future: EditorStage[];
  limit: number;
};

export function createStageBuilderHistory(limit = 80): StageBuilderHistory {
  return { past: [], future: [], limit };
}

export function pushStageHistory(history: StageBuilderHistory, current: EditorStage): StageBuilderHistory {
  const past = [...history.past, cloneStage(current)];
  while (past.length > history.limit) past.shift();
  return { ...history, past, future: [] };
}

export function undoStageHistory(history: StageBuilderHistory, current: EditorStage): { history: StageBuilderHistory; stage: EditorStage | null } {
  if (!history.past.length) return { history, stage: null };
  const past = [...history.past];
  const stage = past.pop() || null;
  return { history: { ...history, past, future: [cloneStage(current), ...history.future] }, stage };
}

export function redoStageHistory(history: StageBuilderHistory, current: EditorStage): { history: StageBuilderHistory; stage: EditorStage | null } {
  if (!history.future.length) return { history, stage: null };
  const [stage, ...future] = history.future;
  return { history: { ...history, past: [...history.past, cloneStage(current)], future }, stage: cloneStage(stage) };
}

export function canUndo(history: StageBuilderHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: StageBuilderHistory): boolean {
  return history.future.length > 0;
}
