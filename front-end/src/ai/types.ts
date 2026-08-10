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

export interface AIPublicProvider {
  id: number;
  name: string;
  providerType: AIProviderType;
  runtime: AIRuntime;
  model: string;
  settings: Record<string, unknown>;
}

export interface AIInstanceSettings {
  enabled: boolean;
  reportLocalUsage: boolean;
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

export interface AIAccessBootstrap {
  schemaVersion: '1';
  registryVersion: string;
  instanceEnabled: boolean;
  reportLocalUsage: boolean;
  capabilities: AIAccessDecision[];
  providers: AIPublicProvider[];
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

export type AIRuntimeReadiness = 'idle' | 'checking' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface AIRuntimeStatus {
  readiness: AIRuntimeReadiness;
  progress?: number;
  message?: string;
  cached?: boolean;
}

export type AIAssistantSurface = 'python' | 'blockly' | 'lesson' | 'stage' | 'probe';
export interface AIAssistInput {
  capability: AICapabilityId;
  providerId?: number;
  surface: AIAssistantSurface;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: Record<string, unknown>;
}

export interface PythonReplaceSuggestion {
  version: '1';
  type: 'python_replace';
  baseFingerprint: string;
  replacement: string;
  summary: string;
}

export interface BlocklyReplaceSuggestion {
  version: '1';
  type: 'blockly_replace';
  baseFingerprint: string;
  xml: string;
  summary: string;
}

export type LessonOperation = {
  op: 'update_course' | 'update_lesson' | 'insert_activity' | 'replace_activity' | 'remove_activity' | 'reorder_activities';
  lessonId?: number;
  activityKey?: string;
  index?: number;
  coursePatch?: { title?: string; description?: string; learningObjectives?: string[] };
  lessonPatch?: { title?: string };
  activity?: Record<string, unknown>;
  activityKeys?: string[];
};

export interface LessonAuthoringSuggestion {
  version: '1';
  type: 'lesson_operations';
  baseRevision: string;
  operations: LessonOperation[];
  summary: string;
}

export type StageOperation = {
  op: 'set_metadata' | 'set_floor' | 'add_object' | 'update_object' | 'move_object' | 'rotate_object' | 'resize_object' | 'set_line_points' | 'remove_object' | 'group_objects' | 'ungroup_objects';
  objectId?: string;
  tempId?: string;
  semanticKind?: string;
  position?: number[];
  dimensions?: number[];
  rotationY?: number;
  points?: number[][];
  patch?: Record<string, unknown>;
  objectIds?: string[];
  groupName?: string;
};

export interface StageAuthoringSuggestion {
  version: '1';
  type: 'stage_operations';
  baseFingerprint: string;
  rationale: string;
  operations: StageOperation[];
  expectedValidation: string;
  summary: string;
}

export type AICodeSuggestion = PythonReplaceSuggestion | BlocklyReplaceSuggestion;
export type AIAssistantSuggestion = AICodeSuggestion | LessonAuthoringSuggestion | StageAuthoringSuggestion;
