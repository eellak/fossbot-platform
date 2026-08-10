import {
  CreateWebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type AppConfig,
  type ModelRecord,
  type WebWorkerMLCEngine,
} from '@mlc-ai/web-llm';
import type { AIPublicProvider } from '../types';
import { buildClientRuntimeMessages } from './prompt';
import { AI_RUNTIME_INTERFACE_VERSION, type AIAssistantRuntime } from './types';

type WebLLMSettings = {
  modelUrl?: unknown;
  wasmUrl?: unknown;
  modelSizeBytes?: unknown;
  memorySizeBytes?: unknown;
  bufferSizeRequiredBytes?: unknown;
  requiredWebGpuFeatures?: unknown;
  cacheBackend?: unknown;
  integrity?: unknown;
};

function appConfig(provider: AIPublicProvider): AppConfig {
  const settings = provider.settings as WebLLMSettings;
  if (typeof settings.modelUrl !== 'string' || typeof settings.wasmUrl !== 'string') throw new Error('webllm_config_invalid');
  const record: ModelRecord = {
    model: settings.modelUrl,
    model_id: provider.model,
    model_lib: settings.wasmUrl,
    ...(Array.isArray(settings.requiredWebGpuFeatures) ? { required_features: settings.requiredWebGpuFeatures.map(String) } : {}),
    ...(typeof settings.bufferSizeRequiredBytes === 'number' ? { buffer_size_required_bytes: settings.bufferSizeRequiredBytes } : {}),
    ...(settings.integrity && typeof settings.integrity === 'object' ? { integrity: settings.integrity as ModelRecord['integrity'] } : {}),
  };
  return { model_list: [record], cacheBackend: settings.cacheBackend === 'indexeddb' ? 'indexeddb' : 'cache' };
}

async function requireWebGPUSupport(provider: AIPublicProvider) {
  if (!window.isSecureContext) throw new Error('webllm_secure_context');
  const gpu = (navigator as Navigator & { gpu?: any }).gpu;
  if (!gpu) throw new Error('webllm_unsupported');
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('webllm_unsupported');
  const required = Array.isArray(provider.settings.requiredWebGpuFeatures) ? provider.settings.requiredWebGpuFeatures.map(String) : [];
  if (required.some((feature) => !adapter.features.has(feature))) throw new Error('webllm_resources');
  const minimumBuffer = Number(provider.settings.bufferSizeRequiredBytes || 0);
  if (minimumBuffer && Number(adapter.limits?.maxStorageBufferBindingSize || 0) < minimumBuffer) throw new Error('webllm_resources');
}

export class WebLLMRuntime implements AIAssistantRuntime {
  readonly version = AI_RUNTIME_INTERFACE_VERSION;
  private worker: Worker | null = null;
  private engine: WebWorkerMLCEngine | null = null;
  private preparing: Promise<void> | null = null;
  constructor(readonly provider: AIPublicProvider) {}

  async cached() { return hasModelInCache(this.provider.model, appConfig(this.provider)); }
  async checkSupport() { await requireWebGPUSupport(this.provider); }

  async prepare({ signal, onStatus }: Parameters<AIAssistantRuntime['prepare']>[0]) {
    if (this.engine) { onStatus({ readiness: 'ready', cached: true }); return; }
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      onStatus({ readiness: 'checking' });
      await this.checkSupport();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const cached = await this.cached();
      onStatus({ readiness: 'loading', progress: 0, cached });
      this.worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
      const abort = () => { void this.dispose(); };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        this.engine = await CreateWebWorkerMLCEngine(this.worker, this.provider.model, {
          appConfig: appConfig(this.provider),
          initProgressCallback: (progress) => onStatus({ readiness: 'loading', progress: Math.max(0, Math.min(1, progress.progress)), message: progress.text, cached }),
        });
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        onStatus({ readiness: 'ready', progress: 1, cached: true });
      } catch (reason) {
        await this.dispose();
        onStatus({ readiness: 'error', message: reason instanceof Error ? reason.message : 'webllm_load_failed', cached });
        throw reason;
      } finally { signal?.removeEventListener('abort', abort); }
    })();
    try { await this.preparing; } finally { this.preparing = null; }
  }

  async stream({ request, onEvent, signal, onStatus }: Parameters<AIAssistantRuntime['stream']>[0]) {
    await this.prepare({ signal, onStatus });
    if (!this.engine) throw new Error('webllm_worker_stopped');
    onEvent({ type: 'start', data: { provider: this.provider.name, model: this.provider.model, runtime: 'browser' } });
    const abort = () => this.cancel();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const chunks = await this.engine.chat.completions.create({
        messages: buildClientRuntimeMessages(request),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 2048,
        temperature: 0.2,
      });
      let characters = 0;
      for await (const chunk of chunks) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const text = chunk.choices[0]?.delta.content || '';
        characters += text.length;
        if (characters > 64_000) throw new Error('local_response_limit');
        if (text) onEvent({ type: 'text_delta', data: { text } });
        if (chunk.usage) onEvent({ type: 'usage', data: { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens, estimated: false } });
      }
      onEvent({ type: 'done', data: {} });
    } catch (reason) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await this.dispose();
      onStatus({ readiness: 'error', message: 'webllm_worker_stopped', cached: true });
      throw reason instanceof Error && reason.message === 'local_response_limit' ? reason : new Error('webllm_worker_stopped');
    } finally { signal?.removeEventListener('abort', abort); }
  }

  cancel() { this.engine?.interruptGenerate(); }

  async dispose() {
    const engine = this.engine;
    this.engine = null;
    if (engine) await engine.unload().catch(() => undefined);
    this.worker?.terminate();
    this.worker = null;
  }

  async clearCache() {
    await this.dispose();
    await deleteModelAllInfoInCache(this.provider.model, appConfig(this.provider));
  }
}

export const webLLMConsentKey = (provider: AIPublicProvider) => `fossbot.ai.webllm.${provider.id}.${provider.model}.consent.v1`;

export function webLLMDownloadGuidance(provider: AIPublicProvider) {
  return {
    downloadBytes: Number(provider.settings.modelSizeBytes || 0),
    memoryBytes: Number(provider.settings.memorySizeBytes || 0),
    source: String(provider.settings.modelUrl || ''),
  };
}
