import React from 'react';
import { IconButton, Box, AppBar, useMediaQuery, Toolbar, styled, Stack, Chip } from '@mui/material';

import { useSelector, useDispatch } from 'src/store/Store';
import { toggleSidebar, toggleMobileSidebar } from 'src/store/customizer/CustomizerSlice';

import { IconMenu2 } from '@tabler/icons-react';
import Notifications from './Notification';
import UserMenu from 'src/components/user-menu/UserMenu';
import Cart from './Cart';
import Search from './Search';
import Language from './Language';
import { AppState } from 'src/store/Store';
import Navigation from './Navigation';
import MobileRightSidebar from './MobileRightSidebar';
import ToggleTheme from './ToggleTheme';
import { useAuth } from 'src/authentication/AuthProvider';
import { useTranslation } from 'react-i18next';

const AppBarStyled = styled(AppBar)(({ theme }) => ({
  boxShadow: 'none',
  background: theme.palette.background.paper,
  justifyContent: 'center',
  backdropFilter: 'blur(4px)',
}));

const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
  width: '100%',
  color: theme.palette.text.secondary,
}));

const Header = () => {
  const { isGuest } = useAuth();
  const { t } = useTranslation();
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const lgDown = useMediaQuery((theme: any) => theme.breakpoints.down('lg'));

  // drawer
  const customizer = useSelector((state: AppState) => state.customizer);
  const dispatch = useDispatch();

  return (
    <AppBarStyled
      position="sticky"
      color="default"
      sx={(theme) => ({
        [theme.breakpoints.up('lg')]: {
          minHeight: customizer.TopbarHeight,
        },
      })}
    >
      <ToolbarStyled>
        {/* ------------------------------------------- */}
        {/* Toggle Button Sidebar */}
        {/* ------------------------------------------- */}
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={lgUp ? () => dispatch(toggleSidebar()) : () => dispatch(toggleMobileSidebar())}
        >
          <IconMenu2 size="20" />
        </IconButton>

        {/* ------------------------------------------- */}
        {/* Search Dropdown */}
        {/* ------------------------------------------- */}
        {/* <Search /> */}
        {/* {lgUp ? (
          <>
            <Navigation />
          </>
        ) : null} */}
        <Box flexGrow={1} />
        <Stack spacing={2} direction="row" alignItems="center">
          {isGuest && (
            <Chip
              size="small"
              label={t('guest.viewBadge')}
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 600 }}
            />
          )}
          <ToggleTheme />
          <Language />
          {/* ------------------------------------------- */}
          {/* Ecommerce Dropdown */}
          {/* ------------------------------------------- */}
          {/* <Cart /> */}
          {/* ------------------------------------------- */}
          {/* End Ecommerce Dropdown */}
          {/* ------------------------------------------- */}
          {/* <Notifications /> */}
          {/* ------------------------------------------- */}
          {/* Toggle Right Sidebar for mobile */}
          {/* ------------------------------------------- */}
          {/* {lgDown ? <MobileRightSidebar /> : null} */}
          <UserMenu />
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};


export default Header;
