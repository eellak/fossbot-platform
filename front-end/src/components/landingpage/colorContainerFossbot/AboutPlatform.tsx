import React from 'react';
import fossbotImg from 'src/assets/images/landingpage/background/colors.png';
import GuaranteeCard from './GuaranteeCard';
import { Grid, Typography, Box, Button, styled, Container,Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import pythonImg from 'src/assets/images/landingpage/background/python.png';
import blocklyImg from 'src/assets/images/landingpage/background/blockly.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { faPython,faRaspberryPi } from '@fortawesome/free-brands-svg-icons';
import { faPuzzlePiece, faHand } from '@fortawesome/free-solid-svg-icons';

const StyledButton = styled(Button)(() => ({
  padding: '13px 48px',
  fontSize: '16px',
}));


const AboutPlatform = () => {
  const { t } = useTranslation();

  return (

      <Box mb={10}>
        <Container maxWidth="lg">
          <Grid container justifyContent="space-between" spacing={3}>
            <Grid item xs={12} sm={12} lg={5}>
              <Typography variant="h2" color="primary" fontWeight={200} mt={0}>
                {t('general_landing.whatis_platform')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={12} lg={12}>
              <Typography variant="h3" color="#454545" fontWeight={200} mt={0}>
                {t('general_landing.platform')}
              </Typography>
              <Box display="flex" justifyContent="center" mt={4}>
                <Box display="flex" justifyContent="space-between" >
                <Stack direction="row" spacing={4}>                  
                  <FontAwesomeIcon icon={faPython} size="3x" color='#454545' />
                  <FontAwesomeIcon icon={faPuzzlePiece} size="3x" color='#454545' />
                  <FontAwesomeIcon icon={faHand} size="3x" color='#454545' />
                </Stack>
                </Box>

              </Box>

            </Grid>
          </Grid>
        </Container>
      </Box>

  );
};

export default AboutPlatform;