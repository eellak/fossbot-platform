import React, { createRef } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { WebGLApp, type LegacySimulatorControlHandle } from '../components/js-simulator/Simulator';
import { scene } from '../components/js-simulator/scene';
import { loadObjectsFromEntries } from '../components/js-simulator/stage_loader';

declare const test: any, expect: any, jest: any, beforeEach: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockSelect: (url: string) => void;
jest.mock('../components/js-simulator/scene', () => {
  const { fn } = require('jest-mock');
  const scene = { children: [] as any[], add: (...items: any[]) => scene.children.push(...items), remove: (item: any) => { scene.children = scene.children.filter(value => value !== item); } };
  return { scene, camera: { updateProjectionMatrix: fn() }, renderer: { domElement: globalThis.document.createElement('canvas'), setSize: fn() } };
});
jest.mock('../components/js-simulator/environment_lights', () => ({ ambientLight: {}, directionalLight: {} }));
jest.mock('../components/js-simulator/robot_loader', () => ({ loadBaseObject: require('jest-mock').fn() }));
jest.mock('../components/js-simulator/animate', () => {
  const { fn } = require('jest-mock');
  return { startAnimation: fn(), stopAnimation: fn(), stopMotion: fn(), rgb_set_color: fn(), drawLine: fn(), changeCamera: fn() };
});
jest.mock('../components/js-simulator/sensors', () => ({ traceLine: {} }));
jest.mock('../components/js-simulator/stage_loader', () => ({ loadObjectsFromEntries: require('jest-mock').fn() }));
jest.mock('src/components/stage-select-popup/CardDialog', () => ({ __esModule: true, default: ({ onSelect }: any) => { mockSelect = onSelect; return null; } }));
jest.mock('../components/js-simulator/SimulatorControlsOverlay', () => ({ __esModule: true, default: () => null }));
const oldEntries = [{ type: 'floor', dimensions: [10, 10] }];
const native = [{ type: 'line', curveVersion: 1, points: [[0, 0], [1, 0]], corners: [null, null] }];
const response = (entries: any) => ({ ok: true, json: async () => entries });
beforeEach(() => {
  (scene as any).children = [];
  (loadObjectsFromEntries as any).mockReset().mockImplementation((entries: any, target: any) => { target.add({ entries }); });
  global.fetch = jest.fn().mockResolvedValue(response(oldEntries));
});
async function mount(extra: any = {}) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  const ref = createRef<LegacySimulatorControlHandle>();
  const ready = jest.fn();
  await act(async () => { root.render(<WebGLApp appsessionId="test" ref={ref} onMountChange={ready} showControls={false} {...extra} />); });
  return { container, ref, ready, unmount: () => { act(() => root.unmount()); container.remove(); } };
}
test('native selection retains the supported scene and switches with exact validated bytes and source base', async () => {
  const switchRuntime = jest.fn();
  const view = await mount({ onSwitchToCurrent: switchRuntime });
  try {
    const previous = [...scene.children];
    (fetch as any).mockResolvedValue(response(native));
    await act(async () => { mockSelect('https://example.test/stages/new.json'); });
    expect(scene.children).toEqual(previous);
    expect(loadObjectsFromEntries).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(view.ready.mock.calls.at(-1)[0]).toBe(false);
    const button = [...view.container.querySelectorAll('button')].find(item => item.textContent === 'Switch to current simulator')!;
    act(() => button.click());
    expect(switchRuntime).toHaveBeenCalledWith(native, 'https://example.test/stages/', 'https://example.test/stages/new.json');
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally { view.unmount(); }
});
test('reload preflight rejects changed URL contents without clearing the current scene', async () => {
  const view = await mount();
  try {
    const previous = [...scene.children];
    (fetch as any).mockResolvedValue(response(native));
    await act(async () => { await view.ref.current!.resetStage(); });
    expect(scene.children).toEqual(previous);
    expect(view.container.textContent).toContain('requires the current simulator');
    expect(view.container.textContent).not.toContain('Switch to current simulator');
    expect(loadObjectsFromEntries).toHaveBeenCalledTimes(1);
  } finally { view.unmount(); }
});
test('supplied configurations use no URL fetch and unsupported initial versions never construct a scene', async () => {
  const first = await mount({ initialStageConfig: oldEntries });
  expect(fetch).not.toHaveBeenCalled();
  expect(loadObjectsFromEntries).toHaveBeenCalledWith(oldEntries, scene);
  first.unmount();
  (loadObjectsFromEntries as any).mockClear();
  const second = await mount({ initialStageConfig: [{ ...native[0], curveVersion: 99 }] });
  try {
    expect(loadObjectsFromEntries).not.toHaveBeenCalled();
    expect(second.ready).not.toHaveBeenCalledWith(true);
    expect(second.container.textContent).toContain('unsupported curve version');
  } finally { second.unmount(); }
});
