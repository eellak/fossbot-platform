import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { IconBrandGithub } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

const ClosingCta = () => {
  const { t } = useTranslation();

  return (
    <Box component="section" sx={{ bgcolor: 'background.paper', pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box
          className="visual-language-supporting-panel"
          sx={{ bgcolor: 'primary.light', p: { xs: 4, sm: 5, md: 6 }, textAlign: 'center' }}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.5rem', md: '2rem' },
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              textWrap: 'balance',
            }}
          >
            {t('landing_features.ctaTitle')}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '52ch', mx: 'auto', mt: 2 }}
          >
            {t('landing_features.ctaDescription')}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'center', mt: 4 }}
          >
            <Button variant="contained" color="primary" href="/dashboard">
              {t('banner-content.tryItNow')}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href="https://github.com/eellak/fossbot"
              endIcon={<IconBrandGithub size={18} />}
            >
              {t('github')}
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default ClosingCta;
