import React from 'react';
import { Box, Container, Grid, Typography } from '@mui/material';
import { useLanding, landingImage } from 'src/website/LandingContext';

const featureStories = ['programming', 'stages', 'learning', 'buddy'] as const;
const StoryScreenshot = ({ story }: { story: (typeof featureStories)[number] }) => {
  const { t, value } = useLanding('features');
  const label = t(`landing_features.stories.${story}.screenshot`);

  return (
    <Box component="figure" sx={{ m: 0, width: '100%' }}>
      <Box
        component="img"
        src={landingImage(value('image:'+story))}
        width={1280}
        height={720}
        alt={label}
        loading="lazy"
        decoding="async"
        sx={{
          bgcolor: 'secondary.light',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
          display: 'block',
          height: 'auto',
          width: '100%',
        }}
      />
      <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
        {label}
      </Typography>
    </Box>
  );
};

const PlatformCard = ({sectionId='platform-features'}:{sectionId?:string}) => {
  const { t, value } = useLanding('features');

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
        <Grid container spacing={2} sx={{ mb: { xs: 7, md: 10 } }}>
          <Grid item xs={12}>
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
              {t('landing_features.title')}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '90ch' }}
            >
              {t('landing_features.intro')}
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ display: 'grid', rowGap: { xs: 7, md: 10 } }}>
          {featureStories.map((story, index) => (
            <Grid component="article" container spacing={3} alignItems="center" key={story}>
              <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: index % 2 === 1 ? 2 : 1 } }}>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: '1.625rem', md: '2rem' },
                    fontWeight: 300,
                    lineHeight: 1.3,
                    textWrap: 'balance',
                  }}
                >
                  {t(`landing_features.stories.${story}.title`)}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6, mt: 2 }}
                >
                  {t(`landing_features.stories.${story}.description`)}
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    m: 0,
                    mt: 2.5,
                    pl: 2.5,
                    '& li': { pl: 0.5 },
                    '& li::marker': { color: 'primary.main' },
                  }}
                >
                  {[1, 2, 3].map((point) => (
                    <Typography component="li" variant="body1" key={point} sx={{ lineHeight: 1.55 }}>
                      {t(`landing_features.stories.${story}.point${point}`)}
                    </Typography>
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center', order: { xs: 2, md: index % 2 === 1 ? 1 : 2 } }}>
                <Box sx={{ width: '100%', maxWidth: 500 }}>
                  <StoryScreenshot story={story} />
                </Box>
              </Grid>
            </Grid>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default PlatformCard;
