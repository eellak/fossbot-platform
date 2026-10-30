import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { createMemoryHistory } from 'history';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { useSharedProjectDeparture } from './useSharedProjectDeparture';
declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockConfirm = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/components/shared/ConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
it('blocks dirty PUSH/REPLACE/POP, keeps the first pending request, and releases once saved', async () => {
  const history = createMemoryHistory({ initialEntries: ['/start', '/shared'], initialIndex: 1 });
  const div = document.createElement('div'); document.body.appendChild(div);
  const root = createRoot(div);
  let release = () => {};
  const Probe = ({ dirty }: { dirty: boolean }) => { release = useSharedProjectDeparture(dirty); return null; };
  let answer: (accepted: boolean) => void = () => {};
  mockConfirm.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
  try {
    await act(async () => { root.render(<HistoryRouter history={history as any}><Probe dirty /></HistoryRouter>); });
    act(() => { history.push('/first'); history.push('/ignored'); });
    expect(history.location.pathname).toBe('/shared');
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    await act(async () => { answer(false); });
    act(() => history.replace('/replacement'));
    await act(async () => { answer(true); });
    expect(history.location.pathname).toBe('/replacement');
    act(() => history.back());
    expect(history.location.pathname).toBe('/replacement');
    await act(async () => { answer(false); });
    act(() => { release(); history.push('/saved'); });
    expect(history.location.pathname).toBe('/saved');
  } finally { act(() => root.unmount()); div.remove(); }
});
