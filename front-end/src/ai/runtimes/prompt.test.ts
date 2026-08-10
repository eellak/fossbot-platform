import { parseClientSuggestionText } from './prompt';

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
});
