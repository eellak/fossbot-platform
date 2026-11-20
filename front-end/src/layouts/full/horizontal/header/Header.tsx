import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import UserMenu from 'src/components/user-menu/UserMenu';
import Search from 'src/layouts/full/vertical/header/Search';
import Language from 'src/layouts/full/vertical/header/Language';
import Logo from 'src/layouts/full/shared/logo/Logo';

import {
  IconButton,
  Box,
  AppBar,
  useMediaQuery,
  Toolbar,
  styled,
  Stack,
  Theme,
} from '@mui/material';

import { useSelector } from 'src/store/Store';
import SidebarToggle from 'src/layouts/full/vertical/header/SidebarToggle';
import { AppState } from 'src/store/Store';

const Header = () => {
  const lgDown = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));

  // drawer
  const customizer = useSelector((state: AppState) => state.customizer);

  const AppBarStyled = useMemo(
    () => styled(AppBar)(({ theme }) => ({
      background: theme.palette.background.paper,
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',

      [theme.breakpoints.up('lg')]: {
        minHeight: customizer.TopbarHeight,
      },
    })),
    [customizer.TopbarHeight]
  );
  const ToolbarStyled = useMemo(
    () => styled(Toolbar)(() => ({ margin: '0 auto', width: '100%' })),
    []
  );

  return (
    <AppBarStyled position="sticky" color="default" elevation={8}>
      <ToolbarStyled
        sx={{
          maxWidth: customizer.isLayout === 'boxed' ? 'lg' : '100%!important',
        }}
      >
        {lgDown ? (
          <>
            <SidebarToggle />
            <IconButton component={Link} to="/" sx={{ width: 44, height: 44, borderRadius: 1 }}>
              <Box component="img" src="/fossbot-favicon.png" width={24} height={24} alt="FOSSBot" />
            </IconButton>
          </>
        ) : <Logo />}
        <Search />
        <Box flexGrow={1} />
        <Stack spacing={{ xs: 0.5, sm: 1 }} direction="row" alignItems="center">
          <Language />
          <UserMenu />
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};

export default Header;
