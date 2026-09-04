import type {
  AIAssistantSurface,
  AICapabilityId,
  AIPublicProvider,
  AIRuntimeStatus,
  AIStreamEvent,
} from '../types';

export const AI_RUNTIME_INTERFACE_VERSION = '1';

export type AIRuntimeRequest = {
  capability: AICapabilityId;
  surface: AIAssistantSurface;
  question: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: Record<string, unknown>;
  maxOutputTokens: number;
  debug?: boolean;
  benchmark?: boolean;
};

export type AIRuntimePrepareOptions = {
  signal?: AbortSignal;
  onStatus: (status: AIRuntimeStatus) => void;
};

export type AIRuntimeStreamOptions = AIRuntimePrepareOptions & {
  request: AIRuntimeRequest;
  onEvent: (event: AIStreamEvent) => void;
};

export interface AIAssistantRuntime {
  readonly version: typeof AI_RUNTIME_INTERFACE_VERSION;
  readonly provider: AIPublicProvider;
  prepare(options: AIRuntimePrepareOptions): Promise<void>;
  stream(options: AIRuntimeStreamOptions): Promise<void>;
  cancel(): void;
  dispose(): Promise<void>;
}
