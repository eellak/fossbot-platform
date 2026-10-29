import { Box, Avatar, Typography, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { useSelector } from 'src/store/Store';
import { IconPower } from '@tabler/icons-react';
import { AppState } from 'src/store/Store';
import { Link } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import { useTranslation } from 'react-i18next';

export const Profile = () => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const { user, isGuest, guest } = useAuth();
  const { t } = useTranslation();
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const hideMenu = lgUp ? customizer.isCollapse && !customizer.isSidebarHover : '';

  return (
    <Box
      display={'flex'}
      alignItems="center"
      gap={2}
      sx={{ m: 3, p: 2, bgcolor: `${'secondary.light'}` }}
    >
      {!hideMenu ? (
        <>
          <Avatar alt={isGuest ? guest?.alias || '' : user?.username || ''} src={isGuest ? undefined : user?.image_url} />

          <Box>
            <Typography variant="h6">{isGuest ? guest?.alias : `${user?.firstname || ''} ${user?.lastname || ''}`.trim() || user?.username}</Typography>
            <Typography variant="caption">{isGuest ? t('guest.session') : user?.email}</Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Logout" placement="top">
              <IconButton
                color="primary"
                component={Link}
                to="auth/login"
                aria-label="logout"
                size="small"
              >
                <IconPower size="20" />
              </IconButton>
            </Tooltip>
          </Box>
        </>
      ) : (
        ''
      )}
    </Box>
  );
};
