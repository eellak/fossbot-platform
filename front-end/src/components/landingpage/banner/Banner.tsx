import React from 'react';
import { Box, Container, Grid, styled } from '@mui/material';
import { useLanding, landingImage } from 'src/website/LandingContext';
import BannerContent from './BannerContent';

const logoWallFade = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';

const LogoWallTrack = styled(Box)(() => ({
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  width: '100%',
  '@keyframes logoWallSlide': {
    '0%': { transform: 'translateY(0)' },
    '100%': { transform: 'translateY(-50%)' },
  },
  animation: 'logoWallSlide 20s linear infinite',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

const Banner = ({heading='h1'}:{heading?:'h1'|'h2'}) => {
  const {value}=useLanding('hero');
  const logoSet=Array.from({length:10},()=>['hua','bot','gfoss'].map(key=>landingImage(value('image:'+key)))).flat();
  const logoWall=[...logoSet,...logoSet];
  return (
  <Box component="section" sx={{ overflow: 'hidden', mb: { xs: 8, md: 10 } }}>
    <Container maxWidth="lg">
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} lg={6}>
          <BannerContent heading={heading}/>
        </Grid>
        <Grid item xs={12} lg={6} sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Box
            aria-hidden="true"
            sx={{
              bgcolor: 'primary.light',
              height: { lg: 'min(70vh, 790px)' },
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                inset: 0,
                maskImage: logoWallFade,
                overflow: 'hidden',
                p: 3,
                position: 'absolute',
                WebkitMaskImage: logoWallFade,
              }}
            >
              <LogoWallTrack>
                {logoWall.map((logo, index) => (
                  <Box
                    component="img"
                    src={logo}
                    alt=""
                    key={`${logo}-${index}`}
                    sx={{ height: 72, objectFit: 'contain', p: 0.5, width: '100%' }}
                  />
                ))}
              </LogoWallTrack>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Container>
  </Box>
);
};

export default Banner;
