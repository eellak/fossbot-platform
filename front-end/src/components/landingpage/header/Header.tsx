 
import React, { useMemo } from 'react';
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
import Language from 'src/layouts/full/vertical/header/Language';

const LpHeader = () => {
  const AppBarStyled = useMemo(
    () => styled(AppBar)(({ theme }) => ({
      justifyContent: 'center',

      [theme.breakpoints.up('lg')]: {
        minHeight: '80px',
      },
      backgroundColor: theme.palette.background.default,
    })),
    []
  );

  const ToolbarStyled = useMemo(
    () => styled(Toolbar)(({ theme }) => ({
      width: '100%',
      paddingLeft: '0 !important',
      paddingRight: '0 !important',
      color: theme.palette.text.secondary,
    })),
    []
  );

  const lgUp = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <AppBarStyled position="sticky" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <ToolbarStyled>
          <Logo />
          <Box flexGrow={1} />
          {lgUp && (
            <Stack spacing={1} direction="row" alignItems="center">
              <Navigations />
            </Stack>
          )}
          <Box sx={{ ml: { lg: 2 }, flexShrink: 0 }}>
            <Language />
          </Box>
          {!lgUp && (
            <IconButton color="inherit" aria-label="menu" onClick={handleDrawerOpen}>
              <IconMenu2 size="20" />
            </IconButton>
          )}
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
