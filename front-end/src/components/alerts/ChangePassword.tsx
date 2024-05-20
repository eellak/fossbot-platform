import React, { useState, useEffect } from 'react';
import CustomFormLabel from '../forms/theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../forms/theme-elements/CustomOutlinedInput';
import { Snackbar, Alert, AlertTitle, Typography } from '@mui/material';
import { Grid, InputAdornment, Button } from '@mui/material';
import { useAuth } from "src/authentication/AuthProvider";
import { useTranslation } from 'react-i18next';

interface AChangePasswordProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordUpdate: (success: boolean) => void;
}

const ChangePassword = ({ isOpen, onClose, onPasswordUpdate }: AChangePasswordProps) => {
  const { t } = useTranslation();
  const auth = useAuth();

  const [open, setOpen] = useState(isOpen);
  const [formData, setFormData] = useState({
    password: "",
    passwordConfirmation: ""
  });

  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const handleFormSubmit = async () => {
    const user = await auth.updateUserPassword({ password: formData.password });
    if (user) {
      onPasswordUpdate(true);
    } else {
      onPasswordUpdate(false);
    }
  }

  const cancel = () => {
    onClose();
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    setPasswordsMatch(newFormData.password === newFormData.passwordConfirmation);
  };

  return (
    <React.Fragment>
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={onClose}
      >
        <Alert
          severity="info"
          variant="outlined"
          icon={false}
          sx={{ width: '100%', color: 'black', backgroundColor: 'white', }}
        >
          <Grid container spacing={3} xs={12} sm={12} md={12} lg={12} xl={12} alignItems="center" paddingLeft={2} paddingRight={2} paddingTop={1}>
            {/* 1 */}
            <Grid item xs={12} sm={6} lg={5} xl={6} display="flex" alignItems="center">
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
            <Grid item xs={12} sm={6} lg={5} xl={6} display="flex" alignItems="center">
              <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                {t('passwordConfirmation')}
              </CustomFormLabel>
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomOutlinedInput
                id="bi-password-confirmation"
                name="passwordConfirmation"
                type="password"
                placeholder=""
                fullWidth
                error={!passwordsMatch}
                value={formData.passwordConfirmation}
                onChange={handleInputChange}
              />
              {!passwordsMatch && <Typography color="red" variant="body2">{t('alertMessages.passwordConfirmationError')}</Typography>}
            </Grid>
            {/* 3 */}
            <Grid item xs={12} sm={12} lg={12} mt={3}>
              <Grid container spacing={1} justifyContent="center">
                <Grid item>
                  <Button variant="contained" color="error" onClick={cancel}>
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
