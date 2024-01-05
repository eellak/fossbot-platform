import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Fossbot } from "./RobotJS";

type PythonExecutorProps = {
    pythonScript: string;
    onRunScript: (runScript: () => Promise<void>) => void;
};


const PythonExecutor: React.FC<PythonExecutorProps> = ({ pythonScript, onRunScript }) => {
    const [pyodide, setPyodide] = useState<any>(null);
    const [results, setResults] = useState<string[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        // Function to establish WebSocket connection
        const establishSocketConnection = () => {
            return new Promise((resolve, reject) => {
                const newSocket = io('http://localhost:5000/godot');

                newSocket.on('connect', () => {
                    console.log('Socket.io connected');
                    setSocket(newSocket);
                    resolve(newSocket);

                });

                newSocket.on('connect_error', (error) => {
                    console.error('Socket.io connection error:', error);
                    reject(error);
                })

                newSocket.on('message', (message) => {
                    console.log('Received message:', message);
                    // Handle incoming messages
                });
                newSocket.on('disconnect', () => {
                    console.log('Socket.io disconnected');
                });
                setSocket(newSocket);
            })
        };

        //Inintialize Pyodide
        const loadPyodideAsync = async (socket: any) => {
            console.log(socket);
            const pyodideModule = await import('pyodide');
            const loadedPyodide = await pyodideModule.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
            });


            loadedPyodide.setStdout({ batched: (msg: string) => setResults(prevResults => [...prevResults, msg]) });
            loadedPyodide.setStderr({ batched: (msg: string) => setResults(prevResults => [...prevResults, msg]) });

            const robot = new Fossbot(socket, "fossbot", "1");


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
        };

        // Initialize WebSocket connection and then load Pyodide
        establishSocketConnection()
            .then(loadPyodideAsync)
            .catch(error => console.error("Error in initialization:", error));

        return () => {
            // Cleanup socket.io connection
            console.log('Cleaning up...');
            // Cleanup
            if (socket && socket.connected) {
                console.log('Cleaning up...');
                socket.disconnect();
            }

        };


    }, []);

    //Maybe not needed
    const fix_awaits = (code: string) => {

        const result = code.replace('robot.forward(', 'await robot.forward(');
        return result;
    }


    const runPythonScript = useCallback(async () => {

        if (pyodide && pythonScript) {
            console.log("Running Python script...");
            setResults([]);
            // Adds await to some function  
            //const finalScript = fix_awaits(pythonScript);
            const finalScript = pythonScript;

            try {
                await pyodide.runPythonAsync(finalScript);
            } catch (e: any) {
                if (e.constructor.name === 'PythonError') {
                    const errorMessage = e.message;
                    // alert(errorMessage);
                    const errorStartIndex = errorMessage.indexOf("File \"<exec>\"");
                    let formattedErrorMessage = "";

                    if (errorStartIndex !== -1) {
                        // Extracting the error message starting after '^^^^'
                        formattedErrorMessage += errorMessage.substring(errorStartIndex);
                    } else {
                        // If '^^^^' not found, use the entire message
                        formattedErrorMessage += errorMessage;
                    }

                    // Append the formatted error message to the results
                    setResults(prevResults => [...prevResults, formattedErrorMessage]);
                } else {
                    // For non-Python errors, you might still want to handle them differently
                    console.error("Unexpected error:", e);
                }

            }

        }
    }, [pyodide, pythonScript]);


    useEffect(() => {
        onRunScript(runPythonScript);
    }, [runPythonScript, onRunScript]);

    return (
        <div>
            {results.map((result, index) => (
                <p key={index}>{result}</p>
            ))}
        </div>
    );
};

export default PythonExecutor;
