import React from 'react';
import { Typography, Grid, Container, Box, CardMedia, Stack, styled,Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AnimationFadeIn from '../animation/Animation';
import fossbot_fosscom from 'src/assets/images/landingpage/background/fossbot_fosscom.jpg';
import zap_image from 'src/assets/images/landingpage/background/zappeio.png';
import monaco_image from 'src/assets/images/landingpage/background/monaco_screen.png';
import maze_image from 'src/assets/images/landingpage/background/maze.png';
import robo_pen from 'src/assets/images/landingpage/background/front_pen.png';

import github from 'src/assets/images/landingpage/background/github.png';

const StyledButton = styled(Button)(() => ({
  padding: '13px 48px',
  fontSize: '16px',
}));


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
    <Box mb={10}>
      <Container maxWidth="lg">
        {/* <FeaturesTitle /> */}
        <AnimationFadeIn>
          <>
          {/* <Typography variant="h3" color="primary" fontWeight={200} mt={0}  >
                    {t('general_landing.overview')}
          </Typography> */}
     
            {cardData.map((card, index) => (
              <Box key={index} mt={2} mb={2}>
                <Grid container spacing={3} justifyContent="center" alignItems="center">
                  {card.imageFirst && (
                    <Grid item xs={12} sm={12} lg={6} display="flex" justifyContent="center">
                      <CardMedia
                        component="img"
                        sx={{ width: '80%', height: '80%', maxWidth: '300px', maxHeight: '300px' }}
                        image={card.image}
                        alt={t(card.textKey)}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={12} lg={6} display="flex" justifyContent="left" alignItems="left" flexDirection="column">
       
                    <Typography
                      variant="h5" 
                      fontWeight={200}
                      mt={0}
                      lineHeight={{ lg: '1.5', xl: '1.5' }}
                      textAlign="left"
                      paddingX={1.5}
                      color={"#454545"}
                      sx={{ paddingX: { xs: '0.5', sm: '0.5', md: '0.5' } }}
                    >
                      {t(card.textKey)}
                    </Typography>
                    {card.link && (
                    <Box alignItems={"center"} justifyContent={"center"} display={"flex"} flexDirection={"column"} mt={3} >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={0} >
                      <StyledButton variant="contained" color="primary" href="https://github.com/eellak/fossbot">
                      Github Page 
                      </StyledButton>
                    
          
                    </Stack>
                    </Box>
                      // <Button 
                      //   variant="contained" 
                      //   color="primary" 
                      //   href={card.link}                        
                      //   sx={{ mt: 5 }}>
                      //   Github Page 
                      // </Button>
                    )}
                  </Grid>
                  {!card.imageFirst && (
                    <Grid item xs={12} sm={12} lg={6} display="flex" justifyContent="center">
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
