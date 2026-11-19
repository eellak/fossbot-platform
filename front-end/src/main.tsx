import React, { Suspense } from 'react';
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom/client';
import { ProjectHistoryRouter } from 'src/routes/ProjectHistoryRouter';
import { appHistory } from './routes/appHistory';
import App from './App';
import { store } from './store/Store';
import Spinner from './views/spinner/Spinner';
import './utils/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <Suspense fallback={<Spinner />}>
      <ProjectHistoryRouter history={appHistory}>
        <App />
      </ProjectHistoryRouter>
    </Suspense>
  </Provider>,
)
