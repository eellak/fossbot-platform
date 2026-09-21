import type { Lesson, RichTextActivity, TiptapNode } from './types';

export const emptyTiptapDocument = (): TiptapNode => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

type TiptapMark = NonNullable<TiptapNode['marks']>[number];

const textNode = (text: string, marks: TiptapMark[] = []): TiptapNode => ({
  type: 'text',
  text,
  ...(marks.length ? { marks } : {}),
});

function inlineTiptapNodes(source: string, marks: TiptapMark[] = []): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  const appendText = (text: string, nextMarks = marks) => {
    if (!text) return;
    const previous = nodes[nodes.length - 1];
    if (previous?.type === 'text' && JSON.stringify(previous.marks || []) === JSON.stringify(nextMarks)) {
      previous.text = `${previous.text || ''}${text}`;
      return;
    }
    nodes.push(textNode(text, nextMarks));
  };
  let index = 0;

  while (index < source.length) {
    if (source[index] === '\n') {
      nodes.push({ type: 'hardBreak' });
      index += 1;
      continue;
    }
    if (source[index] === '\\' && index + 1 < source.length && /[\\`*_[\]()]/.test(source[index + 1])) {
      appendText(source[index + 1]);
      index += 2;
      continue;
    }
    if (source[index] === '`') {
      const opening = source.slice(index).match(/^`+/)?.[0] || '`';
      const closing = source.indexOf(opening, index + opening.length);
      if (closing >= 0) {
        let code = source.slice(index + opening.length, closing).replace(/\n/g, ' ');
        if (/^\s.*\s$/.test(code) && /\S/.test(code)) code = code.slice(1, -1);
        appendText(code, [...marks, { type: 'code' }]);
        index = closing + opening.length;
        continue;
      }
    }
    if (source[index] === '[') {
      const link = source.slice(index).match(/^\[([^\]\n]+)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/);
      if (link) {
        const linkMark: TiptapMark = {
          type: 'link',
          attrs: {
            href: link[2],
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
            class: null,
            title: link[3] || null,
          },
        };
        nodes.push(...inlineTiptapNodes(link[1], [...marks, linkMark]));
        index += link[0].length;
        continue;
      }
    }
    const delimiter = source.startsWith('**', index) ? '**' : source.startsWith('__', index) ? '__' : '';
    if (delimiter) {
      const closing = source.indexOf(delimiter, index + delimiter.length);
      if (closing > index + delimiter.length) {
        nodes.push(...inlineTiptapNodes(source.slice(index + delimiter.length, closing), [...marks, { type: 'bold' }]));
        index = closing + delimiter.length;
        continue;
      }
    }
    if ((source[index] === '*' || source[index] === '_') && !/\s/.test(source[index + 1] || '')) {
      const closing = source.indexOf(source[index], index + 1);
      if (closing > index + 1) {
        nodes.push(...inlineTiptapNodes(source.slice(index + 1, closing), [...marks, { type: 'italic' }]));
        index = closing + 1;
        continue;
      }
    }

    const next = source.slice(index + 1).search(/[\n\\`*_[\]]/);
    const end = next < 0 ? source.length : index + 1 + next;
    appendText(source.slice(index, end === index ? index + 1 : end));
    index = end === index ? index + 1 : end;
  }
  return nodes;
}

const paragraphNode = (source: string): TiptapNode => {
  const content = inlineTiptapNodes(source);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
};

const headingMatch = (line: string) => line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/);
const bulletMatch = (line: string) => line.match(/^ {0,3}[-+*][ \t]+(.*)$/);
const orderedMatch = (line: string) => line.match(/^ {0,3}(\d+)[.)][ \t]+(.*)$/);
const fenceMatch = (line: string) => line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/);
const quoteMatch = (line: string) => line.match(/^ {0,3}>[ \t]?(.*)$/);
const horizontalRule = (line: string) => /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
const startsBlock = (line: string) => Boolean(headingMatch(line) || bulletMatch(line) || orderedMatch(line) || fenceMatch(line) || quoteMatch(line) || horizontalRule(line));

export function markdownToTiptap(source: string): TiptapNode {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const content: TiptapNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = fenceMatch(line);
    if (fence) {
      const marker = fence[1];
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const code = codeLines.join('\n');
      content.push({
        type: 'codeBlock',
        attrs: { language: fence[2] || null },
        ...(code ? { content: [textNode(code)] } : {}),
      });
      continue;
    }

    const heading = headingMatch(line);
    if (heading) {
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: inlineTiptapNodes(heading[2]) });
      index += 1;
      continue;
    }
    if (index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1]) && line.trim()) {
      content.push({ type: 'heading', attrs: { level: lines[index + 1].trim()[0] === '=' ? 1 : 2 }, content: inlineTiptapNodes(line.trim()) });
      index += 2;
      continue;
    }
    if (horizontalRule(line)) {
      content.push({ type: 'horizontalRule' });
      index += 1;
      continue;
    }

    const quote = quoteMatch(line);
    if (quote) {
      const quoted = [quote[1]];
      index += 1;
      while (index < lines.length) {
        const nextQuote = quoteMatch(lines[index]);
        if (!nextQuote) break;
        quoted.push(nextQuote[1]);
        index += 1;
      }
      content.push({ type: 'blockquote', content: markdownToTiptap(quoted.join('\n')).content });
      continue;
    }

    const bullet = bulletMatch(line);
    const ordered = orderedMatch(line);
    if (bullet || ordered) {
      const orderedList = Boolean(ordered);
      const items: TiptapNode[] = [];
      const start = ordered ? Number(ordered[1]) : 1;
      while (index < lines.length) {
        const item = orderedList ? orderedMatch(lines[index]) : bulletMatch(lines[index]);
        if (!item) break;
        items.push({ type: 'listItem', content: [paragraphNode(item[orderedList ? 2 : 1])] });
        index += 1;
      }
      content.push(orderedList
        ? { type: 'orderedList', attrs: { start, type: null }, content: items }
        : { type: 'bulletList', content: items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) {
      if (index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1])) break;
      paragraphLines.push(lines[index]);
      index += 1;
    }
    content.push(paragraphNode(paragraphLines.join('\n')));
  }

  return content.length ? { type: 'doc', content } : emptyTiptapDocument();
}

const markdownBlockPattern = /^ {0,3}(?:#{1,6}[ \t]+\S|(?:`{3,}|~{3,})|>[ \t]?\S|(?:[-+*]|\d{1,9}[.)])[ \t]+\S)/m;
const markdownInlinePattern = /`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\)/;

/** True when a plain text body carries enough Markdown syntax to be worth converting. */
export const looksLikeMarkdown = (text: string): boolean => markdownBlockPattern.test(text) || markdownInlinePattern.test(text);

function plainParagraphSource(content: TiptapNode): string | null {
  if (content.type !== 'doc' || content.content?.length !== 1 || content.content[0]?.type !== 'paragraph') return null;
  const children = content.content[0].content || [];
  if (children.some((child) => child.type !== 'text' || child.marks?.length || typeof child.text !== 'string')) return null;
  return children.map((child) => child.text).join('');
}

export function normalizeTiptapDocument(content: unknown): TiptapNode {
  if (typeof content === 'string') return markdownToTiptap(content);
  if (content && typeof content === 'object' && typeof (content as TiptapNode).type === 'string') {
    const document = content as TiptapNode;
    const source = plainParagraphSource(document);
    return source === null ? document : markdownToTiptap(source);
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
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'text') return node.text || '';
  const children = (node.content || []).map(textFromTiptap).filter(Boolean);
  // Inline runs inside a text block read as one line; stacked blocks read as separate lines.
  const separator = node.type === 'paragraph' || node.type === 'heading' ? '' : '\n';
  return children.join(separator).trim();
}

export function moveLesson(lessons: Lesson[], lessonId: number, direction: -1 | 1): Lesson[] {
  const from = lessons.findIndex((lesson) => lesson.id === lessonId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= lessons.length) return lessons;
  const next = [...lessons];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((lesson, index) => ({ ...lesson, position: index + 1 }));
}
