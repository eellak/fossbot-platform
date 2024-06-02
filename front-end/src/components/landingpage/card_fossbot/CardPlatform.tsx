import React from 'react';
import FeaturesTitle from './TitleFossbot';
import AnimationFadeIn from '../animation/Animation';
import { Typography, Grid, Container, Box, CardMedia } from '@mui/material';
import { useTranslation } from 'react-i18next';
import fossbot_fosscom from 'src/assets/images/landingpage/background/fossbot_fosscom.jpg';
import blockly_image from 'src/assets/images/landingpage/background/blockly_screen.png';
import monaco_image from 'src/assets/images/landingpage/background/monaco_screen.png';
import maze_image from 'src/assets/images/landingpage/background/maze.png';

// Example images and text for the cards
const cardData = [
  {
    image: blockly_image,
    textKey: 'card-fossbot.about_blockly',
    imageFirst: false,
  },
  {
    image: monaco_image,
    textKey: 'card-fossbot.about_monaco',
    imageFirst: true,
  },
  {
    image: maze_image,
    textKey: 'card-fossbot.about_simulator',
    imageFirst: false,
  },
];

const PatformCard = () => {
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
                        sx={{ 
                          width: '100%', 
                          height: '100%', 
                          maxWidth: '500px', 
                          maxHeight: '500px',
                          border: '1px solid lightgrey',
                          boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)'
                        }}
                        image={card.image}
                        alt={t(card.textKey)}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={7} lg={7} display="flex" justifyContent="center" alignItems="center">
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
                  </Grid>
                  {!card.imageFirst && (
                    <Grid item xs={12} sm={5} lg={5} display="flex" justifyContent="center">
                      <CardMedia
                        component="img"
                        sx={{ 
                          width: '100%', 
                          height: '100%', 
                          maxWidth: '500px', 
                          maxHeight: '500px',
                          border: '1px solid lightgrey',
                          boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)'
                        }}
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

export default PatformCard;
