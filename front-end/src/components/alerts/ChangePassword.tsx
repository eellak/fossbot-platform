import React, { useState } from 'react';
import CustomFormLabel from '../forms/theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../forms/theme-elements/CustomOutlinedInput';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { Grid, InputAdornment, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ChangePassword = () => {
  const { t } = useTranslation();

  const [open, setOpen] = React.useState(true);
  const [formData, setFormData] = useState({
    password: "",
    passwordConfirmation: ""
  });

  const handleFormSubmit = async () => {

  }

  const cancel = () => {

  }
  // Function to handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  return (
    <React.Fragment>
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >

        <Alert
          severity="info"
          variant="outlined"
          icon={false}
          sx={{ width: '100%', color: 'black', backgroundColor: 'white', }}
        >
          <Grid container spacing={3} xs={12} sm={12} md={10} lg={8} xl={8} alignItems="center">
            {/* 1 */}
            <Grid item xs={12} sm={6} display="flex" alignItems="center">
              <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                {t('password')}
              </CustomFormLabel>
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomOutlinedInput
                id="bi-password"
                name="password"
                placeholder=""
                type="password"
                fullWidth
                value={formData.password}
                onChange={handleInputChange}
              />
            </Grid>
            {/* 2 */}
            <Grid item xs={12} sm={6} display="flex" alignItems="center">
              <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                {t('passwordConfirmation')}
              </CustomFormLabel>
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomOutlinedInput
                id="bi-password-confirmation"
                name="lastnameConfirmation"
                type="password"
                placeholder=""
                fullWidth
                value={formData.passwordConfirmation}
                onChange={handleInputChange}
              />
            </Grid>
            {/* 3 */}
            <Grid item xs={12} sm={12} mt={3}>
              <Grid container spacing={1} justifyContent="center"> {/* Centered container with spacing */}
                <Grid item>
                  <Button variant="contained" color="primary" onClick={cancel}>
                    {t('cancel')}
                  </Button>
                </Grid>
                <Grid item>
                  <Button variant="contained" color="primary" onClick={handleFormSubmit}>
                    {t('update')}
                  </Button>
                </Grid>
              </Grid>
            </Grid>

          </Grid>

        </Alert>
      </Snackbar>
    </React.Fragment>
  );
};

export default ChangePassword;
