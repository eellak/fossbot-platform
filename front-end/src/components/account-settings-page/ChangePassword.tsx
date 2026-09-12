import React, { useState } from 'react';
import CustomFormLabel from '../forms/theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../forms/theme-elements/CustomOutlinedInput';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useAuth } from "src/authentication/AuthProvider";
import { useTranslation } from 'react-i18next';

interface ChangePasswordProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordUpdate: (success: boolean) => void;
}

const ChangePassword = ({ isOpen, onClose, onPasswordUpdate }: ChangePasswordProps) => {
  const { t } = useTranslation();
  const auth = useAuth();

  const [formData, setFormData] = useState({
    password: "",
    passwordConfirmation: ""
  });
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.password || !passwordsMatch || submitting) return;
    setSubmitting(true);
    try {
      const user = await auth.updateUserPassword({ password: formData.password });
      onPasswordUpdate(Boolean(user));
    } catch {
      onPasswordUpdate(false);
    } finally {
      setSubmitting(false);
    }
  }

  const cancel = () => {
    onClose();
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    setPasswordsMatch(newFormData.password === newFormData.passwordConfirmation);
  };

  return <Dialog
    open={isOpen}
    onClose={submitting ? undefined : onClose}
    fullWidth
    maxWidth="sm"
    aria-labelledby="change-password-title"
  >
    <Box component="form" onSubmit={handleFormSubmit}>
      <DialogTitle id="change-password-title">{t('changeYourPassword')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <CustomFormLabel htmlFor="bi-password" sx={{ mt: 0, mb: 1 }}>
              {t('password')}
            </CustomFormLabel>
            <CustomOutlinedInput
              autoFocus
              autoComplete="new-password"
              id="bi-password"
              name="password"
              type="password"
              fullWidth
              value={formData.password}
              onChange={handleInputChange}
            />
          </Box>
          <Box>
            <CustomFormLabel htmlFor="bi-password-confirmation" sx={{ mt: 0, mb: 1 }}>
              {t('passwordConfirmation')}
            </CustomFormLabel>
            <CustomOutlinedInput
              autoComplete="new-password"
              id="bi-password-confirmation"
              name="passwordConfirmation"
              type="password"
              fullWidth
              error={!passwordsMatch}
              aria-describedby={!passwordsMatch ? 'password-confirmation-error' : undefined}
              value={formData.passwordConfirmation}
              onChange={handleInputChange}
            />
            {!passwordsMatch && <Typography id="password-confirmation-error" role="alert" color="error.main" variant="body2" sx={{ mt: 0.75 }}>
              {t('alertMessages.passwordConfirmationError')}
            </Typography>}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" color="inherit" onClick={cancel} disabled={submitting}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="contained" disabled={!formData.password || !passwordsMatch || submitting}>
          {submitting ? t('saving') : t('update')}
        </Button>
      </DialogActions>
    </Box>
  </Dialog>;
};

export default ChangePassword;
