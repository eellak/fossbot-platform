import { compactDebugEntries } from './AdminDebugTrace';
import type { AIDebugTraceEntry } from 'src/ai/types';

declare const describe: any;
declare const expect: any;
declare const it: any;

const entry = (sequence: number, step: string, data: unknown): AIDebugTraceEntry => ({
  version: '1',
  sequence,
  timestamp: '2026-08-10T10:00:00.000Z',
  source: 'backend',
  step,
  data,
});

describe('compactDebugEntries', () => {
  it('keeps diagnostic milestones and summarizes validation failures', () => {
    const compact = compactDebugEntries([
      entry(1, 'policy.resolved', { allowed: true }),
      entry(2, 'suggestion.raw', { attempt: 1, characters: 834 }),
      entry(3, 'suggestion.rejected', {
        attempt: 1,
        willRepair: true,
        error: {
          message: 'The provider returned an invalid suggestion',
          cause: { validation: [{ loc: ['expectedValidation'], msg: 'Input should be a valid string' }] },
        },
      }),
    ]);

    expect(compact).toHaveLength(2);
    expect(compact[0].summary).toContain('Attempt 1 received');
    expect(compact[1]).toMatchObject({ step: 'suggestion.rejected', severity: 'warning' });
    expect(compact[1].summary).toContain('expectedValidation: Input should be a valid string');
  });

  it('summarizes provider profiles, finish reasons, and normalizations', () => {
    const compact = compactDebugEntries([
      entry(1, 'event.metadata', { compatibilityProfile: 'llamacpp', structuredOutput: true, profileStatus: 'supported' }),
      entry(2, 'event.metadata', { compatibilityProfile: 'openrouter', structuredOutput: false, structuredOutputFallback: true }),
      entry(3, 'event.metadata', { compatibilityProfile: 'openrouter', providerRetry: true, retryAttempt: 1, maxProviderRetries: 2, errorType: 'provider_unavailable' }),
      entry(4, 'event.finish', { attempt: 1, finishReason: 'length', reasoningCharacters: 4096 }),
      entry(5, 'suggestion.normalized', { attempt: 1, actions: ['operations.0:flatten-add_object-wrapper'] }),
    ]);
    expect(compact[0].summary).toContain('llamacpp profile');
    expect(compact[1]).toMatchObject({ severity: 'warning' });
    expect(compact[1].summary).toContain('continued with prompt-constrained JSON');
    expect(compact[2]).toMatchObject({ severity: 'warning' });
    expect(compact[2].summary).toContain('provider_unavailable');
    expect(compact[3]).toMatchObject({ severity: 'warning' });
    expect(compact[3].summary).toContain('4,096 reasoning characters');
    expect(compact[4].summary).toContain('flatten-add_object-wrapper');
  });
});
