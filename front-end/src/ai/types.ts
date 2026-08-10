export type AICapabilityId =
  | 'code.explain'
  | 'code.suggest_changes'
  | 'blockly.explain'
  | 'blockly.suggest_changes'
  | 'lesson.draft'
  | 'lesson.suggest_changes'
  | 'stage.create'
  | 'stage.suggest_changes';

export type AIProviderType = 'openai' | 'google' | 'openai_compatible' | 'webllm';
export type AIRuntime = 'hosted' | 'browser' | 'user_local';
export type AIPolicyEffect = 'allow' | 'deny';
export type AIScopeType = 'instance' | 'role' | 'class_group' | 'user';

export interface AICapabilityDefinition {
  id: AICapabilityId;
  category: string;
  explanationOnly: boolean;
}

export interface AIProviderConfig {
  id: number;
  name: string;
  providerType: AIProviderType;
  runtime: AIRuntime;
  enabled: boolean;
  model: string;
  baseUrl?: string | null;
  settings: Record<string, unknown>;
  requestLimit?: number | null;
  tokenLimit?: number | null;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIInstanceSettings {
  enabled: boolean;
  defaultProviderId?: number | null;
  requestLimit?: number | null;
  tokenLimit?: number | null;
  registryVersion: string;
  updatedAt: string;
}

export interface AIPolicyRule {
  id: number;
  scopeType: AIScopeType;
  scopeKey: string;
  capability: AICapabilityId;
  effect: AIPolicyEffect;
  providerIds: number[];
  runtimes: AIRuntime[];
  updatedAt: string;
}

export interface AIUserReference { id: number; username: string; role: string }
export interface AIGroupReference { id: number; name: string; status: string }

export interface AIAdminBootstrap {
  schemaVersion: '1';
  registryVersion: string;
  capabilities: AICapabilityDefinition[];
  settings: AIInstanceSettings;
  providers: AIProviderConfig[];
  policies: AIPolicyRule[];
  users: AIUserReference[];
  groups: AIGroupReference[];
}

export interface AIAccessDecision {
  capability: AICapabilityId;
  allowed: boolean;
  reasonCode: string;
  detail: string;
  winningScope?: string | null;
  winningRuleId?: number | null;
  providerIds: number[];
  runtimes: AIRuntime[];
  defaultProviderId?: number | null;
  limits: { requests?: number | null; tokens?: number | null };
  policyVersion: string;
  userId?: number;
  username?: string;
}

export interface AIProviderInput {
  name: string;
  providerType: AIProviderType;
  runtime: AIRuntime;
  enabled: boolean;
  model: string;
  baseUrl?: string | null;
  settings: Record<string, unknown> & { version: '1' };
  secret?: string;
  secretAction?: 'preserve' | 'rotate' | 'clear';
}

export type AIStreamEventType = 'start' | 'text_delta' | 'suggestion' | 'usage' | 'done' | 'error';
export interface AIStreamEvent { type: AIStreamEventType; data: Record<string, unknown> }
