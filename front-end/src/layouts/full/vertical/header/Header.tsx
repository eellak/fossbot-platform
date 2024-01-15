import { IconButton, Box, AppBar, useMediaQuery, Toolbar, styled, Stack } from '@mui/material';

import { useSelector, useDispatch } from 'src/store/Store';
import { toggleSidebar, toggleMobileSidebar } from 'src/store/customizer/CustomizerSlice';
 
import { IconMenu2 } from '@tabler/icons-react';
import Notifications from './Notification';
import Profile from './Profile';
import Cart from './Cart';
import Search from './Search';
import Language from './Language';
import { AppState } from 'src/store/Store';
import Navigation from './Navigation';
import MobileRightSidebar from './MobileRightSidebar';
import ToggleTheme from './ToggleTheme';
// import WbSunnyTwoToneIcon from '@mui/icons-material/WbSunnyTwoTone';
// import DarkModeTwoToneIcon from '@mui/icons-material/DarkModeTwoTone';
// import { BoxProps } from '@mui/material/Box';
// import { setDarkMode} from 'src/store/customizer/CustomizerSlice';
// import { ToggleButton, ToggleButtonGroup } from '@mui/material';

// const StyledBox = styled(Box)<BoxProps>(({ theme }) => ({
//   boxShadow: theme.shadows[8],
//   padding: '20px',
//   cursor: 'pointer',
//   justifyContent: 'center',
//   display: 'flex',
//   transition: '0.1s ease-in',
//   border: '1px solid rgba(145, 158, 171, 0.12)',
//   '&:hover': {
//     transform: 'scale(1.05)',
//   },
// }));

const Header = () => {
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const lgDown = useMediaQuery((theme: any) => theme.breakpoints.down('lg'));

  // drawer
  const customizer = useSelector((state: AppState) => state.customizer);
  const dispatch = useDispatch();

  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    boxShadow: 'none',
    background: theme.palette.background.paper,
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    [theme.breakpoints.up('lg')]: {
      minHeight: customizer.TopbarHeight,
    },
  }));
  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: '100%',
    color: theme.palette.text.secondary,
  }));

  return (
    <AppBarStyled position="sticky" color="default">
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
        <Search />
        {/* {lgUp ? (
          <>
            <Navigation />
          </>
        ) : null} */}
        <Box flexGrow={1} />
        <Stack spacing={2} direction="row" alignItems="center">
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
          {lgDown ? <MobileRightSidebar /> : null}
          <Profile />
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};


export default Header;
