import { FC } from 'react';
import { styled, Container, Box, useTheme } from '@mui/material';
import { useSelector } from 'src/store/Store';
import { Outlet, useLocation } from 'react-router-dom';
import { AppState } from 'src/store/Store';
import Sidebar from './vertical/sidebar/Sidebar';
import Navigation from '../full/horizontal/navbar/Navigation';
import Header from './vertical/header/Header';
import HorizontalHeader from './horizontal/header/Header';
import CopyrightCredit from 'src/components/shared/CopyrightCredit';
const MainWrapper = styled('div')(() => ({
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
}));

const PageWrapper = styled('div')(({theme}) => ({
  display: 'flex',
  flexGrow: 1,
  // paddingBottom: '60px',
  flexDirection: 'column',
  zIndex: 1,
  width: '100%',
  backgroundColor: 'transparent'
}));

const FullLayout: FC<{ previewAppearance?: boolean }> = ({ previewAppearance = false }) => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const { pathname } = useLocation();
  const fullBleedWorkspace = previewAppearance && /\/(course-workspace|python|blockly)\/?$/.test(pathname);

  const theme = useTheme();

  return (
    <MainWrapper
      className={customizer.activeMode === 'dark' ? 'darkbg mainwrapper' : 'lightbg mainwrapper'}
    >
      {/* ------------------------------------------- */}
      {/* Sidebar */}
      {/* ------------------------------------------- */}
      {customizer.isHorizontal ? '' : <Sidebar previewAppearance={previewAppearance} />}
      {/* ------------------------------------------- */}
      {/* Main Wrapper */}
      {/* ------------------------------------------- */}
      <PageWrapper
        className="page-wrapper"
        sx={{
          ...(customizer.isCollapse && {
            [theme.breakpoints.up('lg')]: { ml: `${customizer.MiniSidebarWidth}px` },
          }),
        }}
        theme={theme}
      >
        {/* ------------------------------------------- */}
        {/* Header */}
        {/* ------------------------------------------- */}
        {customizer.isHorizontal ? <HorizontalHeader /> : <Header />}
        {/* PageContent */}
        {customizer.isHorizontal ? <Navigation /> : ''}
        <Container
          disableGutters={fullBleedWorkspace}
          sx={{
            maxWidth:'100%!important'
          }}
        >
          {/* ------------------------------------------- */}
          {/* PageContent */}
          {/* ------------------------------------------- */}
         
          <Box sx={{ minHeight: `calc(100vh - ${previewAppearance ? 181 : 178}px)` }}>
            <Outlet />
          </Box>
          {/* ------------------------------------------- */}
          {/* End Page */}
          {/* ------------------------------------------- */}
          
        </Container>
        {customizer.isHorizontal && <CopyrightCredit />}
        {/* <Customizer /> */}
      </PageWrapper>
      
    </MainWrapper>
    
  );
};

export default FullLayout;
