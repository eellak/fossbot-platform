import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { RcControls } from './RcControls';

declare const test: any, expect: any, jest: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

test('local controls gate driving and stop on Space, focus loss, loading and unmount', () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const simulation = { rcDrive: jest.fn(), stopMotion: jest.fn(), rgbSetColor: jest.fn() };
  let frame: FrameRequestCallback = () => {};
  const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { frame = callback; return 1; });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const click = (key: string) => act(() => [...host.querySelectorAll('button')].find(button => button.textContent === key)!.click());
  const key = (code: string, type = 'keydown') => act(() => window.dispatchEvent(new KeyboardEvent(type, { code })));
  const tick = () => act(() => frame(100));
  try {
    act(() => root.render(<RcControls simulation={simulation} disabled />));
    click('rc.enable');
    key('KeyW');
    tick();
    expect(simulation.rcDrive).not.toHaveBeenCalledWith(1, 0);
    act(() => root.render(<RcControls simulation={simulation} />));
    click('rc.enable');
    key('KeyW');
    tick();
    expect(simulation.rcDrive).toHaveBeenLastCalledWith(0.45, 0);
    key('KeyW', 'keyup');
    tick();
    expect(simulation.rcDrive).toHaveBeenLastCalledWith(0, 0);
    key('Space');
    expect(simulation.stopMotion).toHaveBeenCalledTimes(1);
    click('rc.enable');
    act(() => window.dispatchEvent(new Event('blur')));
    expect(simulation.stopMotion).toHaveBeenCalledTimes(2);
    click('rc.enable');
    act(() => root.render(<RcControls simulation={simulation} disabled />));
    expect(simulation.stopMotion).toHaveBeenCalledTimes(3);
    act(() => root.render(<RcControls simulation={simulation} />));
    click('rc.enable');
    key('KeyL');
    tick();
    expect(simulation.rgbSetColor).toHaveBeenLastCalledWith('white');
    act(() => root.unmount());
    expect(simulation.stopMotion).toHaveBeenCalledTimes(4);
    expect(simulation.rgbSetColor).toHaveBeenLastCalledWith('off');
  } finally {
    raf.mockRestore();
    cancel.mockRestore();
  }
});

test('physical controls keep connection validation, gamepad driving and disconnect stop', () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const simulation = { rcDrive: jest.fn(), stopMotion: jest.fn(), rgbSetColor: jest.fn() };
  const connection = { target: 'robot' as const, status: 'disconnected' as const, programState: 'idle' as const, sendRcDrive: jest.fn(), runRcAction: jest.fn().mockResolvedValue(undefined) };
  let frame: FrameRequestCallback = () => {};
  const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { frame = callback; return 1; });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{ id: 'Controller', axes: [0, -1], buttons: [] }] });
  const enable = () => act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'rc.enable')!.click());
  try {
    act(() => root.render(<RcControls simulation={simulation} connection={connection} />));
    enable();
    expect(host.textContent).toContain('rc.connectFirst');
    act(() => root.render(<RcControls simulation={simulation} connection={{ ...connection, status: 'connected', programState: 'running' }} />));
    enable();
    expect(host.textContent).toContain('rc.stopProgramFirst');
    act(() => root.render(<RcControls simulation={simulation} connection={{ ...connection, status: 'connected' }} />));
    enable();
    act(() => frame(100));
    expect(connection.sendRcDrive).toHaveBeenCalledWith(1, 0, 45);
    expect(simulation.rcDrive).not.toHaveBeenCalledWith(1, 0);
    act(() => root.render(<RcControls simulation={simulation} connection={connection} />));
    expect(connection.runRcAction).toHaveBeenCalledWith('stop');
    expect(host.textContent).toContain('rc.safe');
  } finally {
    act(() => root.unmount());
    raf.mockRestore();
    cancel.mockRestore();
    delete (navigator as any).getGamepads;
  }
});
