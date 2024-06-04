import { dir } from 'console';

type WorkerResponse = {
  command: string;
  distance?: number;
  acceleration?: number[];
  gyroscope?: number[];
  floorsensor?: boolean[];
  script: string;
  lightsensor?: number;
};

let pyodide: any;
let input_data = null;
let isStopped = false;

onmessage = async function (event: MessageEvent) {
  const data: WorkerResponse = JSON.parse(event.data);

  if (data.command === 'run') {
    isStopped = false;  // Reset the stop flag
    await runPythonCode(data);
  } else if (data.command === 'stop') {
    isStopped = true;  // Set the stop flag
    console.log('stop command received');
    if (pyodide) {
      // Use interruptBuffer to signal a stop
      pyodide.runPythonAsync(`
        import sys
        sys.interrupt_main()
      `).catch(() => {});
    }
  } else if (data.command === 'move_done' || data.command === 'rotate_done' ||
             data.command === 'getdistance_done' || data.command === 'rgbsetcolor_done' ||
             data.command === 'getacceleration_done' || data.command === 'getgyroscope_done' ||
             data.command === 'getfloorsensor_done'|| data.command === 'just_rotate_done' || 
             data.command === 'just_move_done' || data.command === 'stop_motion_done' || 
             data.command === 'getlightsensor_done'|| data.command === 'drawLine_done') {
    if (pendingActionResolve) {
      pendingActionResolve(data);
      pendingActionResolve = null;
    }
  }
};

let pendingActionResolve: ((value: WorkerResponse | PromiseLike<WorkerResponse>) => void) | null = null;

const waitForAction = (): Promise<WorkerResponse> => {
  return new Promise((resolve) => {
    pendingActionResolve = resolve;
  });
};

const setUpPyodide = async () => {
  const pyodideModule = await import('pyodide');
  const loadedPyodide = await pyodideModule.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
  });

  loadedPyodide.setStdout({
    batched: (msg: string) => postMessage(JSON.stringify({ command: 'stdout', data: msg }))
  });
  
  loadedPyodide.setStderr({
    batched: (msg: string) => postMessage(JSON.stringify({ command: 'stderr', data: msg }))
  });

  loadedPyodide.globals.set('move_forward_distance', async (distance: number) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'move', distance: Math.abs(distance) * -1 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('move_step', async (direction: string) => {
    if (isStopped) return;
    if (isStopped) return;
    let dir_value = -1;
    if (direction === 'backward') {
      dir_value = 1;
    }
    postMessage(JSON.stringify({ command: 'move', distance: dir_value * 0.4 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('move_reverse_distance', async (distance: number) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'move', distance: Math.abs(distance) }));
    await waitForAction();
  });

  loadedPyodide.globals.set('rotate_90', async (direction: string) => {
    if (isStopped) return;
    let dir_value = 1;
    if (direction === 'left') {
      dir_value = -1;
    }
    postMessage(JSON.stringify({ command: 'rotate', angle: (Math.PI / 2) * dir_value * -1 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('rotate_45', async (direction: string) => {
    if (isStopped) return;
    let dir_value = 1;
    if (direction === 'left') {
      dir_value = -1;
    }
    postMessage(JSON.stringify({ command: 'rotate', angle: (Math.PI / 4) * dir_value * -1 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('rotate_degrees', async (angle) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'rotate', angle: Math.PI * angle / 180}));
    await waitForAction();
  });

  loadedPyodide.globals.set('rotate_clockwise', async () => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'rotate', angle: 0.0174533 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('rotate_counterclockwise', async () => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'rotate', angle: -0.0174533 }));
    await waitForAction();
  });

  loadedPyodide.globals.set('get_obstacle_distance', async () => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'getdistance' }));
    const response = await waitForAction();
    return response.distance;
  });

  loadedPyodide.globals.set('rgb_set_color', async (color: string) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'rgbsetcolor', color }));
    await waitForAction();
  });

  loadedPyodide.globals.set('draw', async (status: boolean) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'drawLine', status }));
    await waitForAction();
  });

  loadedPyodide.globals.set('just_move', async (direction: string) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'justMove', direction }));
    await waitForAction();
  });

  loadedPyodide.globals.set('just_rotate', async (direction: string) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'justRotate', direction }));
    await waitForAction();
  });

  loadedPyodide.globals.set('stop', async () => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'stopMotion' }));
    await waitForAction();
  });

  loadedPyodide.globals.set('get_acceleration', async (axis: string) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'getacceleration', axis }));
    const response = await waitForAction();
    return response.acceleration;
  });

  loadedPyodide.globals.set('get_light_sensor', async () => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'getlightsensor' }));
    const response = await waitForAction();
    return response.lightsensor;
  });

  loadedPyodide.globals.set('get_gyroscope', async (axis: string) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'getgyroscope', axis }));
    const response = await waitForAction();
    return response.gyroscope;
  });

  loadedPyodide.globals.set('get_floor_sensor', async (sensor_id: number) => {
    if (isStopped) return;
    postMessage(JSON.stringify({ command: 'getfloorsensor', sensor_id }));
    const response = await waitForAction();
    return response.floorsensor;
  });

  const moduleResponse = await fetch('/fossbotlib/testlib.py'); 
  const moduleText = await moduleResponse.text();
  loadedPyodide.FS.writeFile('/home/pyodide/testlib.py', moduleText);

  return loadedPyodide;
};

const addAwaitToFunctions = (script, functions) => {
  functions.forEach(func => {
    const regex = new RegExp(`(?<!await\\s)\\b${func}\\b`, 'g');
    script = script.replace(regex, `await ${func}`);
  });
  return script;
};


const runPythonCode = async (data: WorkerResponse) => {
  const pythonScript = data.script;

  pyodide = await setUpPyodide();

  if (pythonScript) {
    postMessage(JSON.stringify({ command: 'clear_results' }));

    
    const functionsToAwait = [
      'move_forward_distance', 'move_reverse_distance', 'rotate_90', 
      'rotate_45', 'rotate_degrees', 'rotate_clockwise', 'rotate_counterclockwise', 
      'get_obstacle_distance', 'rgb_set_color', 'draw', 'just_move', 
      'just_rotate', 'stop', 'get_acceleration', 'get_light_sensor', 
      'get_gyroscope', 'get_floor_sensor', 'move_step'
    ];

    const finalScript = addAwaitToFunctions(pythonScript, functionsToAwait);
    try {
      await pyodide.runPythonAsync(finalScript);
    } catch (e) {
      if (e.constructor.name === 'PythonError') {
        const errorMessage = e.message;
        const errorStartIndex = errorMessage.indexOf('File "<exec>"');
        let formattedErrorMessage = '';

        if (errorStartIndex !== -1) {
          formattedErrorMessage += errorMessage.substring(errorStartIndex);
        } else {
          formattedErrorMessage += errorMessage;
        }
        postMessage(JSON.stringify({ command: 'stderr', data: formattedErrorMessage }));
      } else {
        console.error('Unexpected error:', e);
      }
    }
  }
};
