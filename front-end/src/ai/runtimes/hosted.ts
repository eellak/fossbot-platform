import { streamAIAssist } from '../AssistantApi';
import type { AIPublicProvider } from '../types';
import { AI_RUNTIME_INTERFACE_VERSION, type AIAssistantRuntime } from './types';

export class HostedRuntime implements AIAssistantRuntime {
  readonly version = AI_RUNTIME_INTERFACE_VERSION;
  constructor(readonly provider: AIPublicProvider, private readonly token: string) {}

  async prepare({ onStatus }: Parameters<AIAssistantRuntime['prepare']>[0]) {
    onStatus({ readiness: 'ready' });
  }

  async stream({ request, onEvent, signal, onStatus }: Parameters<AIAssistantRuntime['stream']>[0]) {
    onStatus({ readiness: 'ready' });
    await streamAIAssist(this.token, {
      capability: request.capability,
      providerId: this.provider.id,
      surface: request.surface,
      question: request.question,
      history: request.history,
      context: request.context,
      debug: request.debug,
      benchmark: request.benchmark,
    }, onEvent, signal);
  }

  cancel() {}
  async dispose() {}
}
