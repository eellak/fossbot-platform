import { AIRequestError, parseAIStreamFrame } from './AssistantApi';


declare const describe: any;
declare const expect: any;
declare const it: any;


describe('parseAIStreamFrame', () => {
  it('parses a typed JSON object event', () => {
    expect(parseAIStreamFrame('event: text_delta\ndata: {"text":"Hello"}')).toEqual({
      type: 'text_delta',
      data: { text: 'Hello' },
    });
  });

  it.each([
    'data: {"text":"missing event"}',
    'event: unknown\ndata: {}',
    'event: done\ndata: not-json',
    'event: done\ndata: []',
  ])('rejects malformed frames', (frame) => {
    expect(() => parseAIStreamFrame(frame)).toThrow(AIRequestError);
    try { parseAIStreamFrame(frame); }
    catch (error) { expect((error as AIRequestError).code).toBe('malformed_response'); }
  });
});
