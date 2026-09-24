import React from 'react';
import { Box, Container, Grid, styled } from '@mui/material';
import BannerContent from './BannerContent';
import bot from 'src/assets/images/fossbot/logos-main/bot.png';
import gfoss from 'src/assets/images/fossbot/logos-main/gfoss.png';
import hua from 'src/assets/images/fossbot/logos-main/hua.png';

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

const logoSet = Array.from({ length: 10 }, () => [hua, bot, gfoss]).flat();
const logoWall = [...logoSet, ...logoSet];

const Banner = () => (
  <Box component="section" sx={{ overflow: 'hidden', pb: { xs: 6, md: 8 }, pt: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <Grid container spacing={{ xs: 5, lg: 6 }} alignItems="center">
        <Grid item xs={12} lg={6}>
          <BannerContent />
        </Grid>
        <Grid item xs={12} lg={6} sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Box
            aria-hidden="true"
            sx={{
              bgcolor: 'primary.light',
              borderRadius: 1,
              height: 440,
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

export default Banner;
