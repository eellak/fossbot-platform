import React from 'react';
import fossbotImg from 'src/assets/images/landingpage/background/fossbot.png';
import GuaranteeCard from './GuaranteeCard';
import { Grid, Typography, Box, Button, styled, Container, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

const StyledButton = styled(Button)(({ theme }) => ({
  padding: '13px 34px',
  fontSize: '16px',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.primary.main,
  fontWeight: 600,
}));

const StyledButton2 = styled(Button)(({ theme }) => ({
  padding: '13px 34px',
  fontSize: '16px',
  borderColor: theme.palette.background.paper,
  color: theme.palette.background.paper,
  fontWeight: 600,
  '&:hover': {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.primary.main,
  },
}));

const C2a2 = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Box
        bgcolor="primary.main"
        sx={{
          pt: '60px',
          pb: '30px',
        }}
      >
        <Container maxWidth="lg">
          <Grid container justifyContent="space-between" spacing={3}>
            <Grid item xs={12} sm={12} lg={5}>
              <Typography variant="h2" color="background.paper" fontWeight={700} mt={4}>
                {t('c2a2.description')}
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                paddingX={{ xs: 2, sm: 4 }}
                spacing={3}
                mt={3}
              >
                <StyledButton variant="contained" color="inherit" href="/auth/login">
                  {t('login')}
                </StyledButton>
                <StyledButton2 variant="outlined" color="inherit" href="/auth/register">
                  {t('register')}
                </StyledButton2>
              </Stack>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Box
                sx={{
                  textAlign: {
                    xs: 'center',
                    sm: 'center',
                    md: 'center',
                    lg: 'right',
                    xl: 'right',
                  },
                }}
              >
                <img src={fossbotImg} alt="img" width="100%" object-fit="cover" max-height="75%" />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* <Container maxWidth="lg">
        <GuaranteeCard />
      </Container> */}
    </Box>
  );
};

export default C2a2;
