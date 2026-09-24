import type { AIAssistantAnswer, AIAssistantOutcome, AIAssistantSuggestion } from '../types';
import { parseCodeSuggestion } from './codeSuggestions';
import { parseLessonSuggestion } from './lessonSuggestions';
import { parseStageSuggestion } from './stageSuggestions';

export function parseAssistantSuggestion(value: Record<string, unknown>): AIAssistantSuggestion {
  if (value.type === 'lesson_operations') return parseLessonSuggestion(value);
  if (value.type === 'stage_operations') return parseStageSuggestion(value);
  return parseCodeSuggestion(value);
}

export function parseAssistantOutcome(value: Record<string, unknown>): AIAssistantOutcome {
  if (value.type !== 'answer') return parseAssistantSuggestion(value);
  if (value.version !== '1' || typeof value.baseFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.baseFingerprint) || typeof value.content !== 'string' || !value.content.trim()) {
    throw new Error('invalid_suggestion');
  }
  return value as unknown as AIAssistantAnswer;
}
