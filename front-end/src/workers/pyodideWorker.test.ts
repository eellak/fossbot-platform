import './pyodideWorker';
import { SIMULATOR_ROBOT_API } from './simulatorRobotApi';

declare const describe: any, it: any, expect: any, jest: any;
const mockBindings = new Map<string, any>();
const mockRunPython = jest.fn();
jest.mock('pyodide', () => ({
  loadPyodide: async () => ({
    globals: { set: (name: string, callback: any) => mockBindings.set(name, callback) },
    setStdout: () => {}, setStderr: () => {},
    FS: { writeFile: () => {} },
    runPythonAsync: (source: string) => mockRunPython(source),
  }),
}));

describe('simulator Python distance bridge', () => {
  it('registers and awaits both distance names, including calls inside helper functions', async () => {
    const originalFetch = globalThis.fetch, originalPostMessage = globalThis.postMessage;
    const sensorReadings: number[] = [];
    globalThis.fetch = jest.fn(async () => ({ text: async () => '' })) as any;
    globalThis.postMessage = jest.fn((message: string) => {
      if (JSON.parse(message).command === 'drive_motors') {
        Promise.resolve().then(() => window.onmessage!(new MessageEvent('message', {
          data: JSON.stringify({ command: 'drive_motors_done' }),
        })));
      }
      if (JSON.parse(message).command === 'get_camera_vision') {
        Promise.resolve().then(() => window.onmessage!(new MessageEvent('message', {
          data: JSON.stringify({ command: 'get_camera_vision_done', vision: { center_error: 0.1 } }),
        })));
      }
      if (JSON.parse(message).command === 'get_camera_detections') {
        Promise.resolve().then(() => window.onmessage!(new MessageEvent('message', {
          data: JSON.stringify({ command: 'get_camera_detections_done', detections: [{ label: 'person', confidence: 1 }] }),
        })));
      }
      if (JSON.parse(message).command === 'getdistance') {
        // Match real worker delivery: reply after waitForAction has registered.
        Promise.resolve().then(() => window.onmessage!(new MessageEvent('message', {
          data: JSON.stringify({ command: 'getdistance_done', distance: 0.42 }),
        })));
      }
    }) as any;
    mockRunPython.mockImplementation(async (source: string) => {
      if (source === SIMULATOR_ROBOT_API) return;
      expect(source).toContain('async def read_distance():');
      expect(source).toContain('return await get_distance()');
      expect(source).toContain('print(await read_distance(), await get_obstacle_distance())');
      expect(mockBindings.get('get_distance')).toBe(mockBindings.get('get_obstacle_distance'));
      await mockBindings.get('_drive_motors')(0.28, 0.3);
      expect(globalThis.postMessage).toHaveBeenCalledWith(JSON.stringify({ command: 'drive_motors', left: 0.28, right: 0.3 }));
      expect(JSON.parse(await mockBindings.get('_get_camera_detections')(0.8))).toEqual([{ label: 'person', confidence: 1 }]);
      expect(JSON.parse(await mockBindings.get('_get_camera_vision')('road', 0.5, 110))).toEqual({ center_error: 0.1 });
      expect(globalThis.postMessage).toHaveBeenCalledWith(JSON.stringify({ command: 'get_camera_vision', mode: 'road', maxAge: 0.5, blackThreshold: 110 }));
      sensorReadings.push(await mockBindings.get('get_distance')());
      sensorReadings.push(await mockBindings.get('get_obstacle_distance')());
    });
    try {
      await window.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ command: 'run', script: 'def read_distance():\n    return get_distance()\nprint(read_distance(), get_obstacle_distance())' }),
      }));
      expect(mockRunPython).toHaveBeenCalledTimes(2);
      expect(mockRunPython).toHaveBeenNthCalledWith(1, SIMULATOR_ROBOT_API);
      expect(sensorReadings).toEqual([0.42, 0.42]);
      expect(globalThis.postMessage).toHaveBeenCalledWith(JSON.stringify({ command: 'execution_complete' }));
    } finally { globalThis.fetch = originalFetch; globalThis.postMessage = originalPostMessage; }
  });
});
