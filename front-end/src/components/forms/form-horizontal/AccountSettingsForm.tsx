import React, { useState, useEffect } from 'react';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
import SuccessAlert from 'src/components/alerts/SuccessAlert';
import ErrorAlert from 'src/components/alerts/ErrorAlert';
import ChangePassword from 'src/components/alerts/ChangePassword';
import { IconMail, IconUser } from '@tabler/icons-react';
import { Grid, InputAdornment, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from "src/authentication/AuthProvider";

interface AccountSettingsFormType {
  user?: any
}

const AccountSettingsForm = ({ user }: AccountSettingsFormType) => {
  const { t } = useTranslation();
  const auth = useAuth();

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [showChangePasswordSnackbar, setShowChangePasswordSnackbar] = useState(false);

  const [formData, setFormData] = useState({
    firstname: user?.firstname,
    lastname: user?.lastname,
    username: user?.username,
    email: user?.email
  });

  const handleFormSubmit = async () => {
    const user = await auth.updateUser(formData);
    if (user) {
      setShowSuccessAlert(true);
    } else {
      setShowErrorAlert(true);
    }
  }

  // Function to handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const showChangeYourPassswordSnackbar = () => {
    setShowChangePasswordSnackbar(true);
  }

  const handlePasswordUpdate = (success) => {
    setShowChangePasswordSnackbar(false);
    if (success) {
      setShowSuccessAlert(true);
    } else {
      setShowErrorAlert(true);
    }
  };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Form Layout for Account Settings */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Grid container spacing={3} xs={12} sm={12} md={10} lg={8} xl={8} alignItems="center">
        {/* 1 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel htmlFor="bi-firstname" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('firstname')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            id="bi-firstname"
            name="firstname"
            placeholder="John"
            fullWidth
            value={formData.firstname}
            onChange={handleInputChange}
          />
        </Grid>
        {/* 2 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel htmlFor="bi-lastname" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('lastname')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            id="bi-lastname"
            name="lastname"
            placeholder="Deo"
            fullWidth
            value={formData.lastname}
            onChange={handleInputChange}
          />
        </Grid>
        {/* 3 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel htmlFor="bi-username" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('username')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            id="bi-username"
            name="username"
            placeholder="john.deo"
            fullWidth
            value={user?.username}
            onChange={handleInputChange}
          />
        </Grid>
        {/* 4 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel htmlFor="bi-email" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('password')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <Button variant="contained" color="primary" onClick={showChangeYourPassswordSnackbar}>
            {t('changeYourPassword')}
          </Button>
        </Grid>
        {/* 5 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel htmlFor="bi-emailAddress" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('emailAddress')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            id="bi-email"
            placeholder="email@example.com"
            fullWidth
            value={formData.email}
            name="email"
            onChange={handleInputChange}
          />
        </Grid>
        <Grid item xs={12} sm={3}></Grid>
        <Grid item xs={12} sm={9} mt={5}>
          <Button variant="contained" color="primary" onClick={handleFormSubmit}>
            {t('update')}
          </Button>
        </Grid>
      </Grid>
      {showSuccessAlert && (
        <SuccessAlert title={t('alertMessages.userDataUpdated')} description={""} />
      )}

      {showErrorAlert && (
        <ErrorAlert title={t('alertMessages.userDataUpdateError')} description={""} />
      )}

      {showChangePasswordSnackbar && (
        <ChangePassword
          isOpen={showChangePasswordSnackbar}
          onClose={() => setShowChangePasswordSnackbar(false)}
          onPasswordUpdate={handlePasswordUpdate} />
      )}
    </div>
  );
};

export default AccountSettingsForm;
