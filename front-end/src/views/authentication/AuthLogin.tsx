import React, { useState } from 'react';
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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { IconMail } from '@tabler/icons-react';
import { loginType } from 'src/types/auth/auth';
import { useAuth } from '../../authentication/AuthProvider';
import googleIcon from 'src/assets/images/svgs/google-icon.svg';
import githubIcon from 'src/assets/images/svgs/github-icon.svg';

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error == null) return fallback;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const AuthLogin = ({ title, subtitle, subtext, handleShowErrorAlert }: loginType) => {
  const theme = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showUsernameLogin, setShowUsernameLogin] = useState(false);
  const [loginBannerError, setLoginBannerError] = useState('');

  const auth = useAuth();

  const renderSocialIcon = (provider: 'google' | 'github') => (
    <Box
      component="img"
      src={provider === 'google' ? googleIcon : githubIcon}
      alt=""
      aria-hidden="true"
      sx={{
        width: 18,
        height: 18,
        display: 'block',
        ...(provider === 'github' && theme.palette.mode === 'dark'
          ? { filter: 'brightness(0) invert(1)' }
          : {}),
      }}
    />
  );

  const accountExistsMessage = 'An account with this email already exists.';
  const socialLoginMessage = 'Please sign in with your social login provider.';
  const revokedAccessMessage = 'Your access to the platform has been revoked.';
  const shouldShowLoginBanner = (message: string) => [
    accountExistsMessage,
    socialLoginMessage,
    revokedAccessMessage,
  ].includes(message);

  const handleFirebaseLogin = async (provider) => {
    setLoginBannerError('');
    const success = await auth.loginWithFirebaseAction(provider);
    if (!success.success) {
      if (shouldShowLoginBanner(success.detail)) {
        setLoginBannerError(success.detail);
      } else {
        handleShowErrorAlert(success.detail);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoginBannerError('');

    try {
      if (username !== '' && password !== '') {
        const success = await auth.loginAction({ username: username, password: password });
        if (!success.success) {
          if (shouldShowLoginBanner(success.detail)) {
            setLoginBannerError(success.detail);
          } else {
            handleShowErrorAlert(success.detail);
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      handleShowErrorAlert(errorMessage(error, 'Login failed.'));
    }
  };

  return (
    <>
      {title ? (
        <Typography fontWeight="700" variant="h3" mb={1}>
          {title}
        </Typography>
      ) : null}

      {subtext}

      {loginBannerError && (
        <Box
          sx={{
            mt: 3,
            p: 1.5,
            borderRadius: 1,
            backgroundColor: '#fdecea',
            color: '#b42318',
            fontWeight: 600,
          }}
        >
          {loginBannerError}
        </Box>
      )}

      <Stack spacing={2} sx={{ mt: loginBannerError ? 2 : 3 }}>
        <Button
          color="inherit"
          variant="outlined"
          size="large"
          fullWidth
          onClick={() => handleFirebaseLogin('google')}
          startIcon={renderSocialIcon('google')}
          sx={{
            justifyContent: 'center',
            borderColor: '#2f3748',
            color: '#2f3748',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              borderColor: '#2f3748',
              backgroundColor: 'rgba(47, 55, 72, 0.03)',
              boxShadow: 'none',
            },
          }}
        >
          Continue with Google
        </Button>
        <Button
          color="inherit"
          variant="outlined"
          size="large"
          fullWidth
          onClick={() => handleFirebaseLogin('github')}
          startIcon={renderSocialIcon('github')}
          sx={{
            justifyContent: 'center',
            borderColor: '#2f3748',
            color: '#2f3748',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              borderColor: '#2f3748',
              backgroundColor: 'rgba(47, 55, 72, 0.03)',
              boxShadow: 'none',
            },
          }}
        >
          Continue with GitHub
        </Button>
        {!showUsernameLogin && (
          <Button
            color="inherit"
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => setShowUsernameLogin(true)}
            startIcon={<IconMail size={18} stroke={1.8} />}
            sx={{
              justifyContent: 'center',
              borderColor: '#2f3748',
              color: '#2f3748',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                borderColor: '#2f3748',
                backgroundColor: 'rgba(47, 55, 72, 0.03)',
                boxShadow: 'none',
              },
            }}
          >
            Continue with username
          </Button>
        )}
      </Stack>

      {showUsernameLogin && (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Stack>
            <Box>
              <CustomFormLabel htmlFor="username">Username</CustomFormLabel>
              <CustomTextField
                id="username"
                type="text"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fff',
                  },
                }}
              />
            </Box>

            <Box>
              <CustomFormLabel htmlFor="password">Password</CustomFormLabel>
              <CustomTextField
                id="password"
                type="password"
                variant="outlined"
                fullWidth
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fff',
                  },
                }}
              />
            </Box>

            <Stack justifyContent="space-between" direction="row" alignItems="center" my={2}>
              <FormGroup>
                <FormControlLabel
                  control={<CustomCheckbox defaultChecked />}
                  label={
                    <Typography sx={{ color: '#2f3748' }}>
                      Remember this device
                    </Typography>
                  }
                />
              </FormGroup>
              <Typography
                component={Link}
                to="/auth/forgot-password"
                fontWeight="500"
                sx={{
                  textDecoration: 'none',
                  color: '#6f84ff',
                  whiteSpace: 'nowrap',
                }}
              >
                Forgot password?
              </Typography>
            </Stack>

            <Button
              color="primary"
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSubmit}
              type="submit"
              sx={{
                backgroundColor: '#6f84ff',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#5f76f7',
                  boxShadow: 'none',
                },
              }}
            >
              Sign in
            </Button>
          </Stack>
        </Box>
      )}

      {subtitle}

    </>
  );
};
export default AuthLogin;
