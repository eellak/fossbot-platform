import SidebarItems from './SidebarItems';
import Logo from '../../shared/logo/Logo';
import Scrollbar from 'src/components/custom-scroll/Scrollbar';

import { Profile } from './SidebarProfile/Profile';
import { AppState } from 'src/store/Store';
import { useSelector, useDispatch } from 'src/store/Store';
import { hoverSidebar, toggleMobileSidebar } from 'src/store/customizer/CustomizerSlice';
import { useMediaQuery, Box, Drawer, useTheme } from '@mui/material';
import CopyrightCredit from 'src/components/shared/CopyrightCredit';

const Sidebar = ({ previewAppearance = true }: { previewAppearance?: boolean }) => {
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const customizer = useSelector((state: AppState) => state.customizer);
  const dispatch = useDispatch();
  const theme = useTheme();
  const toggleWidth =
    customizer.isCollapse && !customizer.isSidebarHover
      ? customizer.MiniSidebarWidth
      : customizer.SidebarWidth;

  const onHoverEnter = () => {
    if (customizer.isCollapse) {
      dispatch(hoverSidebar(true));
    }
  };

  const onHoverLeave = () => {
    dispatch(hoverSidebar(false));
  };

  if (lgUp) {
    return (
      <Box
        sx={{
          width: toggleWidth,
          flexShrink: 0,
          ...(customizer.isCollapse && {
            position: 'absolute',
          }),
        }}
      >
        {/* ------------------------------------------- */}
        {/* Sidebar for desktop */}
        {/* ------------------------------------------- */}
        <Drawer
          anchor="left"
          open
          onMouseEnter={onHoverEnter}
          onMouseLeave={onHoverLeave}
          variant="permanent"
          PaperProps={{
            sx: {
              transition: theme.transitions.create('width', {
                duration: theme.transitions.duration.shortest,
              }),
              width: toggleWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {/* ------------------------------------------- */}
          {/* Sidebar Box */}
          {/* ------------------------------------------- */}
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ------------------------------------------- */}
            {/* Logo */}
            {/* ------------------------------------------- */}
            <Box px={3} >
              <Logo />
            </Box>
            {/* <Scrollbar sx={{ height: 'calc(100% - 190px)' }}> */}
            <Scrollbar sx={{ flex: 1, minHeight: 0 }}>
              {/* ------------------------------------------- */}
              {/* Sidebar Items */}
              {/* ------------------------------------------- */}
              <SidebarItems previewAppearance={previewAppearance} />
            </Scrollbar>
            {/* <Profile /> */}
            {!customizer.isCollapse && (
              <CopyrightCredit />
            )}
          </Box>
        </Drawer>
      </Box>
    );
  }

  return (
    <Drawer
      anchor="left"
      open={customizer.isMobileSidebar}
      onClose={() => dispatch(toggleMobileSidebar())}
      variant="temporary"
      PaperProps={{
        sx: {
          width: customizer.SidebarWidth,
          display: 'flex',
          flexDirection: 'column',

          // backgroundColor:
          //   customizer.activeMode === 'dark'
          //     ? customizer.darkBackground900
          //     : customizer.activeSidebarBg,
          // color: customizer.activeSidebarBg === '#ffffff' ? '' : 'white',
          border: '0 !important',
          boxShadow: (theme) => theme.shadows[8],
        },
      }}
    >
      {/* ------------------------------------------- */}
      {/* Logo */}
      {/* ------------------------------------------- */}
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box px={2}>
          <Logo />
        </Box>
        {/* ------------------------------------------- */}
        {/* Sidebar For Mobile */}
        {/* ------------------------------------------- */}
        <Scrollbar sx={{ flex: 1, minHeight: 0 }}>
          <SidebarItems previewAppearance={previewAppearance} />
        </Scrollbar>
        <CopyrightCredit />
      </Box>
    </Drawer>
  );
};

export default Sidebar;
