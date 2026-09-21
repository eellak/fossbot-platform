import React, { useEffect, useRef } from 'react';
import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { IconBold, IconCode, IconH2, IconItalic, IconList, IconListNumbers } from '@tabler/icons-react';
import { looksLikeMarkdown, markdownToTiptap } from 'src/courses/courseAuthoring';
import type { TiptapNode } from 'src/courses/types';
import { lessonProseMeasure } from './courseContentStyles';

interface RichTextEditorProps {
  value: TiptapNode;
  onChange: (value: TiptapNode) => void;
  labels: { content: string; bold: string; italic: string; code: string; heading: string; bullets: string; numbered: string };
}

// Clipboard HTML that already carries structure keeps its native paste behaviour.
const structuredHtmlPattern = /<(h[1-6]|p|ul|ol|li|pre|code|blockquote|table|strong|em|b|i|a|img)\b/i;

function markdownPaste(editor: Editor, event: ClipboardEvent): boolean {
  if (editor.isActive('codeBlock')) return false;
  const clipboard = event.clipboardData;
  if (!clipboard) return false;
  const html = clipboard.getData('text/html');
  if (html && structuredHtmlPattern.test(html)) return false;
  const text = clipboard.getData('text/plain');
  if (!text || !looksLikeMarkdown(text)) return false;
  const document = markdownToTiptap(text);
  if (!document.content?.length) return false;
  // Inserting the converted nodes keeps Markdown from landing as a wall of literal # and * characters.
  return editor.chain().focus().insertContent(document.content).run();
}

export default function RichTextEditor({ value, onChange, labels }: RichTextEditorProps) {
  const pasteHandler = useRef<(event: ClipboardEvent) => boolean>(() => false);
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: { 'aria-label': labels.content, class: 'course-rich-text' },
      handlePaste: (_view, event) => pasteHandler.current(event),
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as TiptapNode),
  });

  useEffect(() => {
    if (!editor) return;
    pasteHandler.current = (event) => markdownPaste(editor, event);
  }, [editor]);

  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  const tools = [
    { label: labels.bold, icon: <IconBold size={18} />, active: editor.isActive('bold'), action: () => editor.chain().focus().toggleBold().run() },
    { label: labels.italic, icon: <IconItalic size={18} />, active: editor.isActive('italic'), action: () => editor.chain().focus().toggleItalic().run() },
    { label: labels.code, icon: <IconCode size={18} />, active: editor.isActive('code'), action: () => editor.chain().focus().toggleCode().run() },
    { label: labels.heading, icon: <IconH2 size={18} />, active: editor.isActive('heading', { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: labels.bullets, icon: <IconList size={18} />, active: editor.isActive('bulletList'), action: () => editor.chain().focus().toggleBulletList().run() },
    { label: labels.numbered, icon: <IconListNumbers size={18} />, active: editor.isActive('orderedList'), action: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={0.25} sx={{ p: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        {tools.map((tool) => (
          <Tooltip title={tool.label} key={tool.label}>
            <IconButton size="small" color={tool.active ? 'primary' : 'default'} onClick={tool.action} aria-label={tool.label} aria-pressed={tool.active}>
              {tool.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
      <Box sx={{
        '& .course-rich-text': { minHeight: 280, px: 2.5, py: 2, outline: 0, lineHeight: 1.65, maxWidth: lessonProseMeasure, overflowWrap: 'anywhere' },
        '& .course-rich-text > :first-of-type': { mt: 0 },
        '& .course-rich-text > :last-child': { mb: 0 },
        '& .course-rich-text p': { my: 1.5 },
        '& .course-rich-text h1, & .course-rich-text h2, & .course-rich-text h3, & .course-rich-text h4, & .course-rich-text h5, & .course-rich-text h6': { fontWeight: 600, lineHeight: 1.35, mt: 3, mb: 1 },
        '& .course-rich-text h1': { fontSize: '1.5rem' },
        '& .course-rich-text h2': { fontSize: '1.35rem' },
        '& .course-rich-text h3': { fontSize: '1.125rem' },
        '& .course-rich-text h4, & .course-rich-text h5, & .course-rich-text h6': { fontSize: '1rem' },
        '& .course-rich-text ul, & .course-rich-text ol': { my: 1.5, pl: 3 },
        '& .course-rich-text li': { my: 0.25 },
        '& .course-rich-text blockquote': { mx: 0, my: 1.5, pl: 1.5, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' },
        '& .course-rich-text code': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.875em', px: 0.5, py: 0.25, bgcolor: 'action.hover', borderRadius: 0.5 },
        '& .course-rich-text pre': { my: 1.5, p: 1.5, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1, '& code': { p: 0, bgcolor: 'transparent', fontSize: '0.8125rem' } },
        '& .course-rich-text a': { color: 'primary.main' },
        '& .course-rich-text hr': { my: 2, border: 0, borderTop: 1, borderColor: 'divider' },
      }}><EditorContent editor={editor} /></Box>
    </Box>
  );
}
