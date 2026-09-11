import { normalizeTiptapDocument, richTextActivity, textFromTiptap } from './courseAuthoring';
import type { Lesson } from './types';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('course authoring rich text', () => {
  it('normalizes missing legacy content to an editable document', () => {
    expect(normalizeTiptapDocument(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });

    const lesson = {
      lesson_key: 'legacy',
      activities: [{ key: 'content-legacy', type: 'rich_text', version: 1, required: false, content: null }],
    } as unknown as Pick<Lesson, 'lesson_key' | 'activities'>;

    expect(richTextActivity(lesson).content).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('ignores sparse document children while extracting text', () => {
    expect(textFromTiptap({ type: 'doc', content: [null, { type: 'paragraph', content: [{ type: 'text', text: 'Ready' }] }] } as any)).toBe('Ready');
  });
});
