import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminPanelPage from './AdminPanelPage';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockConfirm: any;
let navigateFromTest: ((to: any, options?: any) => void) | null;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/shared/ConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock('src/components/admin-panel/UsersCard', () => ({ __esModule: true, default: mockUsersCard }));
jest.mock('src/components/admin-panel/GuestAccessSettingsCard', () => ({ __esModule: true, default: mockGuestCard }));

function mockUsersCard() {
  const [note, setNote] = useState('');
  return <div>users panel<input id="users-note" value={note} onChange={(event) => setNote(event.target.value)} /></div>;
}

function mockGuestCard({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [note, setNote] = useState('');
  return <div>
    guests panel
    <input id="guests-note" value={note} onChange={(event) => setNote(event.target.value)} />
    <button onClick={() => onDirtyChange?.(true)}>mark guest dirty</button>
  </div>;
}

function LocationProbe() {
  const location = useLocation();
  navigateFromTest = useNavigate();
  return <div id="location">{`${location.pathname}${location.search}`}</div>;
}

function Navigation() {
  const navigate = useNavigate();
  return <div>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate(1)}>Forward</button>
    <button onClick={() => navigate('/website-admin', { replace: true })}>Replace</button>
    <Link to="/website-admin">Leave</Link>
  </div>;
}

describe('admin panel page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockConfirm = jest.fn().mockResolvedValue(true);
    navigateFromTest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderPage = async (entries: string[], showPage = true) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={entries}>
          <Routes>
            <Route path="/admin-panel" element={showPage ? <AdminPanelPage /> : <div>page removed</div>} />
            <Route path="/website-admin" element={<div>website admin</div>} />
          </Routes>
          <Navigation />
          <LocationProbe />
        </MemoryRouter>,
      );
      await flush();
    });
  };

  const tab = (id: 'users' | 'guests') => container.querySelector(`#admin-${id}-tab`) as HTMLElement;
  const click = async (element: HTMLElement) => {
    await act(async () => { element.click(); await flush(); });
  };
  const type = async (selector: string, value: string) => {
    const input = container.querySelector(selector) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const location = () => container.querySelector('#location')?.textContent;

  it('opens Users by default and deep-links to Guest access', async () => {
    await renderPage(['/admin-panel?keep=1']);
    expect(tab('users').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#admin-users-panel')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#admin-guests-panel')?.hasAttribute('hidden')).toBe(true);
    expect(location()).toBe('/admin-panel?keep=1');

    await click(tab('guests'));
    expect(location()).toBe('/admin-panel?keep=1&tab=guests');
    expect(tab('guests').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#admin-users-panel')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#admin-guests-panel')?.hasAttribute('hidden')).toBe(false);

    await click(tab('users'));
    expect(location()).toBe('/admin-panel?keep=1');

    act(() => root.unmount());
    root = createRoot(container);
    await renderPage(['/admin-panel?keep=1&tab=guests']);
    expect(tab('guests').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#admin-guests-panel')?.hasAttribute('hidden')).toBe(false);
  });

  it('moves between tabs with browser history without losing panel state', async () => {
    await renderPage(['/admin-panel']);
    await type('#users-note', 'alice');
    await click(tab('guests'));
    expect(location()).toBe('/admin-panel?tab=guests');
    await type('#guests-note', 'draft');
    await click(tab('users'));
    expect((container.querySelector('#users-note') as HTMLInputElement).value).toBe('alice');
    expect(mockConfirm).not.toHaveBeenCalled();

    await click(tab('guests'));
    expect((container.querySelector('#guests-note') as HTMLInputElement).value).toBe('draft');

    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Back') as HTMLElement);
    expect(location()).toBe('/admin-panel');
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Forward') as HTMLElement);
    expect(location()).toBe('/admin-panel?tab=guests');
    expect((container.querySelector('#guests-note') as HTMLInputElement).value).toBe('draft');
  });

  it('keeps the draft on the guest tab when its query changes', async () => {
    await renderPage(['/admin-panel?tab=guests']);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'mark guest dirty') as HTMLElement);
    expect(tab('guests').textContent).toContain('admin-panel.guest.unsavedShort');

    await click(tab('users'));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(location()).toBe('/admin-panel');
    expect(container.querySelector('#admin-guests-panel')?.hasAttribute('hidden')).toBe(true);
  });

  it.each([
    ['push', 'Leave'],
    ['replace', 'Replace'],
  ])('confirms a dirty draft before an in-app %s navigation', async (_kind, control) => {
    await renderPage(['/admin-panel?tab=guests']);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'mark guest dirty') as HTMLElement);

    mockConfirm.mockResolvedValueOnce(false);
    await click(Array.from(container.querySelectorAll('button, a')).find((node) => node.textContent === control) as HTMLElement);
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true, cancelLabel: 'cancel' }));
    expect(location()).toBe('/admin-panel?tab=guests');
    expect(container.textContent).not.toContain('website admin');

    mockConfirm.mockResolvedValueOnce(true);
    await click(Array.from(container.querySelectorAll('button, a')).find((node) => node.textContent === control) as HTMLElement);
    expect(location()).toBe('/website-admin');
    expect(container.textContent).toContain('website admin');
  });

  it('confirms a dirty draft before browser Back', async () => {
    await renderPage(['/website-admin', '/admin-panel?tab=guests']);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'mark guest dirty') as HTMLElement);

    mockConfirm.mockResolvedValueOnce(false);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Back') as HTMLElement);
    expect(location()).toBe('/admin-panel?tab=guests');

    mockConfirm.mockResolvedValueOnce(true);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Back') as HTMLElement);
    expect(location()).toBe('/website-admin');
    expect(container.textContent).toContain('website admin');
  });

  it('removes the navigation guard when the page unmounts', async () => {
    await renderPage(['/admin-panel?tab=guests']);
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'mark guest dirty') as HTMLElement);
    await renderPage(['/admin-panel?tab=guests'], false);
    mockConfirm.mockClear();

    await act(async () => { navigateFromTest?.('/website-admin'); await flush(); });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(location()).toBe('/website-admin');
    expect(container.textContent).toContain('website admin');
  });
});
