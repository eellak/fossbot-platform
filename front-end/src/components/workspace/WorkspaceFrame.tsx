import { Box, Paper, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { forwardRef, type ReactNode } from 'react';
import { workspaceLayout } from './workspaceLayout';

type WorkspaceFrameProps = {
  children: ReactNode;
  label: string;
  sx?: SystemStyleObject<Theme>;
};

type WorkspacePaneProps = {
  children: ReactNode;
  label: string;
  gridArea: string;
  title?: ReactNode;
  sx?: SystemStyleObject<Theme>;
  contentSx?: SystemStyleObject<Theme>;
};

export const WorkspaceFrame = forwardRef<HTMLDivElement, WorkspaceFrameProps>(function WorkspaceFrame({ children, label, sx }, ref) {
  return (
    <Box
      ref={ref}
      component="section"
      aria-label={label}
      sx={[
        {
          position: 'relative',
          display: 'grid',
          gap: workspaceLayout.paneGap,
          minWidth: 0,
          minHeight: 0,
        },
        sx,
      ]}
    >
      {children}
    </Box>
  );
});

export function WorkspacePane({ children, label, gridArea, title, sx, contentSx }: WorkspacePaneProps) {
  return (
    <Paper
      component="section"
      aria-label={label}
      variant="outlined"
      sx={[
        {
          gridArea,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
        },
        sx,
      ]}
    >
      {title ? (
        <Box component="header" sx={{ flexShrink: 0, minHeight: 40, px: 1.5, py: 1, display: 'flex', alignItems: 'center' }}>
          <Typography component="div" variant="subtitle2" fontWeight={600}>{title}</Typography>
        </Box>
      ) : null}
      <Box sx={[{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', borderRadius: 0 }, contentSx]}>
        {children}
      </Box>
    </Paper>
  );
}
