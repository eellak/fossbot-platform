import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

type PythonExecutorProps = {
    pythonScript: string;
    onRunScript: (runScript: () => Promise<void>) => void;
};

const PythonExecutor: React.FC<PythonExecutorProps> = ({ pythonScript, onRunScript }) => {
    const [pyodide, setPyodide] = useState<any>(null);
    const [results, setResults] = useState<string[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);

    // Create a new web worker
    const pyodideWorker = new Worker(new URL('../../workers/pyodideWorker.ts', import.meta.url));

    // Set up event listener for messages from the worker
    pyodideWorker.onmessage = function (event: MessageEvent<string>) {
        console.log('Received result from worker:', event.data);

        if(event.data.includes('CMD')) {
          let result = event.data.split('CMD:')[1];
          setResults([result]);
        }
    };

    useEffect(() => {
        //Set up socket connection and pyodide
        pyodideWorker.postMessage('SETUP');

        return () => {
            // Cleanup socket.io connection
            pyodideWorker.postMessage('CLOSE');
        };
    }, []);

    const runPythonScript = useCallback(async () => {
      if(pythonScript == '') {
        alert('Please write a command in the Monaco Editor!');
        return;
      }
      pyodideWorker.postMessage(JSON.stringify(pythonScript));
    }, [pythonScript]);
  
    
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
