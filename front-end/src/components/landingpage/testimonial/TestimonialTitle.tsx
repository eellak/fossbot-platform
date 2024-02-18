import React from 'react';
import AnimationFadeIn from '../animation/Animation';
import { useTranslation } from 'react-i18next';
import { Grid, Typography } from '@mui/material';

const TestimonialTitle = () => {
  const { t } = useTranslation();

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid item xs={12} sm={10} lg={8}>
        <AnimationFadeIn>
          <Typography
            variant="h2"
            fontWeight={700}
            textAlign="center"
            sx={{
              fontSize: {
                lg: '36px',
                xs: '25px',
              },
              lineHeight: {
                lg: '43px',
                xs: '30px',
              },
            }}
          >
            {t('testimonial-title.description')}
          </Typography>
        </AnimationFadeIn>
      </Grid>
    </Grid>
  );
};

export default TestimonialTitle;
