import React from 'react';
import fossbotImg from 'src/assets/images/landingpage/background/fossbot.png';
import GuaranteeCard from './GuaranteeCard';
import { Grid, Typography, Box, Button, styled, Container, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import robo_pen from 'src/assets/images/landingpage/background/front_pen.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { faPython,faRaspberryPi } from '@fortawesome/free-brands-svg-icons';
import { faPuzzlePiece, faScrewdriver } from '@fortawesome/free-solid-svg-icons';


const AboutFossbot = () => {
  const { t } = useTranslation(); 

  return (

    <Box mb={10}>
    <Container maxWidth="lg">
          <Grid container justifyContent="space-between" spacing={3}>
            <Grid item xs={12} sm={12} lg={7}>
              <Typography variant="h2" color="primary" fontWeight={200} mt={0}  >
                {t('general_landing.whatis')}
              </Typography>
              </Grid>
              <Grid item xs={12} sm={12} lg={12}>
              <Typography variant="h3" color="#454545" fontWeight={200} mt={0}  >
            {t('general_landing.fossbot')}
          </Typography>
          <Box display="flex" justifyContent="center" mt={5}>
          <Stack direction="row" spacing={4}>
            <FontAwesomeIcon icon={faScrewdriver} size="3x" color='#454545' />
            <FontAwesomeIcon icon={faRobot} size="3x" color='#454545' />
            <FontAwesomeIcon icon={faPython} size="3x" color='#454545' />
            <FontAwesomeIcon icon={faPuzzlePiece} size="3x" color='#454545' />
            <FontAwesomeIcon icon={faRaspberryPi} size="3x" color='#454545' />
          </Stack>
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



  );
};

export default AboutFossbot;
