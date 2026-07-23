import type { Lesson, RichTextActivity, TiptapNode } from './types';

export const emptyTiptapDocument = (): TiptapNode => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export function richTextActivity(lesson: Pick<Lesson, 'lesson_key' | 'activities'>): RichTextActivity {
  const activity = lesson.activities?.find((item) => item.type === 'rich_text');
  if (activity && typeof activity.content === 'object') {
    return { ...activity, version: 1 };
  }
  const legacy = activity && typeof activity.content === 'string' ? activity.content : '';
  return {
    key: activity?.key || `content-${lesson.lesson_key}`,
    type: 'rich_text',
    version: 1,
    content: legacy
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: legacy }] }] }
      : emptyTiptapDocument(),
  };
}

export function textFromTiptap(node?: TiptapNode | null): string {
  if (!node) return '';
  const own = node.text || '';
  const children = (node.content || []).map(textFromTiptap).filter(Boolean);
  return [own, ...children].filter(Boolean).join(node.type === 'paragraph' ? ' ' : '\n').trim();
}

export function inheritanceChanges(before: Lesson[], after: Lesson[]): number[] {
  const previousByLesson = new Map<number, number | null>();
  before.forEach((lesson, index) => previousByLesson.set(lesson.id, before[index - 1]?.id || null));
  return after
    .filter((lesson, index) => lesson.start_mode === 'inherit_previous_code' && previousByLesson.get(lesson.id) !== (after[index - 1]?.id || null))
    .map((lesson) => lesson.id);
}

export function moveLesson(lessons: Lesson[], lessonId: number, direction: -1 | 1): Lesson[] {
  const from = lessons.findIndex((lesson) => lesson.id === lessonId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= lessons.length) return lessons;
  const next = [...lessons];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((lesson, index) => ({ ...lesson, position: index + 1 }));
}
