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
          fontSize: { xs: '2.5rem', md: '3.375rem' },
          fontWeight: 900,
          lineHeight: 1.1,
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
        sx={{ fontSize: '1.5rem', fontWeight: 300, lineHeight: 1.5, mt: 4 }}
      >
        {t('banner-content.democratizeEducation')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
        <Button variant="contained" color="primary" href="/dashboard" sx={{ px: 6, py: 1.5, fontSize: '1rem' }}>
          {t('banner-content.tryItNow')}
        </Button>
      </Stack>
    </Box>
  );
};

export default BannerContent;
