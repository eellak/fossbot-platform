let socket: any;
let pyodide: any; 
let results: any[] = [];

function setSocket(value: any) {
    socket = value;
}

function setPyodide(value: any) {
    pyodide = value;
}

onmessage = async function (event: MessageEvent<string>) {
    console.log("Received message from the main thread:", event.data);
    postMessage('message received')

    if(event.data == 'SETUP') {
        await setUp();
        postMessage('SET UP READY')
    } else if (event.data == 'CLOSE') {
        closeSocket()
        postMessage('SOCKET WAS JUST CLOSED')
    } else {
        postMessage('Lets run command: ', event.data)
        runPythonCode('CMD:' + event.data)
    } 
}

const setUp = async () => {
    // Function to establish WebSocket connection
    const socketIOClient = await import("socket.io-client");
    const newSocket = socketIOClient.io('http://localhost:5000/godot');

    newSocket.on('connect', () => {
        console.log('Socket.io connected');
        setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error);
    })

    newSocket.on('message', (message) => {
        console.log('Received message:', message);
        // Handle incoming messages
    });
    newSocket.on('disconnect', () => {
        console.log('Socket.io disconnected');
    });
    setSocket(newSocket);

    //Inintialize Pyodide
    const pyodideModule = await import('pyodide');
    const loadedPyodide = await pyodideModule.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
    });


    loadedPyodide.setStdout({ batched: (msg: string) => 
        // results.push(msg)
        postMessage(msg)
    });

    loadedPyodide.setStderr({ batched: (msg: string) => 
        postMessage(msg)
    });

    const Fossbot = await import("../components/editors/RobotJS");
    const robot = new Fossbot.default(socket, "fossbot", "1");

    try {
        // Use micropip to install Python packages
        // await loadedPyodide.loadPackage('https://files.pythonhosted.org/packages/f8/bf/4790ed063ca2daa58fb20285fc3707218cf01e174209355d081d83094f6d/python_socketio-5.10.0-py3-none-any.whl'); 
        // await loadedPyodide.loadPackage('https://files.pythonhosted.org/packages/bd/4d/34a3c91e55158822ac0f870025e930aac300b2ef11beb15e48662a449ebf/python_engineio-4.8.1-py3-none-any.whl');
        // await loadedPyodide.loadPackage("ssl");
        // await loadedPyodide.loadPackage("https://files.pythonhosted.org/packages/b5/82/ce0b6380f35f49d3fe687979a324c342cfa3588380232f3801db9dd62f9e/bidict-0.22.1-py3-none-any.whl"); 
        // await loadedPyodide.loadPackage("https://files.pythonhosted.org/packages/70/8e/0e2d847013cb52cd35b38c009bb167a1a26b2ce6cd6965bf26b47bc0bf44/requests-2.31.0-py3-none-any.whl");
        // await loadedPyodide.loadPackage("https://files.pythonhosted.org/packages/96/94/c31f58c7a7f470d5665935262ebd7455c7e4c7782eb525658d3dbf4b9403/urllib3-2.1.0-py3-none-any.whl");
        // await loadedPyodide.loadPackage("https://files.pythonhosted.org/packages/28/76/e6222113b83e3622caa4bb41032d0b1bf785250607392e1b778aca0b8a7d/charset_normalizer-3.3.2-py3-none-any.whl");
        // await loadedPyodide.loadPackage("idna");
        // await loadedPyodide.loadPackage("certifi");
        //!FIXME Not Sure how to install packages ?????
        // Use micropip to install Python packages
        // await pyodide.loadPackage("micropip");
        // const micropip = pyodide.pyimport("micropip");
        // await micropip.install('numpy');
        // await loadedPyodide.runPythonAsync(`
        //     import micropip
        //     await micropip.install('numpy')  # Replace 'example-package' with the package you want to install
        // `);

        // Expose JS methods to Python             
        loadedPyodide.globals.set('robot', robot);

        //Custom Modules
        const moduleResponse = await fetch('/fossbotlib/testlib.py'); // Relative path from the public folder
        const moduleText = await moduleResponse.text();
        //loadedPyodide.runPython(moduleText);                
        // Write the module text to Pyodide's virtual file system
        loadedPyodide.FS.writeFile('/home/pyodide/testlib.py', moduleText);
    } catch (e) {
        console.error("Error loading module or installing package:", e);
    }

    setPyodide(loadedPyodide);
}

const closeSocket = () => {
    if (socket && socket.connected) {
        socket.disconnect();
        return true;
    }
}

const runPythonCode = async (pythonScript: string) => {
    if (pyodide && pythonScript) {
        console.log("Running Python script...");
        results = [];
        // Adds await to some function
        //const finalScript = fix_awaits(pythonScript);
        const finalScript = pythonScript;

        try {
            await pyodide.runPythonAsync(finalScript);
        } catch (e: any) {
            if (e.constructor.name === "PythonError") {
            const errorMessage = e.message;
            const errorStartIndex = errorMessage.indexOf('File "<exec>"');
            let formattedErrorMessage = "";

            if (errorStartIndex !== -1) {
                // Extracting the error message starting after '^^^^'
                formattedErrorMessage += errorMessage.substring(errorStartIndex);
            } else {
                // If '^^^^' not found, use the entire message
                formattedErrorMessage += errorMessage;
            }
                // Append the formatted error message to the results
                //results.push(formattedErrorMessage);
                postMessage(formattedErrorMessage)
            } else {
            // For non-Python errors, you might still want to handle them differently
            console.error("Unexpected error:", e);
            }
        }
    }
    // return results
}

const fix_awaits = (code: string) => {

    const result = code.replace('robot.forward(', 'await robot.forward(');
    return result;
}
