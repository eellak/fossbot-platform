import React from 'react';
import { Grid, Box, Container, useMediaQuery, styled, Stack, Theme } from '@mui/material';
import BannerContent from './BannerContent';
import bot from 'src/assets/images/fossbot/logos-main/bot.png';
import gfoss from 'src/assets/images/fossbot/logos-main/gfoss.png';
import hua from 'src/assets/images/fossbot/logos-main/hua.png';

const Banner = () => {
  const lgUp = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));

  const SliderContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    height: '200%',
    '@keyframes slideup': {
      '0%': {
        transform: 'translateY(0)',
      },
      '100%': {
        transform: 'translateY(-50%)',
      },
    },
    animation: 'slideup 20s linear infinite',
  }));

  const SliderBox = styled(Box)(({ theme }) => ({
    img: {
      width: '100%',
      height: 'auto',
      objectFit: 'contain',
    },
  }));

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
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <SliderContainer>
                  {repeatedData.map((repeatedData, index) => (
                    <Grid item xs={3} key={index} sx={{ padding: '8px' }}>
                      <SliderBox width={"100px"}>
                        <img src={repeatedData.src} alt={repeatedData.alt} />
                      </SliderBox>
                    </Grid>
                  ))}
                  {repeatedData.map((repeatedData, index) => (
                    <Grid item xs={3} key={`repeat-${index}`} sx={{ padding: '8px' }}>
                      <SliderBox width={"100px"}>
                        <img src={repeatedData.src} alt={repeatedData.alt} />
                      </SliderBox>
                    </Grid>
                  ))}
                </SliderContainer>
              </Box>
            </Grid>
          ) : null}
        </Grid>
      </Container>
    </Box>
  );
};

export default Banner;
