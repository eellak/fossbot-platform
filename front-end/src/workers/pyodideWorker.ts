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
    // Regex to match 'def function_name' and store function_name
    const defRegex = new RegExp(`def\\s+${func}\\b`, 'g');
    
    // Replace function calls with 'await function_name', excluding those in 'def function_name'
    const regex = new RegExp(`(?<!await\\s)(?<!def\\s)\\b${func}\\b`, 'g');
    
    // Temporarily replace 'def function_name' with a placeholder
    script = script.replace(defRegex, `DEF_PLACEHOLDER_${func}`);
    
    // Add 'await' to function calls
    script = script.replace(regex, `await ${func}`);
    
    // Restore 'def function_name'
    script = script.replace(new RegExp(`DEF_PLACEHOLDER_${func}`, 'g'), `def ${func}`);
  });
  return script;
};

const processPythonCode = (code) => {
  const lines = code.split('\n');
  const modifiedLines = [];
  const functionsWithAwait = [];
  let insideFunction = false;
  let currentFunction = [];
  let currentIndentation = '';
  let indentLevel = 0;
  let functionName = '';

  for (let line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('def ') && !insideFunction) {
          currentFunction = [line];
          insideFunction = true;
          currentIndentation = line.match(/^\s*/)[0];  // Capture leading whitespace
          indentLevel = currentIndentation.length;
          functionName = trimmedLine.split(' ')[1].split('(')[0]; // Extract function name
      } else if (insideFunction) {
          const currentLineIndentation = line.match(/^\s*/)[0].length;
          currentFunction.push(line);

          // Check if the current line is less indented than the function definition line
          if (trimmedLine === '' || currentLineIndentation <= indentLevel && trimmedLine !== '') {
              insideFunction = false;
              if (currentFunction.some(l => l.includes('await'))) {
                  functionsWithAwait.push(functionName);
                  currentFunction[0] = currentFunction[0].replace('def ', 'async def ');
              }
              modifiedLines.push(...currentFunction);
              currentFunction = [];
              functionName = '';
          }
      } else {
          modifiedLines.push(line);
      }
  }

  // Final check in case the last function contains 'await'
  if (insideFunction && currentFunction.some(l => l.includes('await'))) {
      functionsWithAwait.push(functionName);
      currentFunction[0] = currentFunction[0].replace('def ', 'async def ');
  }

  modifiedLines.push(...currentFunction);

  return {
      modifiedCode: modifiedLines.join('\n'),
      functionNames: functionsWithAwait
  };
}


const runPythonCode = async (data: WorkerResponse) => {
  let pythonScript = data.script;

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


    let changesDetected = true;

    pythonScript = addAwaitToFunctions(pythonScript, functionsToAwait);

    while (changesDetected) {
      changesDetected = false;

      let result = processPythonCode(pythonScript);
      pythonScript = addAwaitToFunctions(result.modifiedCode, result.functionNames);

      if (result.functionNames.length > 0) {
        changesDetected = true;
      }
    }

    try {
      await pyodide.runPythonAsync(pythonScript);
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
