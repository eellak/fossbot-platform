import type { AIPublicProvider } from '../types';
import { HostedRuntime } from './hosted';
import { LocalCompatibleRuntime } from './localCompatible';
import type { AIAssistantRuntime } from './types';
import { WebLLMRuntime } from './webllm';

const browserRuntimes = new Map<number, WebLLMRuntime>();

export function runtimeFor(provider: AIPublicProvider, token: string): AIAssistantRuntime {
  if (provider.runtime === 'hosted') return new HostedRuntime(provider, token);
  if (provider.runtime === 'user_local') return new LocalCompatibleRuntime(provider);
  let runtime = browserRuntimes.get(provider.id);
  if (!runtime) { runtime = new WebLLMRuntime(provider); browserRuntimes.set(provider.id, runtime); }
  return runtime;
}

export async function clearBrowserRuntime(providerId: number) {
  const runtime = browserRuntimes.get(providerId);
  if (!runtime) return;
  await runtime.dispose();
  browserRuntimes.delete(providerId);
}
