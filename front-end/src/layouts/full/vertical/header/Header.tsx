import { Box, AppBar, Toolbar, styled, Stack, Chip } from '@mui/material';

import { useSelector } from 'src/store/Store';

import UserMenu from 'src/components/user-menu/UserMenu';
import Language from './Language';
import { AppState } from 'src/store/Store';
import ToggleTheme from './ToggleTheme';
import SidebarToggle from './SidebarToggle';
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

  const customizer = useSelector((state: AppState) => state.customizer);

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
        <SidebarToggle />
        <Box flexGrow={1} />
        <Stack spacing={{ xs: 0.5, sm: 1 }} direction="row" alignItems="center">
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
          <UserMenu />
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};

export default Header;
