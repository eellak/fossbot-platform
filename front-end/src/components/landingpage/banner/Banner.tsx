 
import React from 'react';
import { Grid, Box, Container, useMediaQuery, styled, Stack, Theme } from '@mui/material';
import BannerContent from './BannerContent';
import bannerbgImg1 from 'src/assets/images/landingpage/fossbot1.jpg';
import bannerbgImg2 from 'src/assets/images/landingpage/fossbot2.jpg';
import bannerbgImg3 from 'src/assets/images/landingpage/fossbot3.jpg';
import bannerbgImg4 from 'src/assets/images/landingpage/fossbot4.jpg';
import bannerbgImg5 from 'src/assets/images/landingpage/fossbot5.jpg';

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
                    <Grid item xs={6}>
                      <SliderBox>
                        <img src={bannerbgImg1} alt="banner" />
                      </SliderBox>
                      <SliderBox>
                        <img src={bannerbgImg2} alt="banner" />
                      </SliderBox>
                    </Grid>
                    <Grid item xs={6}>
                      <SliderBox>
                        <img src={bannerbgImg3} alt="banner" />
                      </SliderBox>
                      {/* <SliderBox>
                        <img src={bannerbgImg4} alt="banner" />
                      </SliderBox> */}
                      <SliderBox>
                        <img src={bannerbgImg5} alt="banner" />
                      </SliderBox>
                    </Grid>
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
