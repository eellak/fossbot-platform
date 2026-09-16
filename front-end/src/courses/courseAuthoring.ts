import type { Lesson, RichTextActivity, TiptapNode } from './types';

export const emptyTiptapDocument = (): TiptapNode => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export function normalizeTiptapDocument(content: unknown): TiptapNode {
  if (content && typeof content === 'object' && typeof (content as TiptapNode).type === 'string') {
    return content as TiptapNode;
  }
  if (typeof content === 'string' && content) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] };
  }
  return emptyTiptapDocument();
}

export function richTextActivity(lesson: Pick<Lesson, 'lesson_key' | 'activities'>): RichTextActivity {
  const activity = lesson.activities?.find((item): item is RichTextActivity => item.type === 'rich_text');
  if (activity && activity.content && typeof activity.content === 'object') {
    return { ...activity, version: 1, required: activity.required ?? false, content: normalizeTiptapDocument(activity.content) };
  }
  return {
    key: activity?.key || `content-${lesson.lesson_key}`,
    type: 'rich_text',
    version: 1,
    required: activity?.required ?? false,
    content: normalizeTiptapDocument(activity?.content),
  };
}

export function textFromTiptap(node?: TiptapNode | null): string {
  if (!node) return '';
  const own = node.text || '';
  const children = (node.content || []).map(textFromTiptap).filter(Boolean);
  return [own, ...children].filter(Boolean).join(node.type === 'paragraph' ? ' ' : '\n').trim();
}

export function moveLesson(lessons: Lesson[], lessonId: number, direction: -1 | 1): Lesson[] {
  const from = lessons.findIndex((lesson) => lesson.id === lessonId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= lessons.length) return lessons;
  const next = [...lessons];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((lesson, index) => ({ ...lesson, position: index + 1 }));
}
