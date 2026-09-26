import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import ExecutionTargetPanel from './ExecutionTargetPanel';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

let mockConnection: any;
jest.mock('src/robot/RobotConnectionContext', () => ({
  useRobotConnection: () => mockConnection,
  DISCOVERY_PREFIX_STORAGE_KEY: 'robot-test-network',
}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Physical robot workspace views', () => {
  let container: HTMLDivElement;
  let root: Root;
  let connection: any;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    connection = {
      target: 'robot', status: 'connected', robotUrl: 'http://robot:8081',
      telemetry: null, programState: 'idle', cameraSupported: true,
      cameraFrameUrl: 'data:image/jpeg;base64,test', cameraStreaming: true,
      cameraVisionMode: 'normal', setCameraEnabled: jest.fn(),
      setTarget: jest.fn(), disconnect: jest.fn(),
    };
    mockConnection = connection;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  const render = () => act(() => root.render(
    <ExecutionTargetPanel height="100%" embedded><div>Simulator</div></ExecutionTargetPanel>,
  ));

  it('shows the camera before telemetry arrives and preserves it across tab changes', () => {
    render();
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    act(() => tabs[1].click());
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain('Waiting for telemetry');
    expect(container.querySelector('img')).toBe(image);
    expect(connection.setCameraEnabled).not.toHaveBeenCalled();
    act(() => tabs[0].click());
    expect(container.querySelector('[role="tabpanel"]:not([hidden]) img')).toBe(image);
  });

  it('uses telemetry when the connected robot has no camera', () => {
    connection.cameraSupported = false;
    connection.telemetry = { sensors: { distanceCm: 42 } };
    render();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain('42.0');
    expect(container.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('retains the simulator view when simulation is selected', () => {
    connection.target = 'simulation';
    render();
    expect(container.textContent).toContain('Simulator');
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
