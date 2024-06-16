import { useRoutes } from 'react-router-dom';
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

function App() {
  const routing = useRoutes(Router);
  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);
  const isMobile = useMediaQuery('(max-width:768px)');

  if (isMobile) {
    return (
      <>
        <div className="devices-page">
          <PageContainer title={'test'} description={'test'}>
            <DevicesPage />
            <Footer />
          </PageContainer>
        </div>
      </>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <RTL direction={customizer.activeDir}>
          <CssBaseline />
          <MatomoTracker />
          <ScrollToTop>{routing}</ScrollToTop>
        </RTL>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
