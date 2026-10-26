import React from 'react';
import { Box, Button, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { IconBrandGithub } from '@tabler/icons-react';
import { useLanding, landingImage } from 'src/website/LandingContext';

const robotFacts = ['fact2', 'fact3', 'fact4', 'fact5'] as const;
const teachingCapabilities = ['mode1', 'mode2', 'mode3', 'mode4'] as const;

/**
 * Explains what the FOSSBot robot and platform are, so the homepage still
 * introduces the project instead of jumping straight into the feature tour.
 *
 * The section is one editorial grid: primary copy sits in the left column and
 * the summary, product render, and way-to-work list support it from the right.
 */
const WhatIsFossbot = ({sectionId='about-fossbot'}:{sectionId?:string}) => {
  const { t, value } = useLanding('about');

  return (
    <Box
      component="section"
      id={sectionId}
      sx={{
        bgcolor: 'background.paper',
        pb: { xs: 8, md: 10 },
        scrollMarginTop: 80,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
              fontWeight: 300,
              lineHeight: 1.15,
              color: 'primary.main',
              textWrap: 'balance',
            }}
          >
            {t('landing_about.title')}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '62ch', mt: 3 }}
          >
            {t('landing_about.intro')}
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 3, md: 6 }} alignItems="start" sx={{ mb: { xs: 7, md: 9 } }}>
          <Grid item xs={12} md={6}>
            <Typography
              component="h3"
              sx={{
                fontSize: { xs: '1.625rem', md: '2rem' },
                fontWeight: 300,
                lineHeight: 1.2,
                textWrap: 'balance',
              }}
            >
              {t('landing_about.robotTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, mt: 2 }}>
              {t('landing_about.robotBody')}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 2.5 }}>
              {robotFacts.map((fact) => (
                <Chip key={fact} size="small" variant="outlined" label={t(`landing_about.${fact}`)} />
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                maxWidth: 500,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <Box
                component="img"
                src={landingImage(value('image:robot'))}
                alt={t('landing_about.robotImageAlt')}
                sx={{
                  aspectRatio: '1.7',
                  display: 'block',
                  height: 'auto',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  transform: 'scale(1.4)',
                  width: '100%',
                }}
              />
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 3, md: 6 }} alignItems="start">
          <Grid item xs={12} md={6}>
            <Typography
              component="h3"
              sx={{
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                fontWeight: 300,
                lineHeight: 1.25,
              }}
            >
              {t('landing_about.platformTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, mt: 2 }}>
              {t('landing_about.platformBody')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              component="ul"
              sx={{
                display: 'grid',
                gap: 1.25,
                m: 0,
                pl: 2.5,
                '& li': { pl: 0.5 },
                '& li::marker': { color: 'primary.main' },
              }}
            >
              {teachingCapabilities.map((mode) => (
                <Typography component="li" variant="body1" key={mode} sx={{ lineHeight: 1.55 }}>
                  {t(`landing_about.${mode}`)}
                </Typography>
              ))}
            </Box>
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: { xs: 8, md: 10 },
            pt: { xs: 3, md: 4 },
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ maxWidth: '62ch' }}>
            <Typography
              component="h3"
              sx={{
                fontSize: { xs: '1.375rem', md: '1.625rem' },
                fontWeight: 300,
                lineHeight: 1.25,
              }}
            >
              {t('landing_about.openTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, mt: 1.5 }}>
              {t('landing_about.openBody')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            href={value('href:open')}
            endIcon={<IconBrandGithub size={18} />}
          >
            {t('landing_about.openLink')}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default WhatIsFossbot;
