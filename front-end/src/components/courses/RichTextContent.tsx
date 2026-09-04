import React from 'react';
import { Box, Typography } from '@mui/material';
import type { TiptapNode } from 'src/courses/types';

function renderNode(node: TiptapNode, key: number | string): React.ReactNode {
  const children = node.content?.map((child, index) => renderNode(child, index));
  if (node.type === 'text') {
    let content: React.ReactNode = node.text || '';
    node.marks?.forEach((mark) => {
      if (mark.type === 'bold') content = <strong>{content}</strong>;
      if (mark.type === 'italic') content = <em>{content}</em>;
    });
    return <React.Fragment key={key}>{content}</React.Fragment>;
  }
  if (node.type === 'heading') return <Typography key={key} variant={node.attrs?.level === 2 ? 'h4' : 'h5'} sx={{ mt: 3, mb: 1 }}>{children}</Typography>;
  if (node.type === 'bulletList') return <Box key={key} component="ul" sx={{ pl: 3 }}>{children}</Box>;
  if (node.type === 'orderedList') return <Box key={key} component="ol" sx={{ pl: 3 }}>{children}</Box>;
  if (node.type === 'listItem') return <li key={key}><Typography component="span">{children}</Typography></li>;
  if (node.type === 'paragraph') return <Typography key={key} sx={{ mb: 1.5, lineHeight: 1.75 }}>{children}</Typography>;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

export default function RichTextContent({ content }: { content: TiptapNode | string }) {
  if (typeof content === 'string') return <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{content}</Typography>;
  return <Box>{renderNode(content, 'root')}</Box>;
}
