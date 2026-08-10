import type { AIAssistantSuggestion } from '../types';
import { parseCodeSuggestion } from './codeSuggestions';
import { parseLessonSuggestion } from './lessonSuggestions';

export function parseAssistantSuggestion(value: Record<string, unknown>): AIAssistantSuggestion {
  return value.type === 'lesson_operations' ? parseLessonSuggestion(value) : parseCodeSuggestion(value);
}
