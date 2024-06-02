import React from 'react';
import fossbotImg from 'src/assets/images/landingpage/background/fossbot.png';
import GuaranteeCard from './GuaranteeCard';
import { Grid, Typography, Box, Button, styled, Container, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import robo_pen from 'src/assets/images/landingpage/background/front_pen.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { faPython } from '@fortawesome/free-brands-svg-icons';

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

const AboutFossbot = () => {
  const { t } = useTranslation();

  return (
    <Container>
      <Box
        bgcolor="primary.main"
        sx={{
          pt: '30px',
          pb: '30px',
        }}
      >
        <Container maxWidth="lg">
          <Grid container justifyContent="space-between" spacing={3}>
            <Grid item xs={12} sm={12} lg={7}>
              <Typography variant="h2" color="background.paper" fontWeight={200} mt={0}  >
                {t('general_landing.whatis')}
              </Typography>
              </Grid>
              <Grid item xs={12} sm={12} lg={12}>
              <Typography variant="h3" color="white" fontWeight={200} mt={0}  >
            {t('general_landing.fossbot')}
          </Typography>
          <Box display="flex" justifyContent="center" mt={4}>
          <FontAwesomeIcon icon={faRobot} size="4x" color='white' />
              {/* <img src={robo_pen} alt="icon" width={'300px'} /> */}
            </Box>

              {/* <Stack
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
              </Stack> */}
            </Grid>
            {/* <Grid item xs={12} lg={5}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',  // Make the Box take full height of the Grid item
                }}
              >
                <img src={fossbotImg} alt="img" style={{ width: '100%', maxHeight: '100%' }} />
              </Box>
            </Grid> */}
          </Grid>
        </Container>
      </Box>
      {/* <Container maxWidth="lg">
        <GuaranteeCard />
      </Container> */}
    </Container>
  );
};

export default AboutFossbot;
