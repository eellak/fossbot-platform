import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from "src/authentication/AuthProvider";

const AccountSettingsInfo = () => {
  const { t } = useTranslation();
  const auth = useAuth();



  return (
    <div>
      <Grid container spacing={3} >
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Title 1
              </Typography>
              <Typography variant="body1">
                Your text for card 1 here
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Title 2
              </Typography>
              <Typography variant="body1">
                Your text for card 2 here
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} paddingRight={5} sx={{ marginTop: 2 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Title 3
              </Typography>
              <Typography variant="body1">
                Your text for card 3 here
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default AccountSettingsInfo;
