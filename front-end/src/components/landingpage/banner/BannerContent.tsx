import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const BannerContent = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: '2.5rem', sm: '3.25rem', md: '3.75rem' },
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          maxWidth: '14ch',
          textWrap: 'balance',
        }}
      >
        <Typography component="span" variant="inherit" color="primary.main">
          {t('foss')}
        </Typography>
        <Typography component="span" variant="inherit" color="orange">
          {t('bot')}
        </Typography>{' '}
        {t('banner-content.openTechnologies')}
      </Typography>

      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ fontSize: '1.125rem', lineHeight: 1.6, mt: 3, maxWidth: '52ch' }}
      >
        {t('banner-content.democratizeEducation')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
        <Button variant="contained" color="primary" href="/dashboard">
          {t('banner-content.tryItNow')}
        </Button>
      </Stack>
    </Box>
  );
};

export default BannerContent;
