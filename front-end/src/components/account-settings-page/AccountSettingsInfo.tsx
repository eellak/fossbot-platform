import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface AccountSettingsInfoProps {
  monacoProjectsNumber: number,
  blocklyProjectsNumber: number,
  tutorialsNumber: number
}

const AccountSettingsInfo = ({ monacoProjectsNumber, blocklyProjectsNumber, tutorialsNumber }: AccountSettingsInfoProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <Grid container spacing={3} >
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom align="center">
                {t("accountSettings.monacoProjects")}
              </Typography>
              <Typography variant="body1" align="center">
                {monacoProjectsNumber.toString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom align="center">
                {t("accountSettings.blocklyProjects")}
              </Typography>
              <Typography variant="body1" align="center">
                {blocklyProjectsNumber.toString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} paddingRight={5} sx={{ marginTop: 2 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom align="center">
                {t("accountSettings.tutorials")}
              </Typography>
              <Typography variant="body1" align="center" >
                {tutorialsNumber.toString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default AccountSettingsInfo;
