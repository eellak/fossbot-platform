import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlocklyPage from '../blockly-page/BlocklyPage';
import MonacoPage from '../monaco-page/MonacoPage';
import { guestProjectRepository } from 'src/guest/guestProjects';

declare const it: any, expect: any, jest: any, afterEach: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockAuth: any;
let mockDialog: any;
const mockNotify = jest.fn();
const mockRelease = jest.fn();
const mockDeparture = jest.fn(() => mockRelease);
const mockT = (key: string) => key;
const mockCollector = { start: () => {}, finish: () => {} };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('src/authentication/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('react-redux', () => ({ useSelector: (selector: any) => selector({ customizer: { activeMode: 'light', TopbarHeight: 70 } }) }));
jest.mock('src/robot/RobotConnectionContext', () => ({ useRobotConnection: () => ({ target: 'simulation', telemetry: null, status: 'disconnected', programState: 'idle' }) }));
jest.mock('src/components/robot/useSensorDataCollection', () => ({ useSensorDataCollection: () => mockCollector }));
jest.mock('src/components/notifications/NotificationProvider', () => ({ useNotifications: () => ({ notify: mockNotify }) }));
jest.mock('src/routes/useSharedProjectDeparture', () => ({ useSharedProjectDeparture: (dirty: boolean) => mockDeparture(dirty) }));
jest.mock('src/stages/sharedProjectStage', () => ({ useSharedProjectStage: () => ({ config: null, base: null, blocked: false, failed: false, prepare: async () => ({ stageReference: null }) }) }));
jest.mock('src/components/dashboard/NewProjectDialog', () => ({ __esModule: true, default: (props: any) => { mockDialog = props; return null; } }));
jest.mock('src/components/dashboard/ProjectShareDialog', () => ({ ProjectShareControl: () => <div data-owner-sharing /> }));
jest.mock('src/simulator-adapter/Simulator', () => ({ WebGLApp: require('react').forwardRef(() => null) }));
jest.mock('src/components/workspace/PythonWorkspaceEditor', () => ({ __esModule: true, default: ({ code, onChange }: any) => <textarea data-code value={code} onChange={(event) => onChange(event.target.value)} /> }));
jest.mock('src/components/editors/MonacoEditor', () => ({ __esModule: true, default: require('react').forwardRef(({ code, handleGetValue }: any, ref: any) => {
  require('react').useImperativeHandle(ref, () => ({ getSource: () => code }));
  return <textarea data-code value={code} onChange={(event) => handleGetValue(() => event.target.value)} />;
}) }));
jest.mock('src/components/editors/BlocklyEditor', () => ({ __esModule: true, default: require('react').forwardRef(({ code, handleGetValue }: any, ref: any) => {
  require('react').useImperativeHandle(ref, () => ({ getXml: () => code }));
  return <textarea data-code value={code} onChange={(event) => handleGetValue(() => event.target.value)} />;
}) }));
jest.mock('src/components/editors/PythonExecutor', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/editors/RightColButtons', () => ({ __esModule: true, default: ({ handleSaveClick }: any) => <button onClick={handleSaveClick}>legacy-save</button> }));
jest.mock('src/components/editors/SimulatorEditorControls', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/robot/ExecutionTargetPanel', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('src/components/robot/SensorDataPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/ai/AssistantPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/monaco-functions/MonacoSearchBar', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/videoplayer/VideoPlayer', () => ({ __esModule: true, default: () => null }));
jest.mock('react-player', () => ({ __esModule: true, default: () => null }));
jest.mock('src/ai/suggestions/codeSuggestions', () => ({ allowedBlocklyBlockTypes: () => [] }));

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); localStorage.clear(); });
for (const type of ['python', 'blockly'] as const) {
  for (const appearance of [true, false]) {
    for (const isGuest of [true, false]) {
      it(`${type} shared copy (${appearance ? 'workspace' : 'legacy'}, ${isGuest ? 'guest' : 'account'}) bypasses owner/draft load and autosave`, async () => {
        jest.useFakeTimers();
        const autosave = jest.spyOn(guestProjectRepository, 'saveDraft');
        const getDraft = jest.spyOn(guestProjectRepository, 'getDraft');
        mockDeparture.mockClear();
        mockDeparture.mockReturnValue(mockRelease);
        mockRelease.mockClear();
        mockAuth = { isGuest, token: isGuest ? 'guest_x' : 'account', guestSettings: { allowed_views: ['python', 'blockly'] }, getProjectByIdAction: jest.fn(), updateProjectByIdAction: jest.fn() };
        const input = { shareToken: 'x'.repeat(43), project: { name: 'Received', description: 'Example', project_type: type, code: '', stageReference: null, stageFallback: false } };
        const Component = type === 'python' ? MonacoPage : BlocklyPage;
        const div = document.createElement('div'); document.body.appendChild(div);
        const root = createRoot(div);
        try {
          await act(async () => root.render(<ThemeProvider theme={createTheme()}><MemoryRouter initialEntries={['/shared-projects/' + input.shareToken]}><Routes>
            <Route path="/shared-projects/:shareToken" element={<Component previewAppearance={appearance} sharedInput={input} />} />
          </Routes></MemoryRouter></ThemeProvider>));
          act(() => jest.runOnlyPendingTimers());
          const code = div.querySelector('[data-code]') as HTMLTextAreaElement;
          expect(code.value).toBe(type === 'python' ? '' : '<xml xmlns="https://developers.google.com/blockly/xml"></xml>');
          act(() => Simulate.change(code, { target: { value: 'receiver edit' } } as any));
          act(() => jest.advanceTimersByTime(1000));
          expect(getDraft).not.toHaveBeenCalled();
          expect(autosave).not.toHaveBeenCalled();
          expect(mockAuth.getProjectByIdAction).not.toHaveBeenCalled();
          expect(div.querySelector('[data-owner-sharing]')).toBeNull();
          expect(mockDeparture).toHaveBeenLastCalledWith(true);
          const save = Array.from(div.querySelectorAll('button')).find((button) => button.textContent === (appearance ? type === 'python' ? 'monaco-page.save' : 'blockly-page.save' : 'legacy-save'))!;
          await act(async () => save.click());
          expect(mockDialog.showDrawer).toBe(true);
          expect(mockDialog.code).toBe('receiver edit');
          expect(mockDialog.sharedSave).toBeDefined();
          expect(mockAuth.updateProjectByIdAction).not.toHaveBeenCalled();
          act(() => mockDialog.sharedSave.onCreated(901));
          expect(mockRelease).toHaveBeenCalled();
        } finally { act(() => root.unmount()); div.remove(); }
      });
    }
  }
}
