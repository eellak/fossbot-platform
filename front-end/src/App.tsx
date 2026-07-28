import { useLocation, useRoutes } from 'react-router-dom';
import { useSelector } from './store/Store';
import { ThemeSettings } from './theme/Theme';
import RTL from './layouts/full/shared/customizer/RTL';
import ScrollToTop from './components/shared/ScrollToTop';
import Router from './routes/Router';
import { AppState } from './store/Store';
import { CssBaseline, ThemeProvider } from '@mui/material';
import AuthProvider from './authentication/AuthProvider';
import MatomoTracker from './components/matomo-tracker/MatomoTracker';
import { useMediaQuery } from '@mui/material';
import PageContainer from './components/container/PageContainer';
import Footer from './components/landingpage/footer/Footer';
import DevicesPage from './components/devices-page/DevicesPage';
import { useTranslation } from 'react-i18next';
import { RobotConnectionProvider } from './robot/RobotConnectionContext';
import { FeatureFlagsProvider } from './config/FeatureFlags';

function App() {
  const routing = useRoutes(Router);
  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);
  const isMobile = useMediaQuery('(max-width:768px)');
  const { pathname } = useLocation();
  const isEducationRoute = pathname === '/courses'
    || pathname.startsWith('/courses/')
    || pathname === '/classrooms'
    || pathname === '/teach/classrooms'
    || pathname === '/teach/courses'
    || pathname.startsWith('/teach/courses/');
  const { t } = useTranslation();


  if (isMobile && !isEducationRoute) {
    return (
      <>
        <div className="devices-page">
          <PageContainer title={t('device_page.title')} description={t('device_page.errorMessage')}>
            <DevicesPage />
            <Footer />
          </PageContainer>
        </div>
      </>
    );
  }

  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <ThemeProvider theme={theme}>
          <RTL direction={customizer.activeDir}>
            <CssBaseline />
            <MatomoTracker />
            <RobotConnectionProvider>
              <ScrollToTop>{isEducationRoute ? <div style={{ overflowX: 'clip' }}>{routing}</div> : routing}</ScrollToTop>
            </RobotConnectionProvider>
          </RTL>
        </ThemeProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
