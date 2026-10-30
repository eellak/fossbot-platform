import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharedProjectPage, { validateSharedProject } from './SharedProjectPage';
declare const it: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../monaco-page/MonacoPage', () => ({ __esModule: true, default: ({ sharedInput }: any) => <div data-editor="python">{sharedInput.project.code}</div> }));
jest.mock('../blockly-page/BlocklyPage', () => ({ __esModule: true, default: ({ sharedInput }: any) => <div data-editor="blockly">{sharedInput.project.code}</div> }));
const token = 'a'.repeat(43);
const project = { name: 'Example', description: 'Test', code: '', project_type: 'python', stageReference: null, stageFallback: false };

it('rejects unsupported type/malformed Blockly and accepts valid empty code', () => {
  expect(validateSharedProject(project).code).toBe('');
  expect(() => validateSharedProject({ ...project, project_type: 'unknown' })).toThrow();
  expect(() => validateSharedProject({ ...project, project_type: 'blockly', code: '<xml><broken>' })).toThrow();
});
it('loads the correct editor only after validation and denies a disabled guest editor', async () => {
  const div = document.createElement('div'); document.body.appendChild(div);
  const root = createRoot(div);
  mockAuth = { authStatus: 'authenticated', token: 'guest_x', isGuest: true, guestSettings: { allowed_views: ['python'] }, getSharedProjectAction: jest.fn().mockResolvedValue(project) };
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/shared-projects/' + token]}><Routes>
      <Route path="/shared-projects/:shareToken" element={<SharedProjectPage />} />
    </Routes></MemoryRouter>));
    expect(div.querySelector('[data-editor="python"]')).not.toBeNull();
    expect(mockAuth.getSharedProjectAction).toHaveBeenCalledWith(token, expect.any(AbortSignal));
    mockAuth.guestSettings = { allowed_views: ['blockly'] };
    await act(async () => root.render(<MemoryRouter><Routes><Route path="/shared-projects/:shareToken" element={<SharedProjectPage />} /></Routes></MemoryRouter>));
    expect(div.querySelector('[data-editor]')).toBeNull();
    expect(div.textContent).toContain('projectSharing.editorUnavailable');
  } finally { act(() => root.unmount()); div.remove(); }
});
it('does not mount an editor after a failed read', async () => {
  const div = document.createElement('div'); document.body.appendChild(div);
  const root = createRoot(div);
  mockAuth = { authStatus: 'authenticated', token: 'account', isGuest: false, getSharedProjectAction: jest.fn().mockRejectedValue({ status: 404 }) };
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/shared-projects/' + token]}><Routes><Route path="/shared-projects/:shareToken" element={<SharedProjectPage />} /></Routes></MemoryRouter>));
    expect(div.querySelector('[data-editor]')).toBeNull();
    expect(div.textContent).toContain('projectSharing.unavailable');
  } finally { act(() => root.unmount()); div.remove(); }
});
