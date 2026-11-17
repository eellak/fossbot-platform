import type { LineDiagnostic } from './lineGeometryCore'
export interface StageLoadDiagnostic extends Omit<LineDiagnostic, 'severity'> {
  severity: 'error'
  entryIndex?: number
  objectId?: string
}
export class StageLoadError extends Error {
  diagnostics: StageLoadDiagnostic[]
  phase: 'validation' | 'fetch' | 'construction'
  constructor(diagnostics: StageLoadDiagnostic[], phase?: 'validation' | 'fetch' | 'construction')
}
export function validateStageFormat(source: unknown, options?: { legacy?: boolean; editable?: boolean }): Record<string, unknown>[]
export function stageLoadError(error: unknown, phase?: StageLoadError['phase']): StageLoadError
export function editorLineToRuntime(object: import('./lineGeometryCore').LineGeometry & { name?: string; color?: string | number }): Record<string, unknown> | null
export function hiddenEditorObjectIds(objects: { id: string; hidden?: boolean; parentId?: string; attachment?: { parentId: string } }[]): Set<string>
