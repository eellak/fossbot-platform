import './pyodideWorker';

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
      if (JSON.parse(message).command === 'getdistance') {
        // Match real worker delivery: reply after waitForAction has registered.
        Promise.resolve().then(() => window.onmessage!(new MessageEvent('message', {
          data: JSON.stringify({ command: 'getdistance_done', distance: 0.42 }),
        })));
      }
    }) as any;
    mockRunPython.mockImplementation(async (source: string) => {
      expect(source).toContain('async def read_distance():');
      expect(source).toContain('return await get_distance()');
      expect(source).toContain('print(await read_distance(), await get_obstacle_distance())');
      expect(mockBindings.get('get_distance')).toBe(mockBindings.get('get_obstacle_distance'));
      sensorReadings.push(await mockBindings.get('get_distance')());
      sensorReadings.push(await mockBindings.get('get_obstacle_distance')());
    });
    try {
      await window.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ command: 'run', script: 'def read_distance():\n    return get_distance()\nprint(read_distance(), get_obstacle_distance())' }),
      }));
      expect(mockRunPython).toHaveBeenCalledTimes(1);
      expect(sensorReadings).toEqual([0.42, 0.42]);
      expect(globalThis.postMessage).toHaveBeenCalledWith(JSON.stringify({ command: 'execution_complete' }));
    } finally { globalThis.fetch = originalFetch; globalThis.postMessage = originalPostMessage; }
  });
});
