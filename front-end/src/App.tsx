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
import { RobotConnectionProvider } from './robot/RobotConnectionContext';
import { FeatureFlagsProvider } from './config/FeatureFlags';
import AssistantProvider from './ai/AssistantProvider';
import { NotificationProvider } from './components/notifications/NotificationProvider';

function App() {
  const routing = useRoutes(Router);
  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);
  const { pathname } = useLocation();
  const isEducationRoute = pathname === '/courses'
    || pathname.startsWith('/courses/')
    || pathname === '/classrooms'
    || pathname === '/teach/classrooms'
    || pathname === '/teach/courses'
    || pathname.startsWith('/teach/courses/');
  return (
      <AuthProvider>
        <FeatureFlagsProvider>
          <AssistantProvider>
            <ThemeProvider theme={theme}>
              <NotificationProvider>
                <RTL direction={customizer.activeDir}>
                  <CssBaseline />
                  <MatomoTracker />
                  <RobotConnectionProvider>
                    <ScrollToTop>{isEducationRoute ? <div style={{ overflowX: 'clip' }}>{routing}</div> : routing}</ScrollToTop>
                  </RobotConnectionProvider>
                </RTL>
              </NotificationProvider>
            </ThemeProvider>
          </AssistantProvider>
        </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
