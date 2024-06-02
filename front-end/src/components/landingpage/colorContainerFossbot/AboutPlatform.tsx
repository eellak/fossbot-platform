import React from 'react';
import fossbotImg from 'src/assets/images/landingpage/background/colors.png';
import GuaranteeCard from './GuaranteeCard';
import { Grid, Typography, Box, Button, styled, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';
import pythonImg from 'src/assets/images/landingpage/background/python.png';
import blocklyImg from 'src/assets/images/landingpage/background/blockly.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece, faCode } from '@fortawesome/free-solid-svg-icons';
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

const AboutPlatform = () => {
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
            <Grid item xs={12} sm={12} lg={5}>
              <Typography variant="h2" color="background.paper" fontWeight={200} mt={0}>
                {t('general_landing.whatis_platform')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={12} lg={12}>
              <Typography variant="h3" color="white" fontWeight={200} mt={0}>
                {t('general_landing.platform')}
              </Typography>
              <Box display="flex" justifyContent="center" mt={4}>
                <Box display="flex" justifyContent="space-between" width="150px">
                
                  <FontAwesomeIcon icon={faPython} size="5x" color='white' />
                  <FontAwesomeIcon icon={faPuzzlePiece} size="4x" color='white' />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Container>
  );
};

export default AboutPlatform;