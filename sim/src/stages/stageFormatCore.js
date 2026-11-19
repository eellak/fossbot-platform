import { evaluateLineGeometry, validateLineGeometry } from './lineGeometryCore.js'
import { Color } from 'three'

/** The same line projection is used by Save and current-record comparison. */
export function editorLineToRuntime(object) {
  if (object.points.length < 2) return null
  return {
    type: 'line', ...(object.closed === undefined ? {} : { closed: object.closed }), points: object.points, width: object.width, color: object.color,
    y: object.y, name: object.name || 'line',
    ...(object.curveVersion === undefined ? {} : { curveVersion: object.curveVersion, corners: object.corners }),
  }
}

export function hiddenEditorObjectIds(objects) {
  const byId = new Map(objects.map(object => [object.id, object]))
  const hidden = new Set(objects.filter(object => object.hidden).map(object => object.id))
  for (const object of objects) {
    const visited = new Set()
    let parent = byId.get(object.parentId || object.attachment?.parentId)
    while (parent && !visited.has(parent.id)) {
      if (parent.hidden) { hidden.add(object.id); break }
      visited.add(parent.id)
      parent = byId.get(parent.parentId || parent.attachment?.parentId)
    }
  }
  return hidden
}

function canonicalLine(line) {
  return {
    points: line.points, closed: line.closed === true, curveVersion: line.curveVersion ?? null,
    corners: line.curveVersion !== undefined ? line.corners.map(corner => !corner ? null : corner.mode === 'sharp'
      ? { mode: 'sharp' } : { mode: 'rounded', sizing: corner.sizing, ...(corner.sizing === 'manual' ? { trim: corner.trim } : {}) }) : null,
    width: line.width ?? 0.01, y: line.y ?? 0.001,
    color: new Color(line.color ?? 'black').toArray(),
  }
}

export class StageLoadError extends Error {
  constructor(diagnostics, phase = 'validation') {
    super(diagnostics.map(item => item.message).join(' '))
    this.name = 'StageLoadError'
    this.diagnostics = diagnostics
    this.phase = phase
  }
}

export function stageLoadError(error, phase = 'construction') {
  return error instanceof StageLoadError ? error : new StageLoadError([
    { code: `stage-${phase}-failed`, message: error instanceof Error ? error.message : String(error), severity: 'error' },
  ], phase)
}

/** Validate before any consumer clears a scene or drops editor-only fields. */
export function validateStageFormat(source, { legacy = false, editable = false } = {}) {
  const diagnostics = []
  const error = (code, message, entryIndex) => diagnostics.push({ code, message, severity: 'error', ...(entryIndex === undefined ? {} : { entryIndex }) })
  const record = source && typeof source === 'object' && !Array.isArray(source) ? source : null
  const entries = Array.isArray(source) ? source : record?.config
  if (!Array.isArray(entries)) error('invalid-stage', 'Stage JSON must be an array or a record with a config array.')
  const editor = record?.editor
  if (editor !== undefined && (!editor || typeof editor !== 'object' || Array.isArray(editor))) error('invalid-editor', 'Editor metadata must be an object.')
  if (editor?.version !== undefined && ![1, 2, 3].includes(editor.version)) error('unsupported-editor-version', 'This stage uses an unsupported editor version. Open it in a compatible editor.')
  for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      error('invalid-entry', 'Each stage entry must be an object.', index)
      continue
    }
    if (entry.type !== 'line') continue
    const lineDiagnostics = editable ? validateLineGeometry(entry) : evaluateLineGeometry(entry).diagnostics
    diagnostics.push(...lineDiagnostics.map(item => ({ ...item, severity: 'error', entryIndex: index })))
    if (legacy && entry.curveVersion !== undefined) error('legacy-native-line', 'This stage requires the current simulator. Switch to the current simulator to open it.', index)
  }
  if (editor?.objects !== undefined && !Array.isArray(editor.objects)) error('invalid-editor-objects', 'Editor objects must be an array.')
  for (const [index, object] of (Array.isArray(editor?.objects) ? editor.objects : []).entries()) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) error('invalid-editor-object', 'Each editor object must be an object.', index)
    if (object?.kind === 'line') diagnostics.push(...validateLineGeometry(object).map(item => ({ ...item, objectId: object.id, entryIndex: index })))
  }
  if (!diagnostics.length && editor?.version === 3 && Array.isArray(editor.objects)) {
    const hidden = hiddenEditorObjectIds(editor.objects)
    const expected = editor.objects.filter(object => object.kind === 'line' && !hidden.has(object.id))
      .map(editorLineToRuntime).filter(Boolean).map(canonicalLine)
    const actual = entries.filter(entry => entry.type === 'line').map(canonicalLine)
    // JSON normalises negative zero and preserves finite values and line order exactly.
    if (JSON.stringify(expected) !== JSON.stringify(actual)) error('editor-runtime-line-mismatch',
      'The editor paths and runnable lines disagree. Preserve the original and repair the conflicting representations before saving or running.')
  }
  if (diagnostics.length) throw new StageLoadError(diagnostics)
  return entries
}
