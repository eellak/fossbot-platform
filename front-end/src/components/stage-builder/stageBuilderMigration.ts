import { editorLineToRuntime, hiddenEditorObjectIds, validateStageFormat } from '../../simulator/stages/stageFormatCore';
import { sharpLineCorners } from '../../simulator/stages/lineGeometryCore';
import type { EditorLineObject, LocalStageRecord, StageJsonEntry, StageLineEntry } from './types';

export type StageMigrationDiagnostic = { code: string; message: string; severity: 'notice' };
export type StageMigrationResult = {
  record: LocalStageRecord;
  sourceVersion: number | null;
  upgraded: boolean;
  diagnostics: StageMigrationDiagnostic[];
};

/** Produces a working copy. The caller owns the unchanged source and persistence. */
export function upgradeStageRecord(source: LocalStageRecord): StageMigrationResult {
  validateStageFormat(source, { editable: true });
  const record: LocalStageRecord = JSON.parse(JSON.stringify(source));
  const sourceVersion = source.editor?.version ?? null;
  const diagnostics: StageMigrationDiagnostic[] = [];
  const nativeLine = <T extends StageLineEntry | EditorLineObject>(line: T): T => line.curveVersion !== undefined ? line : {
    ...line, curveVersion: 1, corners: sharpLineCorners(line.points),
  };
  record.config = record.config.map(entry => entry.type === 'line' ? nativeLine(entry) : entry);
  if (record.editor) {
    const editor = record.editor;
    editor.version = 3;
    editor.objects = editor.objects?.map(object => object.kind === 'line' ? nativeLine(object) : object);
    const setting = (key: 'defaultSnapPreset' | 'defaultRotationSnapPreset', allowed: string[], fallback: 'fine' | '15') => {
      const value = editor[key];
      if (value !== undefined && !allowed.includes(value)) diagnostics.push({ code: `invalid-${key}`, severity: 'notice', message: `${key === 'defaultSnapPreset' ? 'Movement' : 'Rotation'} snapping had an invalid saved value. Restored ${fallback === 'fine' ? '0.1 m' : '15°'} in this working copy.` });
      if (!allowed.includes(value || '')) (editor as Record<string, unknown>)[key] = fallback;
    };
    setting('defaultSnapPreset', ['off', 'precise', 'fine', 'medium', 'coarse'], 'fine');
    setting('defaultRotationSnapPreset', ['off', '15', '30', '45'], '15');
    if (!['precise', 'fine', 'medium', 'coarse'].includes(editor.lastMovementSnapPreset || '')) {
      editor.lastMovementSnapPreset = editor.defaultSnapPreset === 'off' ? 'fine' : editor.defaultSnapPreset;
    }
    if (sourceVersion !== 3 && editor.objects) {
      // Legacy snapshots retain their established precedence over stale runtime lines.
      const hidden = hiddenEditorObjectIds(editor.objects);
      const lines = editor.objects.filter((object): object is EditorLineObject => object.kind === 'line' && !hidden.has(object.id))
        .map(editorLineToRuntime).filter((entry): entry is NonNullable<typeof entry> => entry !== null) as StageLineEntry[];
      let index = 0;
      record.config = record.config.flatMap<StageJsonEntry>(entry => entry.type !== 'line' ? [entry] : index < lines.length ? [lines[index++]] : []);
      record.config.push(...lines.slice(index));
    }
  }
  const upgraded = JSON.stringify(record) !== JSON.stringify(source);
  if (upgraded && sourceVersion !== 3) diagnostics.unshift({ code: 'legacy-upgraded', severity: 'notice', message: 'Updated this working copy. Existing paths retain sharp corners and the original source is unchanged.' });
  validateStageFormat(record, { editable: true });
  return { record, sourceVersion, upgraded, diagnostics };
}
