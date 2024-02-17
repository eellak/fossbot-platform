import ErrorImg from 'src/assets/images/backgrounds/404-error-idea.gif';

import { FC } from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Error: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100vh"
      textAlign="center"
      justifyContent="center"
    >
      <Container maxWidth="md">
        <img src={ErrorImg} alt="404" style={{ width: '100%', maxWidth: '500px' }} />
        <Typography align="center" variant="h1" mb={4}>
          {t('authentication.error.oops')}
        </Typography>
        <Typography align="center" variant="h4" mb={4}>
          {t('authentication.error.pageNotFound')}
        </Typography>
        <Button color="primary" variant="contained" component={Link} to="/" disableElevation>
          {t('authentication.error.gobackHome')}
        </Button>
      </Container>
    </Box>
  );
};

export default Error;
