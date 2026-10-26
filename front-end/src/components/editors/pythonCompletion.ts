import type { Monaco } from '@monaco-editor/react';
import { BRIDGE_PARAMETERS, SIMULATOR_ROBOT_METHODS } from 'src/workers/simulatorRobotApi';
import { maskedPython } from 'src/workers/pythonTransform';

export type PythonSuggestion = {
  label: string;
  insertText: string;
  detail: string;
  kind: 'function' | 'field' | 'keyword';
};

// Monaco has no Python language service, so completion is a static list built from the
// simulator API surface. Keep it derived from SIMULATOR_ROBOT_METHODS so new robot
// methods show up here without a second edit.
function call(name: string, params?: string): string {
  if (!params) return `${name}()`;
  return `${name}(${params.split(',').map((param, index) => `\${${index + 1}:${param.trim()}}`).join(', ')})`;
}

function robotSuggestions(kind: 'global' | 'member'): PythonSuggestion[] {
  return SIMULATOR_ROBOT_METHODS.filter((name) => !name.includes('.')).map((name) => ({
    label: name,
    insertText: call(name, BRIDGE_PARAMETERS[name]),
    detail: kind === 'global' ? `async · robot.${name}` : 'async robot method',
    kind: 'function',
  }));
}

const MOTOR_MEMBERS: PythonSuggestion[] = [
  { label: 'set_speed', insertText: call('set_speed', 'speed'), detail: 'motor speed 0-100', kind: 'function' },
  { label: 'move', insertText: call('move', "'forward'"), detail: "'forward' | 'reverse'", kind: 'function' },
  { label: 'dir_control', insertText: call('dir_control', "'forward'"), detail: "'forward' | 'reverse'", kind: 'function' },
  { label: 'stop', insertText: call('stop'), detail: 'stop this motor', kind: 'function' },
  { label: 'dc_value', insertText: 'dc_value', detail: 'motor speed 0-100', kind: 'field' },
];

const PYTHON_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'True', 'False', 'None',
];

const PYTHON_BUILTINS = [
  'print', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'abs', 'min',
  'max', 'sum', 'sorted', 'enumerate', 'zip', 'round', 'type', 'isinstance', 'input',
];

const SCOPE_VARIABLES: PythonSuggestion[] = [
  { label: 'robot', insertText: 'robot', detail: 'the simulator robot', kind: 'field' },
  { label: 'motor_left', insertText: 'motor_left', detail: 'left motor', kind: 'field' },
  { label: 'motor_right', insertText: 'motor_right', detail: 'right motor', kind: 'field' },
];

export const PYTHON_GLOBALS: PythonSuggestion[] = [
  ...robotSuggestions('global'),
  ...PYTHON_KEYWORDS.map((label) => ({ label, insertText: label, detail: 'keyword', kind: 'keyword' as const })),
  ...PYTHON_BUILTINS.map((label) => ({ label, insertText: `${label}()`, detail: 'builtin', kind: 'function' as const })),
  ...SCOPE_VARIABLES,
];

const ROBOT_MEMBERS = robotSuggestions('member');

export function pythonSuggestions(receiver?: string): PythonSuggestion[] {
  if (receiver === 'robot') return ROBOT_MEMBERS;
  if (receiver === 'motor_left' || receiver === 'motor_right') return MOTOR_MEMBERS;
  return PYTHON_GLOBALS;
}

const KINDS = { function: 'Function', field: 'Field', keyword: 'Keyword' } as const;

export function definedFunctions(source: string): PythonSuggestion[] {
  const found = new Map<string, PythonSuggestion>();
  for (const [, name, params] of maskedPython(source).matchAll(/^[ \t]*(?:async[ \t]+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm)) {
    const args = params
      .split(',')
      .map((param) => param.trim().split(/\s*[=:]/)[0])
      .filter((param) => param && param !== 'self' && param !== 'cls');
    found.set(name, { label: name, insertText: call(name, args.join(', ')), detail: 'defined in this file', kind: 'function' });
  }
  return [...found.values()];
}

let registered = false;

export function registerPythonCompletion(monaco: Monaco): void {
  // beforeMount runs per editor instance; registering twice would duplicate every item.
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const receiver = /(robot|motor_left|motor_right)\.\w*$/.exec(before)?.[1];
      // Own defs live in the buffer, not in the static API list. short: same-file defs
      // only, no attribute completion on their return values.
      const suggestions = receiver ? pythonSuggestions(receiver) : [...pythonSuggestions(), ...definedFunctions(model.getValue())];

      return {
        suggestions: suggestions.map((item) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind[KINDS[item.kind]],
          detail: item.detail,
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
      };
    },
  });
}
