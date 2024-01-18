let socket: any;
let pyodide: any;

let input_data: string | null = null;

onmessage = async function (event: MessageEvent<string>) {
  const data = JSON.parse(event.data);

  if (data.command == 'CLOSE') {
    closeSocket();
    console.log('SOCKET WAS JUST CLOSED');

  } else if (data.command === 'INPUT_RESPONSE') {

    console.log("input " + data);
    input_data = data.inputdata;

  } else if (data.command === 'RUN_SCRIPT') {
    console.log('Lets run command ' + data);
    const res = await runPythonCode(data);
  } else {
    console.log('Message: ' + event.data);
  }
};

const setUpSocket = async () => {
  // Function to establish WebSocket connection
  const socketIOClient = await import('socket.io-client');
  const newSocket = socketIOClient.io('http://localhost:5000/godot');

  newSocket.on('connect', () => {
    console.log('Socket.io connected');
    //setSocket(newSocket);
  });

  newSocket.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error);
  });

  newSocket.on('message', (message) => {
    console.log('Received message:', message);
    // Handle incoming messages
  });

  // newSocket.on('clientMessage', (message) => {
  //   console.log('clientMessage message:', message);
  //   // Handle incoming messages
  // });

  newSocket.on('frontMessage', (message) => {
    console.log('Godot message:', message);
    // Handle incoming messages
  });

  newSocket.on('disconnect', () => {
    console.log('Socket.io disconnected');
  });
  //setSocket(newSocket);
  return newSocket;
};

const setUpPyodide = async (socket: any,sessionId:string) => {
  //Inintialize Pyodide
  const pyodideModule = await import('pyodide');
  const loadedPyodide = await pyodideModule.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
  });

 
  
  loadedPyodide.setStdout({ batched: (msg: string) => postMessage('CMD:' + msg) });

  loadedPyodide.setStderr({ batched: (msg: string) => postMessage('CMD:' + msg) });
  //loadedPyodide.setStdin( { stdin: () => requestInputFromMainThread()});
  
  const RobotJS = await import ('../components/editors/RobotJS');
  const robot = new RobotJS.Fossbot(socket, 'fossbot', '1',sessionId);
  

  try {
    // Use micropip to install Python packages
    // await loadedPyodide.loadPackage('https://files.pythonhosted.org/packages/f8/bf/4790ed063ca2daa58fb20285fc3707218cf01e174209355d081d83094f6d/python_socketio-5.10.0-py3-none-any.whl');

    // Expose JS methods to Python
    loadedPyodide.globals.set('robot', robot);    

    //Custom Modules
    const moduleResponse = await fetch('/fossbotlib/testlib.py'); // Relative path from the public folder
    const moduleText = await moduleResponse.text();
    //loadedPyodide.runPython(moduleText);
    // Write the module text to Pyodide's virtual file system
    loadedPyodide.FS.writeFile('/home/pyodide/testlib.py', moduleText);
  } catch (e) {
    console.error('Error loading module or installing package:', e);
  }

  return loadedPyodide;
};

const closeSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
    return true;
  }
};

const runPythonCode = async (data) => {
  const pythonScript = data.script;
  const sessionId  = data.sessionId;

  console.log('runPythonCode..');
  const socket = await setUpSocket();
  if (socket) pyodide = await setUpPyodide(socket,sessionId);
  // if (!pyodide) {
  //   console.log('Pyodide not already loaded ..');
  //   pyodide = await setUpPyodide(socket);
  // }

  console.log('Pyodide okay ..  pyodide:', pyodide);

  if (pythonScript) {
    console.log('Running Python script :', pythonScript);

    postMessage('EMPTY_RESULTS');

    // Adds await to some function
    //const finalScript = fix_awaits(pythonScript);

    const finalScript = pythonScript;
    //console.log('finalScript :', finalScript);

    try {
      await pyodide.runPythonAsync(finalScript);
    } catch (e: any) {
      if (e.constructor.name === 'PythonError') {
        const errorMessage = e.message;
        const errorStartIndex = errorMessage.indexOf('File "<exec>"');
        let formattedErrorMessage = '';

        if (errorStartIndex !== -1) {
          // Extracting the error message starting after '^^^^'
          formattedErrorMessage += errorMessage.substring(errorStartIndex);
        } else {
          // If '^^^^' not found, use the entire message
          formattedErrorMessage += errorMessage;
        }
        // Append the formatted error message to the results
        postMessage('CMD:' + formattedErrorMessage);
      } else {
        // For non-Python errors, you might still want to handle them differently
        console.error('Unexpected error:', e);
      }
    }
    // }finally{
    //   socket.disconnect();
    // }
  }
};

const fix_awaits = (code: string) => {
  const result = code.replace('robot.forward(', 'await robot.forward(');
  return result;
};
