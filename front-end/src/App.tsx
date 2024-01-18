import { useRoutes } from 'react-router-dom';
import { useSelector } from './store/Store';
import { ThemeSettings } from './theme/Theme';
import RTL from './layouts/full/shared/customizer/RTL';
import ScrollToTop from './components/shared/ScrollToTop';
import Router from './routes/Router';
import { AppState } from './store/Store';
import { CssBaseline, ThemeProvider } from '@mui/material';
import AuthProvider from './authentication/AuthProvider';
function App() {
  const routing = useRoutes(Router);
  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);
  return (
    <AuthProvider>
    <ThemeProvider theme={theme}>
      <RTL direction={customizer.activeDir}>
        <CssBaseline />
        <ScrollToTop>{routing}</ScrollToTop>
      </RTL>
    </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
