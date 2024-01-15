 
import React from 'react';
import { Grid, Box, Container, useMediaQuery, styled, Stack, Theme } from '@mui/material';
import BannerContent from './BannerContent';
import bot from 'src/assets/images/fossbot/logos-main/bot.png';
import botR from 'src/assets/images/fossbot/logos-main/botR.png';
import gfoss from 'src/assets/images/fossbot/logos-main/gfoss.png';
import hua from 'src/assets/images/fossbot/logos-main/hua.png';
// import bannerbgImg2 from 'src/assets/images/landingpage/fossbot2.jpg';
// import bannerbgImg3 from 'src/assets/images/landingpage/fossbot3.jpg';
// import bannerbgImg4 from 'src/assets/images/landingpage/fossbot4.jpg';
// import bannerbgImg5 from 'src/assets/images/landingpage/fossbot5.jpg';

const Banner = () => {
  const lgUp = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));

  const SliderBox = styled(Box)(() => ({
    '@keyframes slideup': {
      '0%': {
        transform: 'translate3d(0, 0, 0)',
      },
      '100% ': {
        transform: 'translate3d(0px, -100%, 0px)',
      },
    },
    
    animation: 'slideup 35s linear infinite',

    img: {
      width: '100%',
      height: 'auto',
      objectFit: 'contain',
    },
  }));

  // const SliderBox2 = styled(Box)(() => ({
  //   '@keyframes slideDown': {
  //     '0%': {
  //       transform: 'translate3d(0, -100%, 0)',
  //     },
  //     '100% ': {
  //       transform: 'translate3d(0px, 0, 0px)',
  //     },
  //   },
    
  //   animation: 'slideDown 35s linear infinite',

  //   img: {
  //     width: '100%',
  //     height: '20%',
  //     objectFit: 'contain',
  //   },
  // }));

  const images = [
    { src: hua, alt: 'banner' },
    { src: bot, alt: 'banner' },
    { src: gfoss, alt: 'banner' },
    // Add more objects as needed
  ];

  let repeatedData = [];
  for (let i = 0; i < 10; i++) {
    repeatedData = repeatedData.concat(images);
  }
 

  return (
    <Box mb={10} sx={{ overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} lg={6} sm={8}>
            <BannerContent />
          </Grid>
          {lgUp ? (
            <Grid item xs={12} lg={6}>
              <Box
                p={3.2}
                sx={{
                  backgroundColor: (theme) => theme.palette.primary.light,
                  minWidth: '70%',
                  height: 'calc(100vh - 100px)',
                  maxHeight: '790px',
                }}
              >
                <Stack direction={'row'}>
                  <Grid container spacing={2}>
                  {repeatedData.map((repeatedData, index) => (
                  <Grid item xs={3}>
                      <SliderBox width={"100px"}>
                        <img src={repeatedData.src} alt={repeatedData.alt} />
                      </SliderBox>
                      
                    </Grid>
                  ))}


                  </Grid>
                </Stack>
              </Box>
            </Grid>
          ) : null}
        </Grid>
      </Container>
    </Box>
  );
};

export default Banner;
