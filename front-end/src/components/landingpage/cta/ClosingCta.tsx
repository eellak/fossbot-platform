import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { IconBrandGithub } from '@tabler/icons-react';
import { useLanding, landingImage } from 'src/website/LandingContext';

const ClosingCta = () => {
  const { t, value } = useLanding('cta');

  return (
    <Box component="section" sx={{ bgcolor: 'background.paper', pb: { xs: 8, md: 10 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{ borderTop: 1, borderColor: 'divider', pt: { xs: 4, md: 6 }, textAlign: 'center' }}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.5rem', md: '2rem' },
              fontWeight: 300,
              color: 'primary.main',
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
            <Button variant="contained" color="primary" href={value('href:cta')}>
              {t('banner-content.tryItNow')}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              href={value('href:github')}
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
