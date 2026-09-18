import type { PythonEdit } from '../types';

const pythonEditLines = (replacement: string): string[] => {
  if (replacement === '') return [];
  return (replacement.endsWith('\n') ? replacement.slice(0, -1) : replacement).split('\n');
};

/**
 * Merge 1-based inclusive line-range edits into the current source.
 * Mirrors the backend `apply_python_edits` validator so the preview, apply, and
 * server checks agree. An empty replacement deletes the range.
 */
export function applyPythonEdits(source: string, edits: PythonEdit[]): string {
  const lines = source.split('\n');
  const ordered = [...edits].sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
  let previousEnd = 0;
  for (const edit of ordered) {
    if (edit.startLine > edit.endLine || edit.startLine <= previousEnd || edit.endLine > lines.length) throw new Error('invalid_suggestion');
    previousEnd = edit.endLine;
  }
  for (const edit of [...edits].sort((left, right) => right.startLine - left.startLine)) {
    lines.splice(edit.startLine - 1, edit.endLine - edit.startLine + 1, ...pythonEditLines(edit.replacement));
  }
  return lines.join('\n');
}
