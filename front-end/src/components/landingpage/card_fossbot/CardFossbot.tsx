import React from 'react';
import FeaturesTitle from './TitleFossbot';
import AnimationFadeIn from '../animation/Animation';
import FosscomFossbot from 'src/assets/images/backgrounds/fossbot_fosscom.jpg';
import { Typography, Grid, Container, Box, CardMedia } from '@mui/material';
import { useTranslation } from 'react-i18next';

const FossbotCard = () => {
  const { t } = useTranslation();

  return (
    <Box py={6}>
      <Container maxWidth="lg">
        <FeaturesTitle />
        <AnimationFadeIn>
          <Box mt={6}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={5} lg={5} textAlign="center">
                <CardMedia
                  component="img"
                  sx={{ width: '100%', height: '100%' }}
                  image={FosscomFossbot}
                  alt="STEM Education"
                />
              </Grid>
              <Grid item xs={12} sm={7} lg={7}>
                <Typography variant="h5" mt={3} lineHeight={{ lg: '1.5', xl: '1.5' }} paddingX={1.5} textAlign="center" sx={{ paddingX: { xs: '0.5', sm: '0.5', md: '0.5' } }} >
                  {t('card-fossbot.fossbot')}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </AnimationFadeIn>
      </Container>
    </Box>
  );
};

export default FossbotCard;
