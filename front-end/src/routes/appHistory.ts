import { createBrowserHistory, type To } from 'history';

const history = createBrowserHistory();

export const appHistory = Object.assign(history, {
  createURL: (to: To) => new URL(history.createHref(to), window.location.href),
});
