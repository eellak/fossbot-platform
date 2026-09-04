import type {
  AIAdminBootstrap,
  AIAccessBootstrap,
  AIAssistInput,
  AIAccessDecision,
  AICapabilityId,
  AIInstanceSettings,
  AIPolicyEffect,
  AIPolicyRule,
  AIProviderConfig,
  AIProviderInput,
  AIScopeType,
  AIStreamEvent,
} from './types';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export class AIRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'provider_error') {
    super(message);
    this.name = 'AIRequestError';
    this.status = status;
    this.code = code;
  }
}

export function parseAIStreamFrame(frame: string): AIStreamEvent {
  const eventType = frame.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
  const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!eventType || !data || !['start', 'text_delta', 'suggestion', 'usage', 'done', 'error', 'debug'].includes(eventType)) throw new AIRequestError('Malformed assistant stream', 502, 'malformed_response');
  let payload: unknown;
  try { payload = JSON.parse(data); }
  catch { throw new AIRequestError('Malformed assistant stream', 502, 'malformed_response'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AIRequestError('Malformed assistant stream', 502, 'malformed_response');
  return { type: eventType as AIStreamEvent['type'], data: payload as Record<string, unknown> };
}

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    throw new AIRequestError(
      typeof detail === 'string' ? detail : detail?.message || 'AI request failed',
      response.status,
      typeof detail === 'object' && typeof detail?.code === 'string' ? detail.code : 'provider_error',
    );
  }
  return payload as T;
}

export function readAIAdminBootstrap(token: string): Promise<AIAdminBootstrap> {
  return fetch(`${backendUrl}/api/admin/ai/bootstrap`, { headers: headers(token) }).then(parse<AIAdminBootstrap>);
}

export function readAIAccess(token: string): Promise<AIAccessBootstrap> {
  return fetch(`${backendUrl}/api/ai/access`, { headers: headers(token) }).then(parse<AIAccessBootstrap>);
}

export function createAIProvider(token: string, input: AIProviderInput): Promise<AIProviderConfig> {
  return fetch(`${backendUrl}/api/admin/ai/providers`, { method: 'POST', headers: headers(token), body: JSON.stringify(input) }).then(parse<AIProviderConfig>);
}

export function updateAIProvider(token: string, providerId: number, input: Partial<AIProviderInput>): Promise<AIProviderConfig> {
  return fetch(`${backendUrl}/api/admin/ai/providers/${providerId}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(input) }).then(parse<AIProviderConfig>);
}

export function updateAISettings(token: string, settings: Pick<AIInstanceSettings, 'enabled' | 'defaultProviderId' | 'requestLimit' | 'tokenLimit' | 'reportLocalUsage' | 'usageRetentionDays'>): Promise<AIInstanceSettings> {
  return fetch(`${backendUrl}/api/admin/ai/settings`, { method: 'PUT', headers: headers(token), body: JSON.stringify(settings) }).then(parse<AIInstanceSettings>);
}

export async function reportAILocalUsage(token: string, input: {
  providerId: number;
  capability: AICapabilityId;
  requestId: string;
  startedAt: string;
  outcome: 'completed' | 'cancelled' | 'runtime_error';
  inputTokens?: number;
  outputTokens?: number;
  estimated: boolean;
}): Promise<void> {
  const response = await fetch(`${backendUrl}/api/ai/usage`, { method: 'POST', headers: headers(token), body: JSON.stringify(input) });
  if (!response.ok) await parse(response);
}

export function putAIPolicy(token: string, input: {
  scopeType: AIScopeType;
  scopeKey: string;
  capability: AICapabilityId;
  effect: AIPolicyEffect;
  providerIds?: number[];
  runtimes?: string[];
}): Promise<AIPolicyRule> {
  return fetch(`${backendUrl}/api/admin/ai/policies`, { method: 'PUT', headers: headers(token), body: JSON.stringify(input) }).then(parse<AIPolicyRule>);
}

export async function deleteAIPolicy(token: string, scopeType: AIScopeType, scopeKey: string, capability: AICapabilityId): Promise<void> {
  const query = new URLSearchParams({ scopeType, scopeKey, capability });
  const response = await fetch(`${backendUrl}/api/admin/ai/policies?${query}`, { method: 'DELETE', headers: headers(token) });
  if (!response.ok) await parse(response);
}

export function resolveAIAccess(token: string, userId: number, capability: AICapabilityId): Promise<AIAccessDecision> {
  return fetch(`${backendUrl}/api/admin/ai/resolve`, { method: 'POST', headers: headers(token), body: JSON.stringify({ userId, capability }) }).then(parse<AIAccessDecision>);
}

export function testAIProvider(token: string, providerId: number): Promise<{ ok: boolean; modelFound?: boolean | null }> {
  return fetch(`${backendUrl}/api/admin/ai/providers/${providerId}/test`, { method: 'POST', headers: headers(token) }).then(parse<{ ok: boolean; modelFound?: boolean | null }>);
}

export async function streamAIAssist(
  token: string,
  input: AIAssistInput,
  onEvent: (event: AIStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${backendUrl}/api/ai/assist/stream`, {
    method: 'POST',
    headers: { ...headers(token), Accept: 'text/event-stream' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) await parse(response);
  if (!response.body) throw new AIRequestError('Streaming is unavailable', 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawStart = false;
  let sawTerminal = false;
  const dispatch = (frame: string) => {
    const event = parseAIStreamFrame(frame);
    if (sawTerminal || (!sawStart && event.type !== 'start') || (sawStart && event.type === 'start')) throw new AIRequestError('Malformed assistant stream', 502, 'malformed_response');
    if (event.type === 'start') sawStart = true;
    if (event.type === 'done' || event.type === 'error') sawTerminal = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      frames.filter((frame) => frame.trim()).forEach(dispatch);
      if (done) {
        if (buffer.trim()) dispatch(buffer);
        break;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (!sawStart || !sawTerminal) throw new AIRequestError('Incomplete assistant stream', 502, 'malformed_response');
}
