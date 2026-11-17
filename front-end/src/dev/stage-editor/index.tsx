import React, { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Navigate, Route, Routes, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { appHistory } from '../../routes/appHistory';
import { store } from '../../store/Store';
import { ThemeSettings } from '../../theme/Theme';
import { FeatureFlagsProvider } from '../../config/FeatureFlags';
import AssistantProvider from '../../ai/AssistantProvider';
import { NotificationProvider } from '../../components/notifications/NotificationProvider';
import { ConfirmDialogProvider } from '../../components/shared/ConfirmDialog';
import Spinner from '../../views/spinner/Spinner';
import { restoreSavedStage } from './restore';
import '../../index.css';
import '../../utils/i18n';

const StageBuilderPage = lazy(() => import('../../views/stage-builder-page/StageBuilderPage'));
const StageBuilderTestPage = lazy(() => import('../../views/stage-builder-test-page/StageBuilderTestPage'));

function EditorRoute() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    restoreSavedStage();
    setReady(true);
  }, []);
  return ready ? <StageBuilderPage /> : <Spinner />;
}

function StageEditorApp() {
  const theme = ThemeSettings();
  return (
    <FeatureFlagsProvider>
      <AssistantProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <NotificationProvider>
            <ConfirmDialogProvider>
              <Suspense fallback={<Spinner />}>
                <Routes>
                  <Route path="/stage-builder" element={<EditorRoute />} />
                  <Route path="/stage-builder/test" element={<StageBuilderTestPage />} />
                  <Route path="*" element={<Navigate to="/stage-builder" replace />} />
                </Routes>
              </Suspense>
            </ConfirmDialogProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AssistantProvider>
    </FeatureFlagsProvider>
  );
}

document.title = 'FOSSBot stage editor · development';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <HistoryRouter history={appHistory}><StageEditorApp /></HistoryRouter>
  </Provider>,
);
