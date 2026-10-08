import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import CameraView from './CameraView';
import RobotCameraPanel from '../robot/RobotCameraPanel';
declare const describe: any, it: any, expect: any, jest: any, beforeEach: any, afterEach: any;
let mockConnection: any;
const mockT = (key: string) => ({
  'simulatorControls.liveCamera': 'Live camera', 'simulatorControls.startVideo': 'Start video',
  'simulatorControls.stopVideo': 'Stop video', 'simulatorControls.videoMode': 'Video',
  'simulatorControls.depthMode': 'Depth', 'simulatorControls.roadMode': 'Road',
  'simulatorControls.visionMode': 'Camera processing mode', 'simulatorControls.cameraPaused': 'Camera is paused',
}[key] || key);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('src/robot/RobotConnectionContext', () => ({ useRobotConnection: () => mockConnection }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('shared camera view', () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mockConnection = { cameraSupported: true, cameraStreaming: true, cameraVisionMode: 'normal',
      cameraFrameUrl: 'data:image/jpeg;base64,frame', cameraRoadSupported: true,
      setCameraEnabled: jest.fn(), setCameraVisionMode: jest.fn() };
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('offers only physical capabilities and changes mode without restarting the stream', () => {
    act(() => root.render(<RobotCameraPanel />));
    const selector = container.querySelector('[aria-label="Camera processing mode"]')!;
    act(() => selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    expect(options.map(option => option.textContent)).toEqual(['Video', 'Road']);
    act(() => (options[1] as HTMLElement).click());
    expect(mockConnection.setCameraVisionMode).toHaveBeenCalledWith('road');
    expect(mockConnection.setCameraEnabled).not.toHaveBeenCalled();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(mockConnection.cameraFrameUrl);
    act(() => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Stop video')!.click());
    expect(mockConnection.setCameraEnabled).toHaveBeenCalledWith(false);
  });
  it('shares paused states with the simulator and detaches the canvas when stopped', () => {
    const canvasRef = jest.fn(), onStreamingChange = jest.fn();
    const render = (streaming: boolean) => act(() => root.render(
      <CameraView streaming={streaming} onStreamingChange={onStreamingChange} mode="objects"
        modes={[{ value: 'normal', label: 'Video' }, { value: 'objects', label: 'YOLO · Simulated' }]}
        onModeChange={() => {}}>{streaming && <canvas ref={canvasRef} />}</CameraView>,
    ));
    render(true); expect(container.textContent).toContain('YOLO · Simulated');
    render(false); expect(canvasRef).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.textContent).toContain('Camera is paused');
    act(() => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Start video')!.click());
    expect(onStreamingChange).toHaveBeenCalledWith(true);
  });
});
