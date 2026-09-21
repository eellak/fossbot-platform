import { looksLikeMarkdown, markdownToTiptap, normalizeTiptapDocument, richTextActivity, textFromTiptap } from './courseAuthoring';
import type { Lesson, TiptapNode } from './types';

declare const describe: any;
declare const expect: any;
declare const it: any;

const marksOf = (node: TiptapNode | undefined) => (node?.marks || []).map((mark) => mark.type);

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

  it('leaves an already structured document untouched', () => {
    const document: TiptapNode = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Kept' }] }, { type: 'paragraph' }] };
    expect(normalizeTiptapDocument(document)).toBe(document);
  });
});

describe('markdown to tiptap conversion', () => {
  it('converts headings, paragraphs, lists, fenced code, and inline marks', () => {
    const document = markdownToTiptap([
      '# Title',
      '',
      'Intro with **bold**, *italic*, `code` and a [link](https://example.com).',
      '',
      '- first',
      '- second',
      '',
      '1. one',
      '2. two',
      '',
      '```python',
      'print("hi")',
      '```',
    ].join('\n'));

    const [heading, intro, bullets, ordered, code] = document.content as TiptapNode[];
    expect(heading.type).toBe('heading');
    expect(heading.attrs?.level).toBe(1);
    expect(textFromTiptap(heading)).toBe('Title');

    expect(intro.type).toBe('paragraph');
    const marks = (intro.content || []).map(marksOf);
    expect(marks).toContainEqual(['bold']);
    expect(marks).toContainEqual(['italic']);
    expect(marks).toContainEqual(['code']);
    expect(marks).toContainEqual(['link']);
    expect((intro.content || []).find((node) => marksOf(node).includes('link'))?.marks?.[0].attrs?.href).toBe('https://example.com');

    expect(bullets.type).toBe('bulletList');
    expect(bullets.content?.length).toBe(2);
    expect(ordered.type).toBe('orderedList');
    expect(ordered.attrs?.start).toBe(1);
    expect(ordered.content?.length).toBe(2);

    expect(code.type).toBe('codeBlock');
    expect(code.attrs?.language).toBe('python');
    expect(textFromTiptap(code)).toBe('print("hi")');
  });

  it('recovers Markdown from the single-paragraph document the old editor produced', () => {
    const converted: TiptapNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '# Title\n\nBody text' }] }] };
    const document = normalizeTiptapDocument(converted);
    expect(document.content?.map((node) => node.type)).toEqual(['heading', 'paragraph']);
    expect(textFromTiptap(document)).toBe('Title\nBody text');
  });

  it('keeps a plain single paragraph as a paragraph', () => {
    const document = normalizeTiptapDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Override the method when needed.' }] }] });
    expect(document.content?.map((node) => node.type)).toEqual(['paragraph']);
    expect(textFromTiptap(document)).toBe('Override the method when needed.');
  });

  it('starts an ordered list at its authored number', () => {
    const ordered = markdownToTiptap('3. three\n4. four').content?.[0];
    expect(ordered?.type).toBe('orderedList');
    expect(ordered?.attrs?.start).toBe(3);
  });

  it('detects only plain text bodies that carry Markdown syntax', () => {
    expect(looksLikeMarkdown('# Title')).toBe(true);
    expect(looksLikeMarkdown('- first\n- second')).toBe(true);
    expect(looksLikeMarkdown('Use `code` here.')).toBe(true);
    expect(looksLikeMarkdown('Override the method when needed.')).toBe(false);
  });
});
