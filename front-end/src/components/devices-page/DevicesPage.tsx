import { Grid, Typography, Box, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';

const DevicesPage = () => {
  const { t } = useTranslation();

  return (
    <Box mb={10}>
      <Container maxWidth="lg">
        <Grid container justifyContent="space-between" spacing={3}>
          <Grid item xs={12} sm={12} lg={7}>
            <Typography variant="h4" color="primary" fontWeight={200} mt={0}>
              {t('device_page.errorMessage')}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={12} lg={12}>
            <Typography variant="h5" color="#454545" fontWeight={200} mt={0}>
              {t('device_page.suggestion')}
            </Typography>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default DevicesPage;
