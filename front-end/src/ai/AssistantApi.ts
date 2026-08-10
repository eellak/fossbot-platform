import type {
  AIAdminBootstrap,
  AIAccessDecision,
  AICapabilityId,
  AIInstanceSettings,
  AIPolicyEffect,
  AIPolicyRule,
  AIProviderConfig,
  AIProviderInput,
  AIScopeType,
} from './types';

const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export class AIRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AIRequestError';
    this.status = status;
  }
}

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    throw new AIRequestError(typeof detail === 'string' ? detail : detail?.detail || 'AI request failed', response.status);
  }
  return payload as T;
}

export function readAIAdminBootstrap(token: string): Promise<AIAdminBootstrap> {
  return fetch(`${backendUrl}/api/admin/ai/bootstrap`, { headers: headers(token) }).then(parse<AIAdminBootstrap>);
}

export function createAIProvider(token: string, input: AIProviderInput): Promise<AIProviderConfig> {
  return fetch(`${backendUrl}/api/admin/ai/providers`, { method: 'POST', headers: headers(token), body: JSON.stringify(input) }).then(parse<AIProviderConfig>);
}

export function updateAIProvider(token: string, providerId: number, input: Partial<AIProviderInput>): Promise<AIProviderConfig> {
  return fetch(`${backendUrl}/api/admin/ai/providers/${providerId}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(input) }).then(parse<AIProviderConfig>);
}

export function updateAISettings(token: string, settings: Pick<AIInstanceSettings, 'enabled' | 'defaultProviderId' | 'requestLimit' | 'tokenLimit'>): Promise<AIInstanceSettings> {
  return fetch(`${backendUrl}/api/admin/ai/settings`, { method: 'PUT', headers: headers(token), body: JSON.stringify(settings) }).then(parse<AIInstanceSettings>);
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
