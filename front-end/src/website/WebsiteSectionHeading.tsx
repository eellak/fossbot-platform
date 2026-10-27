import type { ReactNode } from 'react';
import { Typography } from '@mui/material';

/** Public website section title, shared by native landing sections and CMS blocks. */
export default function WebsiteSectionHeading({children}:{children:ReactNode}) {
  return <Typography component="h2" sx={{
    fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
    fontWeight: 300,
    lineHeight: 1.15,
    color: 'primary.main',
    textWrap: 'balance',
  }}>{children}</Typography>;
}
