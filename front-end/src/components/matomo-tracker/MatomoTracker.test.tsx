import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MatomoTracker from './MatomoTracker';
import { clearSharedReturn, rememberSharedReturn } from 'src/authentication/sharedProjectReturn';
declare const it: any, expect: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it('does not initialize tracking or enqueue capability paths on shared or pending-login routes', async () => {
  const path = '/shared-projects/' + 'x'.repeat(43);
  const div = document.createElement('div'); document.body.appendChild(div);
  const root = createRoot(div);
  window._mtm = [];
  try {
    await act(async () => root.render(<MemoryRouter key="shared" initialEntries={[path]}><MatomoTracker /></MemoryRouter>));
    expect(window._mtm).toEqual([]);
    rememberSharedReturn(path);
    await act(async () => root.render(<MemoryRouter key="login" initialEntries={['/auth/login']}><MatomoTracker /></MemoryRouter>));
    expect(window._mtm).toEqual([]);
    window._mtm.push({ event: 'already initialized' });
    await act(async () => root.render(<MemoryRouter key="again" initialEntries={[path]}><MatomoTracker /></MemoryRouter>));
    expect(window._mtm).toEqual([{ event: 'already initialized' }]);
  } finally { act(() => root.unmount()); div.remove(); clearSharedReturn(); }
});
