import { Button } from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type PythonExecutorProps = {
  pythonScript: string;
  onRunScript: (runScript: () => Promise<void>) => void;
  sessionId: string;
};

const PythonExecutor: React.FC<PythonExecutorProps> = ({
  pythonScript,
  onRunScript,
  sessionId,
}) => {
  const [results, setResults] = useState<string[]>([]);
  const { t } = useTranslation();

  const [error, setError] = useState('');

  // Create a new web worker
  const pyodideWorker = new Worker(new URL('../../workers/pyodideWorker.ts', import.meta.url));

  // Set up event listener for messages from the worker
  pyodideWorker.onmessage = function (event: MessageEvent<string>) {
    console.log('Received result from worker:', event.data);

    if (event.data.includes('CMD:')) {
      let result = event.data.split('CMD:')[1];
      setResults((prevResults) => [...prevResults, result]);

      //After receiving the result, close socket connection
      pyodideWorker.postMessage(JSON.stringify({ command: 'CLOSE' }));
    }

    if (event.data == 'EMPTY_RESULTS') {
      setResults([]);
    }
  };

  const runPythonScript = useCallback(async () => {
    if (pythonScript == '') {
      setError(t('errors.noCommandError'));
      return;
    }
    const scriptWithSession = {
      command: 'RUN_SCRIPT',
      script: pythonScript,
      sessionId: sessionId,
    };

    pyodideWorker.postMessage(JSON.stringify(scriptWithSession));
    setError('');
  }, [pythonScript]);

  useEffect(() => {
    onRunScript(runPythonScript);
  }, [runPythonScript, onRunScript]);

  // const testinput= useCallback(async () => {
  //   const packet = { command: 'INPUT_RESPONSE',
  //                    inputdata:'testinput'};
  //   pyodideWorker.postMessage(JSON.stringify(packet));
  // },[]);

  return (
    <div>
      {/* <Button variant="contained" onClick={testinput}>Test</Button> */}
      {error && (
        <>
          <p className="errorText">{error}</p>
        </>
      )}
      {results.map((result, index) => (
        <p key={index}>{result}</p>
      ))}
    </div>
  );
};

export default PythonExecutor;
