import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type PageHeaderProps = {
  title: ReactNode;
  description: ReactNode;
  titleAdornment?: ReactNode;
  action?: ReactNode;
};

type TabbedPageHeaderProps = PageHeaderProps & {
  tabs: ReactNode;
};

export const pageTabsSx: SxProps<Theme> = {
  minHeight: 48,
  '& .MuiTab-root': {
    minHeight: 48,
    px: 2,
    py: 1.5,
    fontSize: '0.875rem',
    lineHeight: 1.5,
    fontWeight: 600,
  },
};

export default function PageHeader({ title, description, titleAdornment, action }: PageHeaderProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h3" component="h1">{title}</Typography>
          {titleAdornment}
        </Stack>
        <Typography color="text.secondary">{description}</Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function TabbedPageHeader({ tabs, ...headerProps }: TabbedPageHeaderProps) {
  return (
    <Stack spacing={2}>
      <PageHeader {...headerProps} />
      {tabs}
    </Stack>
  );
}
