import React from 'react';
import { Typography, Grid, Container, Box, CardMedia, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AnimationFadeIn from '../animation/Animation';
import fossbot_fosscom from 'src/assets/images/landingpage/background/fossbot_fosscom.jpg';
import zap_image from 'src/assets/images/landingpage/background/zappeio.png';
import monaco_image from 'src/assets/images/landingpage/background/monaco_screen.png';
import maze_image from 'src/assets/images/landingpage/background/maze.png';
import robo_pen from 'src/assets/images/landingpage/background/front_pen.png';

import github from 'src/assets/images/landingpage/background/github.png';

// Example images and text for the cards
const cardData = [
  {
    image: robo_pen,
    textKey: 'general_landing.fossbot_text',
    imageFirst: false,
  },
  {
    image: github,
    textKey: 'general_landing.github',
    imageFirst: true,
    link: 'https://github.com/eellak/fossbot'  // Add the GitHub link here
  }
];

const FossbotCard = () => {
  const { t } = useTranslation();

  return (
    <Box py={6}>
      <Container maxWidth="lg">
        {/* <FeaturesTitle /> */}
        <AnimationFadeIn>
          <>
     
            {cardData.map((card, index) => (
              <Box key={index} mt={6}>
                <Grid container spacing={3} justifyContent="center" alignItems="center">
                  {card.imageFirst && (
                    <Grid item xs={12} sm={5} lg={5} display="flex" justifyContent="center">
                      <CardMedia
                        component="img"
                        sx={{ width: '80%', height: '80%', maxWidth: '300px', maxHeight: '300px' }}
                        image={card.image}
                        alt={t(card.textKey)}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={7} lg={7} display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                    <Typography
                      variant="h5"
                      fontWeight={400}
                      mt={3}
                      lineHeight={{ lg: '1.5', xl: '1.5' }}
                      textAlign="center"
                      paddingX={1.5}
                      color={"#454545"}
                      sx={{ paddingX: { xs: '0.5', sm: '0.5', md: '0.5' } }}
                    >
                      {t(card.textKey)}
                    </Typography>
                    {card.link && (
                      <Button 
                        variant="contained" 
                        color="primary" 
                        href={card.link}
                        sx={{ mt: 2 }}
                      >
                        Github Page
                      </Button>
                    )}
                  </Grid>
                  {!card.imageFirst && (
                    <Grid item xs={12} sm={5} lg={5} display="flex" justifyContent="center">
                      <CardMedia
                        component="img"
                        sx={{ width: '100%', height: '100%', maxWidth: '500px', maxHeight: '500px' }}
                        image={card.image}
                        alt={t(card.textKey)}
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            ))}
          </>
        </AnimationFadeIn>
      </Container>
    </Box>
  );
};

export default FossbotCard;
