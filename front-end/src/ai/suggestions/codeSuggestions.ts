import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import TOOLBOX_JSON_EN from 'src/utils/toolboxBlockly/toolbox_en';
import 'src/utils/blocksBlockly/customBlocks';
import type { AIAssistantSuggestion, AICodeSuggestion, BlocklyReplaceSuggestion, PythonReplaceSuggestion } from '../types';

export const CODE_SUGGESTION_VERSION = '1';

export type SuggestionPreview = {
  suggestion: AIAssistantSuggestion;
  summary: string;
  kind: 'python' | 'blockly' | 'lesson' | 'stage';
  before: string;
  after: string;
  detail: string;
  changes?: string[];
  studentVisible?: string;
  teacherOnly?: string;
  validation?: string[];
  stage?: {
    added: number;
    changed: number;
    removed: number;
    resolvedIssues: string[];
    newIssues: string[];
    floor: [number, number];
    objects: Array<{ id: string; kind: string; position: [number, number, number] }>;
  };
};

const ALLOWED_BLOCK_TYPES = new Set<string>();
function collectBlockTypes(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(collectBlockTypes); return; }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (key === 'type' && typeof child === 'string') ALLOWED_BLOCK_TYPES.add(child);
    if (key === 'blockxml' && typeof child === 'string') {
      Array.from(child.matchAll(/type="([^"]+)"/g), (match) => match[1]).forEach((type) => ALLOWED_BLOCK_TYPES.add(type));
    }
    collectBlockTypes(child);
  });
}
collectBlockTypes(TOOLBOX_JSON_EN);

export const allowedBlocklyBlockTypes = () => Array.from(ALLOWED_BLOCK_TYPES).sort();

export function parseCodeSuggestion(value: Record<string, unknown>): AICodeSuggestion {
  if (value.version !== CODE_SUGGESTION_VERSION || typeof value.baseFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.baseFingerprint) || typeof value.summary !== 'string' || !value.summary.trim()) {
    throw new Error('invalid_suggestion');
  }
  if (value.type === 'python_replace' && typeof value.replacement === 'string' && value.replacement.length <= 12_000) return value as unknown as PythonReplaceSuggestion;
  if (value.type === 'blockly_replace' && typeof value.xml === 'string' && value.xml.length <= 16_000) return value as unknown as BlocklyReplaceSuggestion;
  throw new Error('invalid_suggestion');
}

export function previewPythonSuggestion(suggestion: PythonReplaceSuggestion, currentSource: string): SuggestionPreview {
  return { suggestion, summary: suggestion.summary, kind: 'python', before: currentSource, after: suggestion.replacement, detail: '' };
}

export function validateBlocklySuggestion(suggestion: BlocklyReplaceSuggestion, currentXml: string): SuggestionPreview {
  const dom = Blockly.utils.xml.textToDom(suggestion.xml);
  const ids = Array.from(dom.querySelectorAll('[id]'), (element) => element.getAttribute('id')).filter(Boolean) as string[];
  if (new Set(ids).size !== ids.length) throw new Error('duplicate_block_ids');
  const workspace = new Blockly.Workspace();
  try {
    Blockly.Xml.domToWorkspace(dom, workspace);
    const blocks = workspace.getAllBlocks(false);
    const unknown = blocks.map((block) => block.type).filter((type) => !ALLOWED_BLOCK_TYPES.has(type));
    if (unknown.length) throw new Error(`unknown_block_type:${unknown[0]}`);
    const generatedPython = pythonGenerator.workspaceToCode(workspace);
    if (typeof generatedPython !== 'string') throw new Error('block_generation_failed');
    return {
      suggestion,
      summary: suggestion.summary,
      kind: 'blockly',
      before: currentXml,
      after: suggestion.xml,
      detail: generatedPython,
    };
  } finally { workspace.dispose(); }
}
