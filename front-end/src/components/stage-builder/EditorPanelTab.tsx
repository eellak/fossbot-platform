import React from 'react';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { editorColors } from './stageBuilderEditorTheme';

export type EditorPanelTabSide = 'left' | 'right';

export interface EditorPanelTabProps {
  side: EditorPanelTabSide;
  label: string;
  onClick: () => void;
}

const tabWidth = 30;

export function EditorPanelTab({ side, label, onClick }: EditorPanelTabProps) {
  const isLeft = side === 'left';
  const title = `Show ${label} panel`;
  const ArrowIcon = isLeft ? KeyboardDoubleArrowRightIcon : KeyboardDoubleArrowLeftIcon;

  return (
    <Paper
      elevation={0}
      square
      aria-label={`${label} panel minimized`}
      sx={{
        width: tabWidth,
        flex: `0 0 ${tabWidth}px`,
        height: '100%',
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: editorColors.panel,
        color: editorColors.textMuted,
        borderRight: isLeft ? `1px solid ${editorColors.border}` : undefined,
        borderLeft: isLeft ? undefined : `1px solid ${editorColors.border}`,
        transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
        '&:hover': {
          bgcolor: editorColors.panelRaised,
          color: editorColors.accent,
          borderRightColor: isLeft ? editorColors.accent : undefined,
          borderLeftColor: isLeft ? undefined : editorColors.accent,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Tooltip title={title} placement={isLeft ? 'right' : 'left'}>
        <IconButton
          size="small"
          aria-label={title}
          onClick={onClick}
          sx={{
            position: 'absolute',
            top: 8,
            left: 3,
            width: 24,
            height: 24,
            borderRadius: 0.75,
            color: 'inherit',
            '&:hover': {
              bgcolor: editorColors.accentSoft,
              color: editorColors.accentText,
            },
            '&:focus-visible': {
              outline: `2px solid ${editorColors.accent}`,
              outlineOffset: 2,
            },
          }}
        >
          <ArrowIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <Typography
          variant="caption"
          sx={{
            color: 'inherit',
            fontSize: '0.625rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            lineHeight: 1,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transform: 'rotate(-90deg)',
            userSelect: 'none',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}
