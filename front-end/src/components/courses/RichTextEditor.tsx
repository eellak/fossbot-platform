import React, { useEffect } from 'react';
import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { IconBold, IconH2, IconItalic, IconList, IconListNumbers } from '@tabler/icons-react';
import type { TiptapNode } from 'src/courses/types';

interface RichTextEditorProps {
  value: TiptapNode;
  onChange: (value: TiptapNode) => void;
  labels: { content: string; bold: string; italic: string; heading: string; bullets: string; numbered: string };
}

export default function RichTextEditor({ value, onChange, labels }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: { attributes: { 'aria-label': labels.content, class: 'course-rich-text' } },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as TiptapNode),
  });

  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  const tools = [
    { label: labels.bold, icon: <IconBold size={18} />, active: editor.isActive('bold'), action: () => editor.chain().focus().toggleBold().run() },
    { label: labels.italic, icon: <IconItalic size={18} />, active: editor.isActive('italic'), action: () => editor.chain().focus().toggleItalic().run() },
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
        '& .course-rich-text': { minHeight: 280, px: 2.5, py: 2, outline: 0, lineHeight: 1.65, maxWidth: '75ch' },
        '& .course-rich-text p': { my: 1 },
        '& .course-rich-text h2': { mt: 2.5, mb: 1, fontSize: '1.35rem' },
      }}><EditorContent editor={editor} /></Box>
    </Box>
  );
}
