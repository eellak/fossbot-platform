import React from 'react';
import { Box, Container, Divider, Grid, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const featureStories = ['programming', 'stages', 'learning', 'buddy'] as const;
const foundations = ['projects', 'access', 'language', 'open'] as const;
const storyMedia: Record<(typeof featureStories)[number], string> = {
  programming: 'python-editor',
  stages: 'stage-builder',
  learning: 'student-lesson',
  buddy: 'buddy-panel',
};

const StoryScreenshot = ({ story }: { story: (typeof featureStories)[number] }) => {
  const { t } = useTranslation();
  const label = t(`landing_features.stories.${story}.screenshot`);
  const imageName = storyMedia[story];

  return (
    <Box component="figure" sx={{ m: 0, width: '100%' }}>
      <Box
        component="img"
        src={`/landing-media/candidates/${imageName}-720p.png`}
        width={1280}
        height={720}
        alt={label}
        loading="lazy"
        decoding="async"
        sx={{
          bgcolor: 'secondary.light',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
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

const PlatformCard = () => {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      id="platform-features"
      sx={{
        bgcolor: 'background.paper',
        pb: { xs: 8, md: 12 },
        pt: { xs: 7, md: 9 },
        scrollMarginTop: 80,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 2, md: 6 }} alignItems="end" sx={{ mb: { xs: 7, md: 10 } }}>
          <Grid item xs={12} md={7}>
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '2.25rem', sm: '3rem', md: '3.5rem' },
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                maxWidth: '14ch',
                textWrap: 'balance',
              }}
            >
              {t('landing_features.title')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '52ch' }}
            >
              {t('landing_features.intro')}
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ display: 'grid', rowGap: { xs: 8, md: 10 } }}>
          {featureStories.map((story) => (
            <Grid component="article" container spacing={{ xs: 3, md: 5 }} alignItems="center" key={story}>
              <Grid item xs={12} md={5}>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: '1.625rem', md: '2rem' },
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    maxWidth: '24ch',
                    textWrap: 'balance',
                  }}
                >
                  {t(`landing_features.stories.${story}.title`)}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6, maxWidth: '62ch', mt: 2 }}
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
              <Grid item xs={12} md={7} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ width: '100%', maxWidth: 640 }}>
                  <StoryScreenshot story={story} />
                </Box>
              </Grid>
            </Grid>
          ))}
        </Box>

        <Box
          component="section"
          className="visual-language-supporting-panel"
          sx={{ bgcolor: 'secondary.light', mt: { xs: 9, md: 14 }, p: { xs: 3, sm: 4, md: 5 } }}
        >
          <Grid container spacing={{ xs: 4, md: 7 }}>
            <Grid item xs={12} md={4}>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  maxWidth: '18ch',
                }}
              >
                {t('landing_features.foundationsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: '42ch' }}>
                {t('landing_features.foundationsIntro')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={8}>
              <Stack divider={<Divider flexItem />}>
                {foundations.map((foundation) => (
                  <Grid container spacing={2} key={foundation} sx={{ py: 2.25 }}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body1" fontWeight={600}>
                        {t(`landing_features.foundations.${foundation}.title`)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {t(`landing_features.foundations.${foundation}.description`)}
                      </Typography>
                    </Grid>
                  </Grid>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {t('landing_features.availability')}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default PlatformCard;
