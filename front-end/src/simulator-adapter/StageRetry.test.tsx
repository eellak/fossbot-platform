import React, { createRef } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import type { FossbotSimulatorHandle } from '../simulator/FossbotSimulator';
import { StageLoadError } from '../simulator/stages/stageFormatCore';

declare const test: any, expect: any, jest: any, beforeEach: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockInstances: any[] = [];
let mockStart: () => Promise<void> = async () => {};
let mockFailSwap = false;
let mockRemoteEntries: any[] = [];
let mockLive = 0;
let mockPeak = 0;
jest.mock('../simulator/stages', () => ({ STAGES: {} }));
jest.mock('../simulator/engine/SimEngine', () => {
  const { fn } = require('jest-mock');
  const { validateStageFormat, stageLoadError } = require('../simulator/stages/stageFormatCore');
  return { SimEngine: class {
    hasStage = false;
    lastStageRequest: any = null;
    retryConfig: any;
    stopped = false;
    subscriptions: any[] = [];
    start = fn(async () => { await mockStart(); this.hasStage = true; });
    stop = fn(() => { if (!this.stopped) { mockLive--; this.stopped = true; } });
    stopMotion = fn();
    subscribeSensorTelemetry = fn(() => { const unsubscribe = fn(); this.subscriptions.push(unsubscribe); return unsubscribe; });
    subscribeMissionEvents = fn(() => { const unsubscribe = fn(); this.subscriptions.push(unsubscribe); return unsubscribe; });
    constructor(_element: any, config: any) {
      this.retryConfig = config;
      mockInstances.push(this);
      mockLive++;
      mockPeak = Math.max(mockPeak, mockLive);
    }
    swap = async (entries: any, base?: string) => {
      try {
        validateStageFormat(entries);
        this.retryConfig = { ...this.retryConfig, initialStageConfig: entries, stageAssetBaseUrl: base };
        if (mockFailSwap) { mockFailSwap = false; this.hasStage = false; throw stageLoadError(new Error('Asset construction failed')); }
      } catch (error) { this.retryConfig.onStageLoadError(error); throw error; }
    };
    setStageConfig = fn(async (entries: any, name: string, base?: string) => { this.lastStageRequest = { entries, name, base }; await this.swap(entries, base); });
    setStage = fn(async (url: string) => { this.lastStageRequest = { url }; await this.swap(mockRemoteEntries); });
  } };
});

jest.doMock(require.resolve('react', { paths: [require.resolve('../simulator/FossbotSimulator')] }), () => React);
const { FossbotSimulator } = require('../simulator/FossbotSimulator') as typeof import('../simulator/FossbotSimulator');

beforeEach(() => {
  mockInstances = [];
  mockStart = async () => {};
  mockFailSwap = false;
  mockRemoteEntries = [];
  mockLive = 0;
  mockPeak = 0;
});

async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = createRef<FossbotSimulatorHandle>();
  const ready = jest.fn();
  const error = jest.fn();
  await act(async () => { root.render(<FossbotSimulator ref={ref} initialStageConfig={[]} onMountChange={ready} onLoadError={error} />); });
  return { ref, ready, error, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

test('failed initialisation retries with one fresh engine and clears error only on success', async () => {
  mockStart = async () => { throw new StageLoadError([{ code: 'asset', message: 'Robot missing', severity: 'error' }], 'construction'); };
  const view = await mount();
  try {
    expect(view.ready).not.toHaveBeenCalledWith(true);
    expect(mockInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockLive).toBe(0);
    let finish!: () => void;
    mockStart = () => new Promise(resolve => { finish = resolve; });
    let retry!: Promise<void>;
    await act(async () => { retry = view.ref.current!.retryStageLoad(); await Promise.resolve(); });
    expect(view.error.mock.calls.at(-1)[0].message).toBe('Robot missing');
    expect(view.ready.mock.calls.at(-1)[0]).toBe(false);
    await act(async () => { finish(); await retry; });
    expect(view.error.mock.calls.at(-1)[0]).toBeNull();
    expect(view.ready.mock.calls.at(-1)[0]).toBe(true);
    expect(mockPeak).toBe(1);
    mockInstances.forEach(engine => expect(engine.start).toHaveBeenCalledTimes(1));
  } finally { view.unmount(); }
  expect(mockLive).toBe(0);
});

test('post-disposal construction failure restarts the validated request and reconnects listeners', async () => {
  const view = await mount();
  try {
    view.ref.current!.subscribeSensorTelemetry(jest.fn());
    view.ref.current!.subscribeMissionEvents(jest.fn());
    const old = mockInstances[0];
    mockFailSwap = true;
    const entries = [{ type: 'line', points: [[0, 0], [1, 0]] }];
    await act(async () => { await expect(view.ref.current!.setStageConfig(entries, 'new', 'https://example.test/assets/')).rejects.toThrow('Asset construction failed'); });
    expect(old.stop).toHaveBeenCalledTimes(1);
    old.subscriptions.forEach((unsubscribe: any) => expect(unsubscribe).toHaveBeenCalledTimes(1));
    await act(async () => { await view.ref.current!.retryStageLoad(); });
    const next = mockInstances[1];
    expect(next.retryConfig.initialStageConfig).toEqual(entries);
    expect(next.retryConfig.stageAssetBaseUrl).toBe('https://example.test/assets/');
    expect(next.subscribeSensorTelemetry).toHaveBeenCalledTimes(1);
    expect(next.subscribeMissionEvents).toHaveBeenCalledTimes(1);
    expect(mockPeak).toBe(1);
    expect(view.ready.mock.calls.at(-1)[0]).toBe(true);
  } finally { view.unmount(); }
});

test('validation rejection retains the engine and retry re-reads the rejected URL', async () => {
  const view = await mount();
  try {
    const old = mockInstances[0];
    mockRemoteEntries = [{ type: 'line', curveVersion: 99, points: [[0, 0], [1, 0]] }];
    await act(async () => { await expect(view.ref.current!.setStage('remote.json')).rejects.toThrow('unsupported'); });
    expect(old.stop).not.toHaveBeenCalled();
    expect(old.hasStage).toBe(true);
    mockRemoteEntries = [{ type: 'line', points: [[0, 0], [1, 0]] }];
    await act(async () => { await view.ref.current!.retryStageLoad(); });
    expect(old.setStage.mock.calls).toEqual([['remote.json'], ['remote.json']]);
    expect(mockInstances).toHaveLength(1);
    expect(view.error.mock.calls.at(-1)[0]).toBeNull();
  } finally { view.unmount(); }
});

test('unmount during initialisation cleans up without reporting ready later', async () => {
  let finish!: () => void;
  mockStart = () => new Promise(resolve => { finish = resolve; });
  const view = await mount();
  view.unmount();
  await act(async () => { finish(); await Promise.resolve(); });
  expect(view.ready).not.toHaveBeenCalledWith(true);
  expect(mockInstances[0].stop).toHaveBeenCalledTimes(1);
  expect(mockLive).toBe(0);
});
