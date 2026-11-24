
import React, { useState, useEffect } from 'react';
import * as dropdownData from './data';
import { Link } from 'react-router-dom';
import {
  Box,
  Popover,
  Tooltip,
  Avatar,
  Typography,
  Divider,
  Button,
  IconButton,
  Stack
} from '@mui/material';
import { IconMail } from '@tabler/icons-react';
import { useAuth } from "src/authentication/AuthProvider";
import { useTranslation } from 'react-i18next';
import { UserRole } from 'src/authentication/AuthInterfaces';


const UserMenu = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const [user, setUser] = useState(auth.user);
  const [anchorEl2, setAnchorEl2] = useState(null);

  const open = Boolean(anchorEl2);
  const panelTitle = t(auth.isGuest ? 'guest.menuTitle' : 'userProfile');

  const handleClick2 = (event: any) => {
    setAnchorEl2(event.currentTarget);
  };
  const handleClose2 = () => {
    setAnchorEl2(null);
  };

  useEffect(() => {
    if (auth.user) {
      setUser(auth.user);
    }
  }, [auth.user]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.authStatus !== 'authenticated' || !auth.token || auth.isGuest) {
        return;
      }

      try {
        const userData = await auth.getUserDataAction();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [auth.authStatus, auth.isGuest, auth.token]);

  return (
    <Box>
      <Tooltip title={panelTitle}>
        <IconButton
          aria-label={panelTitle}
          aria-controls={open ? 'account-panel' : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          color="inherit"
          sx={{ width: 44, height: 44, borderRadius: 1 }}
          onClick={handleClick2}
        >
          <Avatar src={auth.isGuest ? undefined : user?.image_url} alt="" sx={{ width: 32, height: 32 }} />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl2}
        open={open}
        onClose={handleClose2}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        PaperProps={{
          id: 'account-panel', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'account-panel-title',
          sx: { width: 360, p: 4 },
        }}
      >
        <Typography id="account-panel-title" variant="h5">{panelTitle}</Typography>
        <Stack direction="row" py={3} spacing={2} alignItems="center">
          <Avatar src={auth.isGuest ? undefined : user?.image_url} alt={auth.isGuest ? auth.guest?.alias : user?.username} sx={{ width: 95, height: 95 }} />
          <Box>
            <Typography variant="subtitle2" color="textPrimary" fontWeight={600}>
              {auth.isGuest ? auth.guest?.alias : `${user?.firstname} ${user?.lastname}`}
            </Typography>
            <Typography variant="subtitle2" color="textSecondary">
              {auth.isGuest ? t('guest.session') : user?.role}
            </Typography>
            {auth.isGuest ? (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                {t('guest.localOnly')}
              </Typography>
            ) : (
              <Typography
                variant="subtitle2"
                color="textSecondary"
                display="flex"
                alignItems="center"
                gap={1}
              >
                <IconMail width={15} height={15} />
                {user?.email}
              </Typography>
            )}
          </Box>
        </Stack>
        <Divider />
        {!auth.isGuest && dropdownData.profileMenuPages.map((profile) => (
          <Box key={profile.title}>
            <Box sx={{ py: 2, px: 0 }} className="hover-text-primary">
              <Link to={profile.href} onClick={handleClose2}>
                <Stack direction="row" spacing={2}>
                  <Box
                    width="45px"
                    height="45px"
                    bgcolor="primary.light"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Box
                      component="img"
                      src={profile.icon}
                      alt=""
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 0,
                      }}
                    />
                  </Box>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={600}
                      color="textPrimary"
                      className="text-hover"
                      noWrap
                      sx={{
                        width: '240px',
                      }}
                    >
                      {t(profile.title)}
                    </Typography>
                    <Typography
                      color="textSecondary"
                      variant="subtitle2"
                      sx={{
                        width: '240px',
                      }}
                      noWrap
                    >
                      {t(profile.subtitle)}
                    </Typography>
                  </Box>
                </Stack>
              </Link>
            </Box>
          </Box>
        ))}
        {!auth.isGuest && user && user.role === UserRole.ADMIN ? (
          <div>
            {dropdownData.adminPages.map((admin) => (
              <Box key={admin.title}>
                <Box sx={{ py: 2, px: 0 }} className="hover-text-primary">
                  <Link to={admin.href} onClick={handleClose2}>
                    <Stack direction="row" spacing={2}>
                      <Box
                        width="45px"
                        height="45px"
                        bgcolor="primary.light"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Box
                          component="img"
                          src={admin.icon}
                          alt=""
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: 0,
                          }}
                        />
                      </Box>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          color="textPrimary"
                          className="text-hover"
                          noWrap
                          sx={{
                            width: '240px',
                          }}
                        >
                          {t(admin.title)}
                        </Typography>
                        <Typography
                          color="textSecondary"
                          variant="subtitle2"
                          sx={{
                            width: '240px',
                          }}
                          noWrap
                        >
                          {t(admin.subtitle)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Link>
                </Box>
              </Box>
            ))}
          </div>
        ) : <div> </div>}
        <Box mt={2}>
          <Button variant="outlined" color="primary" onClick={() => auth.logOutAction()} fullWidth>
            {auth.isGuest ? t('guest.exit') : t('logOut')}
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};

export default UserMenu;
