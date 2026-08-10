import type { AIPublicProvider } from '../types';
import { buildClientRuntimeMessages } from './prompt';
import { localCompatibleEndpoint, readLocalCompatibleSecret, readLocalCompatibleSettings } from './deviceSettings';
import { AI_RUNTIME_INTERFACE_VERSION, type AIAssistantRuntime } from './types';

const MAX_RESPONSE_BYTES = 256_000;
const REQUEST_TIMEOUT_MS = 60_000;

function localError(reason: unknown, endpoint: string) {
  if (reason instanceof DOMException && reason.name === 'AbortError') return reason;
  if (location.protocol === 'https:' && endpoint.startsWith('http:')) return new Error('mixed_content');
  if (reason instanceof TypeError) return new Error('local_browser_policy');
  return reason instanceof Error ? reason : new Error('local_endpoint_error');
}

export class LocalCompatibleRuntime implements AIAssistantRuntime {
  readonly version = AI_RUNTIME_INTERFACE_VERSION;
  private controller: AbortController | null = null;
  constructor(readonly provider: AIPublicProvider) {}

  async prepare({ onStatus }: Parameters<AIAssistantRuntime['prepare']>[0]) {
    const configured = readLocalCompatibleSettings(this.provider.id);
    onStatus(configured ? { readiness: 'ready' } : { readiness: 'unavailable', message: 'local_settings_required' });
    if (!configured) throw new Error('local_settings_required');
  }

  async stream({ request, onEvent, signal, onStatus }: Parameters<AIAssistantRuntime['stream']>[0]) {
    const configured = readLocalCompatibleSettings(this.provider.id);
    if (!configured) throw new Error('local_settings_required');
    const endpoint = localCompatibleEndpoint(configured.baseUrl, String(this.provider.settings.path || 'chat/completions'));
    if (location.protocol === 'https:' && endpoint.startsWith('http:')) throw new Error('mixed_content');
    const controller = new AbortController();
    this.controller = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    onStatus({ readiness: 'ready' });
    onEvent({ type: 'start', data: { provider: this.provider.name, model: configured.model, runtime: 'user_local' } });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(readLocalCompatibleSecret(this.provider.id) ? { Authorization: `Bearer ${readLocalCompatibleSecret(this.provider.id)}` } : {}),
        },
        body: JSON.stringify({ model: configured.model, messages: buildClientRuntimeMessages(request), stream: true, stream_options: { include_usage: true }, max_tokens: 2048 }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'local_model_unavailable' : 'local_endpoint_error');
      if (!response.body) throw new Error('local_malformed_stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let received = 0;
      let parsedFrames = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_RESPONSE_BYTES) throw new Error('local_response_limit');
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let payload: any;
          try { payload = JSON.parse(data); } catch { throw new Error('local_malformed_stream'); }
          parsedFrames += 1;
          const delta = payload?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) onEvent({ type: 'text_delta', data: { text: delta } });
          if (payload?.usage) onEvent({ type: 'usage', data: { inputTokens: payload.usage.prompt_tokens, outputTokens: payload.usage.completion_tokens, estimated: false } });
        }
      }
      if (!parsedFrames) throw new Error('local_malformed_stream');
      onEvent({ type: 'done', data: {} });
    } catch (reason) {
      if (timedOut) throw new Error('local_timeout');
      throw localError(reason, endpoint);
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (this.controller === controller) this.controller = null;
    }
  }

  cancel() { this.controller?.abort(); }
  async dispose() { this.cancel(); }
}

export async function testLocalCompatibleConnection(provider: AIPublicProvider, signal?: AbortSignal) {
  const configured = readLocalCompatibleSettings(provider.id);
  if (!configured) throw new Error('local_settings_required');
  const endpoint = localCompatibleEndpoint(configured.baseUrl, String(provider.settings.path || 'chat/completions'));
  if (location.protocol === 'https:' && endpoint.startsWith('http:')) throw new Error('mixed_content');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(readLocalCompatibleSecret(provider.id) ? { Authorization: `Bearer ${readLocalCompatibleSecret(provider.id)}` } : {}) },
    body: JSON.stringify({ model: configured.model, messages: [{ role: 'user', content: 'Reply with OK.' }], stream: false, max_tokens: 4 }),
    signal,
  }).catch((reason) => { throw localError(reason, endpoint); });
  if (!response.ok) throw new Error(response.status === 404 ? 'local_model_unavailable' : 'local_endpoint_error');
  const text = await response.text();
  if (text.length > 64_000) throw new Error('local_response_limit');
  let payload: any;
  try { payload = JSON.parse(text); }
  catch { throw new Error('local_malformed_stream'); }
  if (typeof payload?.choices?.[0]?.message?.content !== 'string') throw new Error('local_malformed_stream');
}
