import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { recentLibraryKey, restoreBlankStageFavourites, useLibraryShortlists } from './stageBuilderRecentItems';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('saved stage keys ignore revisions, while drafts and users have separate shortlists', () => {
  const key = (sourceLocator: string, recoveryId = 'draft-a', scope = 'user-a') => recentLibraryKey(scope, { sourceLocator, recoveryId });
  for (const [first, next] of [
    ['Browser stage abc revision 1', 'Browser stage abc revision 2'],
    ['Account stage 42 revision 1', 'Account stage 42 revision 2'],
    ['GitHub owner/repo @ old', 'GitHub owner/repo @ new'],
  ]) expect(key(first)).toBe(key(next, 'different-session'));
  expect(key('New stage')).not.toBe(key('New stage', 'draft-b'));
  expect(key('Account stage 42 revision 1')).not.toBe(key('Account stage 43 revision 1'));
  expect(key('New stage')).not.toBe(key('New stage', 'draft-a', 'user-b'));
  expect(recentLibraryKey('user', null)).toBeNull();
});

test('shortlists survive remounts, stay isolated on stage/user changes and follow the first save', () => {
  window.localStorage.clear();
  const host = document.createElement('div');
  let root = createRoot(host);
  let history: ReturnType<typeof useLibraryShortlists>;
  function Harness({ scope, locator, draft = 'draft-a' }: { scope: string; locator: string; draft?: string }) {
    history = useLibraryShortlists(scope, { sourceLocator: locator, recoveryId: draft });
    return <span>{history.recentLibraryItems.map(item => item.id).join(',')}</span>;
  }
  const render = (scope = 'user-a', locator = 'New stage', draft?: string) => act(() => root.render(<Harness scope={scope} locator={locator} draft={draft} />));
  try {
    render();
    act(() => {
      history.rememberRecentItem({ type: 'object', id: 'wall' });
      history.rememberRecentItem({ type: 'object', id: 'block' });
      history.rememberRecentItem({ type: 'prefab', id: 'bridge' });
    });
    expect(host.textContent).toBe('bridge,block,wall');
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(host.textContent).toBe('bridge,block,wall');
    render('user-a', 'New stage', 'draft-b');
    expect(host.textContent).toBe('');
    act(() => history.rememberRecentItem({ type: 'object', id: 'camera' }));
    render();
    expect(host.textContent).toBe('bridge,block,wall');
    const finishSave = history!.carryLibraryItemsTo;
    act(() => history.rememberRecentItem({ type: 'object', id: 'sphere' }));
    finishSave('Account stage 42 revision 1');
    render('user-a', 'Account stage 42 revision 2', 'saved-session');
    expect(host.textContent).toBe('sphere,bridge,block,wall');
    render('user-b', 'Account stage 42 revision 2');
    expect(host.textContent).toBe('');
    render('user-a', 'New stage', 'draft-b');
    expect(host.textContent).toBe('camera');
  } finally { act(() => root.unmount()); window.localStorage.clear(); }
});

test('invalid storage is ignored and unavailable storage does not prevent adding items', () => {
  const identity = { sourceLocator: 'New stage', recoveryId: 'validation' };
  const key = recentLibraryKey('user', identity)!;
  const host = document.createElement('div');
  let history: ReturnType<typeof useLibraryShortlists>;
  function Harness() {
    history = useLibraryShortlists('user', identity);
    return <span>{history.recentLibraryItems.map(item => item.id).join(',')}</span>;
  }
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (const [raw, expected] of [
      ['{broken', ''], ['null', ''], ['{}', ''],
      [JSON.stringify([null, {}, { type: 'object', id: 'unknown' }, { type: 'object', id: 'floor' }, { type: 'prefab', id: '' },
        { type: 'object', id: 'block' }, { type: 'object', id: 'block' }, { type: 'prefab', id: 'block' },
        { type: 'object', id: 'camera' }, { type: 'object', id: 'sphere' }, { type: 'object', id: 'ramp' }]), 'block,block,camera,sphere'],
    ]) {
      window.localStorage.setItem(key, raw);
      const root = createRoot(host);
      act(() => root.render(<Harness />));
      expect(host.textContent).toBe(expected);
      act(() => root.unmount());
    }
    const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    const root = createRoot(host);
    try {
      act(() => root.render(<Harness />));
      act(() => history.rememberRecentItem({ type: 'object', id: 'sphere' }));
      expect(host.textContent).toBe('sphere');
    } finally { act(() => root.unmount()); read.mockRestore(); write.mockRestore(); }
  } finally { warn.mockRestore(); window.localStorage.clear(); }
});

test('all favourites survive reload and first save, stay scoped and can be cleared', () => {
  window.localStorage.clear();
  const host = document.createElement('div');
  let root = createRoot(host);
  let lists: ReturnType<typeof useLibraryShortlists>;
  function Harness({ user, locator, draft }: { user: string; locator: string; draft: string }) {
    lists = useLibraryShortlists(user, { sourceLocator: locator, recoveryId: draft });
    return <span>{lists.favouriteItems.map(item => item.id).join(',')}</span>;
  }
  const render = (user = 'a', locator = 'New stage', draft = 'draft') => act(() => root.render(<Harness user={user} locator={locator} draft={draft} />));
  const kinds = ['block', 'wall', 'camera', 'light', 'line'] as const;
  try {
    render();
    act(() => kinds.forEach(id => lists.toggleFavourite({ type: 'object', id })));
    act(() => root.unmount());
    root = createRoot(host);
    restoreBlankStageFavourites('a', { sourceLocator: 'New stage', recoveryId: 'reloaded' });
    render('a', 'New stage', 'reloaded');
    expect(host.textContent).toBe(kinds.join(','));
    lists!.carryLibraryItemsTo('Account stage 12 revision 1');
    render('a', 'Account stage 12 revision 2');
    expect(host.textContent).toBe(kinds.join(','));
    render('b', 'Account stage 12 revision 2');
    expect(host.textContent).toBe('');
    render('a', 'Account stage 14 revision 1');
    expect(host.textContent).toBe('');
    render('a', 'Account stage 12 revision 2');
    act(() => kinds.forEach(id => lists.toggleFavourite({ type: 'object', id })));
    render('a', 'Account stage 14 revision 1');
    render('a', 'Account stage 12 revision 2');
    expect(host.textContent).toBe('');
  } finally { act(() => root.unmount()); window.localStorage.clear(); }
});
