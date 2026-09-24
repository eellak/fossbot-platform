const identifier = /^[A-Za-z_]\w*$/;

function maskedPython(source: string): string {
  const chars = source.split('');
  const masked = [...chars];
  let quote = '';
  let escaped = false;
  let comment = false;

  for (let index = 0; index < chars.length; index += 1) {
    const character = chars[index];
    if (comment) {
      if (character === '\n') comment = false;
      else masked[index] = ' ';
      continue;
    }
    if (quote) {
      const closesTriple = quote.length === 3 && source.startsWith(quote, index);
      if (closesTriple) {
        masked[index] = masked[index + 1] = masked[index + 2] = ' ';
        index += 2;
        quote = '';
        continue;
      }
      masked[index] = character === '\n' ? '\n' : ' ';
      if (quote.length === 1) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
      }
      continue;
    }
    if (character === '#') {
      masked[index] = ' ';
      comment = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = source.startsWith(character.repeat(3), index) ? character.repeat(3) : character;
      masked[index] = ' ';
      if (quote.length === 3) {
        masked[index + 1] = masked[index + 2] = ' ';
        index += 2;
      }
    }
  }
  return masked.join('');
}

function leadingIndent(line: string): number {
  return (line.match(/^[ \t]*/) || [''])[0].replace(/\t/g, '    ').length;
}

function functionNames(source: string, keyword: 'def' | 'async def'): string[] {
  const pattern = keyword === 'def'
    ? /^\s*def\s+([A-Za-z_]\w*)\s*\(/gm
    : /^\s*async\s+def\s+([A-Za-z_]\w*)\s*\(/gm;
  return [...maskedPython(source).matchAll(pattern)].map((match) => match[1]);
}

/** Add await only to real calls in Python code, leaving strings, comments, and definitions intact. */
export function addAwaitToFunctionCalls(source: string, names: string[]): string {
  const callableNames = [...new Set(names)].filter((name) => identifier.test(name));
  if (!callableNames.length) return source;
  const mask = maskedPython(source);
  const pattern = new RegExp(`\\b(?:${callableNames.join('|')})(?=\\s*\\()`, 'g');
  const insertionPoints: number[] = [];
  for (const match of mask.matchAll(pattern)) {
    const index = match.index || 0;
    const prefix = mask.slice(Math.max(0, index - 24), index);
    const previous = mask.slice(0, index).match(/\S(?=\s*$)/)?.[0];
    if (previous === '.' || /(?:await|def|async\s+def)\s*$/.test(prefix)) continue;
    insertionPoints.push(index);
  }
  let transformed = source;
  for (const index of insertionPoints.reverse()) {
    transformed = `${transformed.slice(0, index)}await ${transformed.slice(index)}`;
  }
  return transformed;
}

function promoteAwaitingFunctions(source: string): { source: string; promoted: string[] } {
  const lines = source.split('\n');
  const maskLines = maskedPython(source).split('\n');
  const promoted: string[] = [];

  for (let index = 0; index < maskLines.length; index += 1) {
    const match = maskLines[index].match(/^(\s*)def\s+([A-Za-z_]\w*)\s*\(/);
    if (!match) continue;
    const definitionIndent = leadingIndent(maskLines[index]);
    let end = maskLines.length;
    for (let cursor = index + 1; cursor < maskLines.length; cursor += 1) {
      if (!maskLines[cursor].trim()) continue;
      if (leadingIndent(maskLines[cursor]) <= definitionIndent) {
        end = cursor;
        break;
      }
    }
    if (!maskLines.slice(index + 1, end).some((line) => /\bawait\b/.test(line))) continue;
    lines[index] = lines[index].replace(/^(\s*)def\b/, '$1async def');
    promoted.push(match[2]);
  }
  return { source: lines.join('\n'), promoted };
}

/**
 * Adapt the synchronous-looking editor API to Pyodide's promise-backed bridge.
 * The transform keeps the original line count so runtime diagnostics still map
 * to the source shown in Monaco.
 */
export function transformPythonForSimulator(source: string, bridgeFunctions: string[]): string {
  const knownAsync = new Set(functionNames(source, 'async def'));
  let transformed = addAwaitToFunctionCalls(source, [...bridgeFunctions, ...knownAsync]);

  for (let pass = 0; pass < 100; pass += 1) {
    const result = promoteAwaitingFunctions(transformed);
    transformed = result.source;
    const newlyAsync = result.promoted.filter((name) => !knownAsync.has(name));
    newlyAsync.forEach((name) => knownAsync.add(name));
    if (!newlyAsync.length) break;
    transformed = addAwaitToFunctionCalls(transformed, newlyAsync);
  }
  return transformed;
}
