import React from 'react';
import CustomCheckbox from '../../components/forms/theme-elements/CustomCheckbox';
import CustomTextField from '../../components/forms/theme-elements/CustomTextField';
import CustomFormLabel from '../../components/forms/theme-elements/CustomFormLabel';

import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Button,
  Stack,
  Divider,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { loginType } from 'src/types/auth/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../authentication/AuthProvider';
import { useTranslation } from 'react-i18next';

const AuthLogin = ({ title, subtitle, subtext }: loginType) => {
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const auth = useAuth();
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      // Call the login function
      if (username !== '' && password !== '') {
        auth.loginAction({ username: username, password: password });
        return;
      }
    } catch (error) {
      // Handle errors (e.g., show an error message to the user)
      console.error('Login error:', error);
    }
  };

  // const handleSubmit = async (event) => {
  //   event.preventDefault();

  //   try {
  //     // Call the login function
  //     await login(username, password);
  //     navigate('/dashboard');
  //   } catch (error) {
  //     // Handle errors (e.g., show an error message to the user)
  //     console.error('Login error:', error);

  //   }
  // };

  // // The login function
  // const login = async (username, password) => {
  //   const response = await fetch('http://localhost:8000/token', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ 'username': username,'password': password }),
  //   });

  //   if (!response.ok) {

  //     throw new Error('Login failed');
  //   }
  //   console.log("Login successful");
  //   const data = await response.json();
  //   localStorage.setItem('token', data.token);
  // };

  return (
    <>
      {title ? (
        <Typography fontWeight="700" variant="h3" mb={1}>
          {title}
        </Typography>
      ) : null}

      {subtext}

      {/* <AuthSocialButtons title="Sign in with" /> */}
      <Box mt={3}>
        <Divider>
          <Typography
            component="span"
            color="textSecondary"
            variant="h6"
            fontWeight="400"
            position="relative"
            px={2}
          >
            {t('signInWith')}
          </Typography>
        </Divider>
      </Box>

      <Stack>
        <Box>
          <CustomFormLabel htmlFor="username">{t('username')}</CustomFormLabel>
          <CustomTextField
            id="username"
            variant="outlined"
            fullWidth
            value={username}
            onChange={handleUsernameChange}
          />
        </Box>
        <Box>
          <CustomFormLabel htmlFor="password">{t('password')}</CustomFormLabel>
          <CustomTextField
            id="password"
            type="password"
            variant="outlined"
            fullWidth
            value={password}
            onChange={handlePasswordChange}
          />
        </Box>
        <Stack justifyContent="space-between" direction="row" alignItems="center" my={2}>
          <FormGroup>
            <FormControlLabel
              control={<CustomCheckbox defaultChecked />}
              label= {t('authentication.authLogin.rememberDevice')}
            />
          </FormGroup>
          <Typography
            component={Link}
            to="/auth/forgot-password"
            fontWeight="500"
            sx={{
              textDecoration: 'none',
              color: 'primary.main',
            }}
          >
            {t('authentication.authLogin.forgotPassword')}
          </Typography>
        </Stack>
      </Stack>
      <Box>
        <Button
          color="primary"
          variant="contained"
          size="large"
          fullWidth
          onClick={handleSubmit}
          type="submit"
        >
          {t('signIn')}
        </Button>
      </Box>
      {subtitle}
    </>
  );
};
export default AuthLogin;
