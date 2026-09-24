import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { normalizeTiptapDocument } from 'src/courses/courseAuthoring';
import type { TiptapNode } from 'src/courses/types';
import { lessonProseSx } from './courseContentStyles';

// Only common safe protocols are rendered as links; anything else stays inert text.
function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const value = href.trim();
  if (!value || value.startsWith('//')) return null;
  if (value.startsWith('#') || value.startsWith('/')) return value;
  return /^(?:https?:|mailto:|tel:)/i.test(value) ? value : null;
}

function renderNode(node: TiptapNode | null | undefined, key: number | string): React.ReactNode {
  if (!node) return null;
  const children = node.content?.map((child, index) => renderNode(child, index));
  if (node.type === 'text') {
    let content: React.ReactNode = node.text || '';
    node.marks?.forEach((mark) => {
      if (mark.type === 'bold') content = <strong>{content}</strong>;
      if (mark.type === 'italic') content = <em>{content}</em>;
      if (mark.type === 'strike') content = <s>{content}</s>;
      if (mark.type === 'underline') content = <u>{content}</u>;
      if (mark.type === 'code') content = <code>{content}</code>;
      if (mark.type === 'link') {
        const href = safeHref(mark.attrs?.href);
        if (href) content = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{content}</a>;
      }
    });
    return <React.Fragment key={key}>{content}</React.Fragment>;
  }
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'horizontalRule') return <Box key={key} component="hr" />;
  if (node.type === 'heading') {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
    return <Typography key={key} variant="inherit" component={`h${level}` as 'h1'}>{children}</Typography>;
  }
  if (node.type === 'bulletList') return <Box key={key} component="ul">{children}</Box>;
  if (node.type === 'orderedList') return <Box key={key} component="ol" start={Number(node.attrs?.start) || 1}>{children}</Box>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'codeBlock') return <Box key={key} component="pre"><code>{children}</code></Box>;
  if (node.type === 'blockquote') return <Box key={key} component="blockquote">{children}</Box>;
  if (node.type === 'paragraph') return <Typography key={key} variant="inherit" component="p">{children}</Typography>;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

const richTextSx: SxProps<Theme> = {
  ...lessonProseSx,
  // Authored text keeps its soft line breaks; rich text uses separate nodes.
  whiteSpace: 'pre-wrap',
  '& > :first-of-type': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& p': { my: 1.5 },
  '& h1, & h2, & h3, & h4, & h5, & h6': { fontWeight: 600, lineHeight: 1.35, mt: 3, mb: 1 },
  '& h1': { fontSize: '1.5rem' },
  '& h2': { fontSize: '1.25rem' },
  '& h3': { fontSize: '1.125rem' },
  '& h4, & h5, & h6': { fontSize: '1rem' },
  '& ul, & ol': { my: 1.5, pl: 3 },
  '& li': { mb: 0.5 },
  '& li > ul, & li > ol': { my: 0.5 },
  '& blockquote': { mx: 0, my: 1.5, pl: 1.5, borderLeft: 3, borderColor: 'divider', color: 'text.secondary' },
  '& code': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.875em', px: 0.5, py: 0.25, bgcolor: 'action.hover', borderRadius: 0.5 },
  '& pre': { my: 1.5, p: 1.5, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1, '& code': { p: 0, bgcolor: 'transparent', fontSize: '0.8125rem' } },
  '& a': { color: 'primary.main' },
  '& hr': { my: 2, border: 0, borderTop: 1, borderColor: 'divider' },
};

export default function RichTextContent({ content }: { content: TiptapNode | string | null | undefined }) {
  // Both stored Markdown strings and legacy plain-paragraph documents open as formatted rich text.
  const document = normalizeTiptapDocument(content);
  if (!document.content?.length) return null;
  return <Box sx={richTextSx}>{renderNode(document, 'root')}</Box>;
}
