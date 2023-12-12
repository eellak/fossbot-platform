// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import {
  AppBar,
  styled,
  Toolbar,
  Container,
  Box,
  Stack,
  useMediaQuery,
  IconButton,
  Drawer,
  Theme,
} from '@mui/material';
import Logo from 'src/layouts/full/shared/logo/Logo';
import Navigations from './Navigations';
import MobileSidebar from './MobileSidebar';
import { IconMenu2 } from '@tabler/icons-react';

const LpHeader = () => {
  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    justifyContent: 'center',
    [theme.breakpoints.up('lg')]: {
      minHeight: '80px',
    },
    backgroundColor: theme.palette.background.default,
  }));

  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: '100%',
    paddingLeft: '0 !important',
    paddingRight: '0 !important',
    color: theme.palette.text.secondary,
  }));

  //   sidebar
  const lgUp = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const lgDown = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));

  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const [y, setY] = React.useState(window.scrollY);

  const handleNavigation = React.useCallback(
    (e: Event | any) => {
      const window = e.currentTarget;
      setY(window.scrollY);
    },
    [],
  );

  React.useEffect(() => {
    setY(window.scrollY);
    window.addEventListener('scroll', handleNavigation);

    return () => {
      window.removeEventListener('scroll', handleNavigation);
    };
  }, [handleNavigation]);

  return (
    <AppBarStyled position="sticky" elevation={y ? 8 : 0}>
      <Container maxWidth="lg">
        <ToolbarStyled>
          <Logo />
          <Box flexGrow={1} />
          {lgDown ? (
            <IconButton color="inherit" aria-label="menu" onClick={handleDrawerOpen}>
              <IconMenu2 size="20" />
            </IconButton>
          ) : null}
          {lgUp ? (
            <Stack spacing={1} direction="row" alignItems="center">
              <Navigations />
            </Stack>
          ) : null}
        </ToolbarStyled>
      </Container>
      <Drawer
        anchor="left"
        open={open}
        variant="temporary"
        onClose={toggleDrawer(false)}
        PaperProps={{
          sx: {
            width: 270,
            border: '0 !important',
            boxShadow: (theme) => theme.shadows[8],
          },
        }}
      >
        <MobileSidebar />
      </Drawer>
    </AppBarStyled>
  );
};

export default LpHeader;
