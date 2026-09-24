export type EditorLineSelection = {
  startLine: number;
  endLine: number;
  endColumn: number;
};

/**
 * Replace the lines covered by a Monaco selection with a replacement block.
 * A selection that ends at column 1 on a later line includes that line's leading
 * newline, so the last covered line is `endLine - 1` in that case.
 */
export function replaceSelectedLines(source: string, selection: EditorLineSelection, code: string): string {
  const lines = source.split('\n');
  const lastLine = selection.endColumn === 1 && selection.endLine > selection.startLine ? selection.endLine - 1 : selection.endLine;
  const codeLines = code.replace(/\n+$/, '').split('\n');
  return [...lines.slice(0, selection.startLine - 1), ...codeLines, ...lines.slice(lastLine)].join('\n');
}

/** Focused line diff: trim the common prefix and suffix so a small edit shows only changed lines. */
export function lineDiff(before: string, after: string): { removed: string[]; added: string[] } {
  const source = before.split('\n');
  const target = after.split('\n');
  let start = 0;
  while (start < source.length && start < target.length && source[start] === target[start]) start += 1;
  let endSource = source.length - 1;
  let endTarget = target.length - 1;
  while (endSource >= start && endTarget >= start && source[endSource] === target[endTarget]) {
    endSource -= 1;
    endTarget -= 1;
  }
  return { removed: source.slice(start, endSource + 1), added: target.slice(start, endTarget + 1) };
}
