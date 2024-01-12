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
    pyodideWorker.onmessage = function (event) {
        console.log('Received result from worker:', event.data);
    };
    
    pyodideWorker.postMessage('SETUP')

    return (
        <div>
            {results.map((result, index) => (
                <p key={index}>{result}</p>
            ))}
        </div>
    );
};

export default PythonExecutor;
