import React, { Suspense } from 'react';
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom/client';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { appHistory } from './routes/appHistory';
import App from './App';
import { store } from './store/Store';
import Spinner from './views/spinner/Spinner';
import './utils/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <Suspense fallback={<Spinner />}>
      <HistoryRouter history={appHistory}>
        <App />
      </HistoryRouter>
    </Suspense>
  </Provider>,
)
