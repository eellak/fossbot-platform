import type { AIAssistantSuggestion } from '../types';
import { parseCodeSuggestion } from './codeSuggestions';
import { parseLessonSuggestion } from './lessonSuggestions';
import { parseStageSuggestion } from './stageSuggestions';

export function parseAssistantSuggestion(value: Record<string, unknown>): AIAssistantSuggestion {
  if (value.type === 'lesson_operations') return parseLessonSuggestion(value);
  if (value.type === 'stage_operations') return parseStageSuggestion(value);
  return parseCodeSuggestion(value);
}
