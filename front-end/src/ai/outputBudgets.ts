import type { AICapabilityId } from './types';

const OUTPUT_TOKEN_BUDGETS: Record<AICapabilityId, number> = {
  'code.explain': 1024,
  'code.suggest_changes': 4096,
  'blockly.explain': 1024,
  'blockly.suggest_changes': 6144,
  'lesson.draft': 6144,
  'lesson.suggest_changes': 6144,
  'stage.create': 8192,
  'stage.suggest_changes': 8192,
};

export const outputTokenBudget = (capability: AICapabilityId) => OUTPUT_TOKEN_BUDGETS[capability];
