import { buildClientRuntimeMessages, parseClientSuggestionText } from './prompt';
import { parseAssistantOutcome } from '../suggestions/parseSuggestion';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('parseClientSuggestionText', () => {
  it('accepts one JSON object wrapped in reasoning and Markdown', () => {
    expect(parseClientSuggestionText('<think>Prepare a safe proposal.</think>\n```json\n{"version":"1","type":"stage_operations"}\n```')).toEqual({
      version: '1',
      type: 'stage_operations',
    });
  });

  it('rejects ambiguous multiple JSON objects', () => {
    expect(() => parseClientSuggestionText('{"version":"1"}\n{"version":"2"}')).toThrow('invalid_suggestion');
  });

  it('explains stage geometry and generated-object follow-up operations', () => {
    const messages = buildClientRuntimeMessages({
      capability: 'stage.create',
      surface: 'stage',
      question: 'Create a room.',
      history: [],
      context: { baseFingerprint: 'f'.repeat(64), target: 'create', catalog: ['robotSpawn', 'target', 'wall'] },
    } as any);
    expect(messages[0].content).toContain('wall: cube dimensions [1,0.5,0.08]');
    expect(messages[0].content).toContain('use its tempId as objectId');
  });

  it('lets a code-capable model choose a plain answer outcome', () => {
    const fingerprint = 'a'.repeat(64);
    const messages = buildClientRuntimeMessages({
      capability: 'code.suggest_changes',
      surface: 'python',
      question: 'What does this do?',
      history: [],
      context: { sourceFingerprint: fingerprint, source: 'print("hi")' },
      maxOutputTokens: 6144,
    });
    expect(messages[0].content).toContain('return type "answer"');
    expect(parseAssistantOutcome({ version: '1', type: 'answer', baseFingerprint: fingerprint, content: 'It prints hi.' })).toEqual({
      version: '1', type: 'answer', baseFingerprint: fingerprint, content: 'It prints hi.',
    });
  });
});
