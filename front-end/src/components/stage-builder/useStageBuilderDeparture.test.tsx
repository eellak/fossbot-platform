import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { createMemoryHistory } from 'history';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { useStageBuilderDeparture } from './useStageBuilderDeparture';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('guards push, replace and browser back, uses the latest callback, and never queues duplicate exits', async () => {
  const history = createMemoryHistory({ initialEntries: ['/stages', '/stage-builder'], initialIndex: 1 });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  let answer: (accepted: boolean) => void = () => {};
  const confirm = jest.fn(() => new Promise<boolean>(resolve => { answer = resolve; }));
  const latestConfirm = jest.fn(() => new Promise<boolean>(resolve => { answer = resolve; }));
  let release = () => {};
  const Probe = ({ dirty, callback }: { dirty: boolean; callback: () => Promise<boolean> }) => {
    release = useStageBuilderDeparture(dirty, callback);
    return null;
  };
  const render = async (dirty: boolean, callback = confirm) => {
    await act(async () => { root.render(<HistoryRouter history={history as any}><Probe dirty={dirty} callback={callback} /></HistoryRouter>); });
  };
  try {
    await render(true);
    act(() => { history.push('/dashboard'); history.push('/ignored'); });
    expect(history.location.pathname).toBe('/stage-builder');
    expect(confirm).toHaveBeenCalledTimes(1);
    // Draft persistence rerenders the editor while its confirmation is open.
    await render(true, latestConfirm);
    await act(async () => { answer(false); });
    expect(history.location.pathname).toBe('/stage-builder');
    act(() => history.replace('/replacement'));
    expect(latestConfirm).toHaveBeenCalledTimes(1);
    await act(async () => { answer(true); });
    expect(history.location.pathname).toBe('/replacement');
    act(() => history.back());
    expect(history.location.pathname).toBe('/replacement');
    await act(async () => { answer(false); });
    act(() => history.back());
    await act(async () => { answer(true); });
    expect(history.location.pathname).toBe('/stages');
    await render(false);
    act(() => history.push('/saved'));
    expect(history.location.pathname).toBe('/saved');
    await render(true);
    act(() => { release(); history.push('/deleted'); });
    expect(history.location.pathname).toBe('/deleted');
  } finally { act(() => root.unmount()); host.remove(); }
});

test('unmount cancels a pending departure instead of navigating later', async () => {
  const history = createMemoryHistory({ initialEntries: ['/stage-builder'] });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  let answer: (accepted: boolean) => void = () => {};
  const confirm = () => new Promise<boolean>(resolve => { answer = resolve; });
  const Probe = () => { useStageBuilderDeparture(true, confirm); return null; };
  await act(async () => { root.render(<HistoryRouter history={history as any}><Probe /></HistoryRouter>); });
  act(() => history.push('/dashboard'));
  act(() => root.unmount());
  await act(async () => { answer(true); });
  expect(history.location.pathname).toBe('/stage-builder');
  history.push('/after-unmount');
  expect(history.location.pathname).toBe('/after-unmount');
  host.remove();
});

test('save and leave retries the original navigation after saving makes the editor clean', async () => {
  const history = createMemoryHistory({ initialEntries: ['/stage-builder'] });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  let answer: (accepted: boolean) => void = () => {};
  const confirm = () => new Promise<boolean>(resolve => { answer = resolve; });
  const Probe = ({ dirty }: { dirty: boolean }) => { useStageBuilderDeparture(dirty, confirm); return null; };
  try {
    act(() => root.render(<HistoryRouter history={history as any}><Probe dirty /></HistoryRouter>));
    act(() => history.push('/stages'));
    act(() => root.render(<HistoryRouter history={history as any}><Probe dirty={false} /></HistoryRouter>));
    await act(async () => answer(true));
    expect(history.location.pathname).toBe('/stages');
    act(() => history.push('/dashboard'));
    expect(history.location.pathname).toBe('/dashboard');
  } finally { act(() => root.unmount()); host.remove(); }
});
