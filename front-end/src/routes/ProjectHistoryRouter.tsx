import { useSyncExternalStore, type ReactNode } from 'react';
import type { History } from 'history';
import { Router } from 'react-router-dom';

// The project and admin editors use history.block() to protect unsaved edits.
export function ProjectHistoryRouter({ history, children }: { history: History; children: ReactNode }) {
  const location = useSyncExternalStore(history.listen, () => history.location);
  return <Router location={location} navigationType={history.action} navigator={history}>{children}</Router>;
}
