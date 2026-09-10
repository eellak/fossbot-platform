import { Box, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function CopyrightCredit() {
  const { t } = useTranslation();

  return (
    <Box sx={{ px: 3, pt: 1, pb: 2 }}>
      <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.5, color: 'text.secondary', textAlign: 'center' }}>
        {t('footer.rights')}{' '}
        <Link href="https://hot.dit.hua.gr/" target="_blank" rel="noopener noreferrer" color="inherit" underline="always">
          {t('footer.fossbotTeam')}
        </Link>
      </Typography>
    </Box>
  );
}
