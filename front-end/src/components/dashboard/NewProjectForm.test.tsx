import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import NewProjectForm from './NewProjectForm';
import { guestProjectRepository } from 'src/guest/guestProjects';

declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: () => {} }) }));
jest.mock('src/components/container/PageContainer', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/layouts/full/shared/breadcrumb/Breadcrumb', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/shared/DescriptionField', () => ({ __esModule: true, default: ({ value, onValueChange }: any) => <input data-description value={value} onChange={(event) => onValueChange(event.target.value)} /> }));
jest.mock('src/components/shared/ParentCard', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));

it('selects an enabled guest editor and prevents creation after it is revoked', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mockAuth = { isGuest: true, guestSettings: { allowed_views: ['blockly'] }, createProjectAction: jest.fn() };
  const render = () => root.render(<MemoryRouter><NewProjectForm isDescriptionDisabled={false} editorInitialValue="python" code="draft" /></MemoryRouter>);
  try {
    await act(async () => { render(); });
    expect((container.querySelector('.MuiSelect-nativeInput') as HTMLInputElement).value).toBe('blockly');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'submit')!;
    expect(button.disabled).toBe(false);
    mockAuth.guestSettings = { allowed_views: [] };
    await act(async () => { render(); });
    expect(button.disabled).toBe(true);
    await act(async () => { button.click(); });
    expect(mockAuth.createProjectAction).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); container.remove(); }
});

it('saves received guest work as a new local project without clearing the ordinary draft', async () => {
  localStorage.clear();
  guestProjectRepository.saveDraft('python', { editorType: 'python', name: 'Keep', description: 'Old draft', code: 'unrelated' });
  const before = guestProjectRepository.getDraft('python');
  mockAuth = { isGuest: true, guestSettings: { allowed_views: ['python'] },
    createProjectAction: jest.fn(async (data: any) => guestProjectRepository.create(data).id) };
  const onCreated = jest.fn();
  const prepare = jest.fn().mockResolvedValue({ stageReference: null });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter><NewProjectForm isDescriptionDisabled editorInitialValue="python" code="received edit" sharedSave={{ prepare, onCreated }} /></MemoryRouter>));
    const name = container.querySelector('input[placeholder="project-form.giveYourProjectAName"]') as HTMLInputElement;
    const description = container.querySelector('[data-description]') as HTMLInputElement;
    act(() => { Simulate.change(name, { target: { value: 'My copy' } } as any); Simulate.change(description, { target: { value: 'Saved copy' } } as any); });
    const submit = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'submit')!;
    await act(async () => submit.click());
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(guestProjectRepository.list()[0].code).toBe('received edit');
    expect(guestProjectRepository.getDraft('python')).toEqual(before);
  } finally { act(() => root.unmount()); container.remove(); localStorage.clear(); }
});
