import { Button } from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type PythonExecutorProps = {
  pythonScript: string;
  onRunScript: (runScript: () => Promise<void>) => void;
  onStopScript: (stopScript: () => void) => void;
  sessionId: string;
  moveStep: (distance: number) => Promise<void>;
  rotateStep: (angle: number) => Promise<void>;
  getdistance: () => number;
  rgbsetcolor: (color: string) => void;
  getacceleration: (axis: string) => number[];
  getgyroscope: (axis: string) => number[];
  getfloorsensor: (sensor_id: number) => boolean;
  justRotate: (direction: string) => void;
  justMove: (direction: string) => void;
  stopMotion: () => void;
  getLightSensor: () => number;
  drawLine: (status: boolean) => void;
};

const PythonExecutor = ({
  pythonScript,
  sessionId,
  onRunScript,
  onStopScript,
  moveStep,
  rotateStep,
  getdistance,
  rgbsetcolor,
  getacceleration,
  getgyroscope,
  getfloorsensor,
  justRotate,
  justMove,
  stopMotion,
  getLightSensor,
  drawLine
}: PythonExecutorProps) => {
  const [results, setResults] = useState<string[]>([]);
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [pyodideWorker, setPyodideWorker] = useState<Worker | null>(null);

  const createWorker = () => {
    const worker = new Worker(new URL('../../workers/pyodideWorker.ts', import.meta.url));

    worker.onmessage = async function (event: MessageEvent<string>) {
      console.log('Received result from worker:', event.data);
      const data = JSON.parse(event.data);

      if (data.command === 'stdout' || data.command === 'stderr') {
        setResults((prevResults) => [...prevResults, data.data]);

        worker.postMessage(JSON.stringify({ command: 'exit' }));
      }
      if (data.command === 'move') {
        await moveStep(data.distance);
        worker.postMessage(JSON.stringify({ command: 'move_done' }));
      } else if (data.command === 'rotate') {
        await rotateStep(data.angle);
        worker.postMessage(JSON.stringify({ command: 'rotate_done' }));
      } else if (data.command === 'getdistance') {
        const distance = getdistance();
        worker.postMessage(JSON.stringify({ command: 'getdistance_done', distance }));
      } else if (data.command === 'rgbsetcolor') {
        await rgbsetcolor(data.color);
        worker.postMessage(JSON.stringify({ command: 'rgbsetcolor_done' }));
      } else if (data.command === 'getacceleration') {
        const acceleration = await getacceleration(data.axis);
        worker.postMessage(JSON.stringify({ command: 'getacceleration_done', acceleration }));
      } else if (data.command === 'getgyroscope') {
        const gyroscope = await getgyroscope(data.axis);
        worker.postMessage(JSON.stringify({ command: 'getgyroscope_done', gyroscope }));
      } else if (data.command === 'getfloorsensor') {
        const floorsensor = await getfloorsensor(data.sensor_id);
        worker.postMessage(JSON.stringify({ command: 'getfloorsensor_done', floorsensor }));
      } else if (data.command === 'justRotate') {
        await justRotate(data.direction);
        worker.postMessage(JSON.stringify({ command: 'just_rotate_done' }));
      } else if (data.command === 'justMove') {
        await justMove(data.direction);
        worker.postMessage(JSON.stringify({ command: 'just_move_done' }));
      } else if (data.command === 'stopMotion') {
        stopMotion();
        worker.postMessage(JSON.stringify({ command: 'stop_motion_done' }));
      } else if (data.command === 'getlightsensor') {
        const lightsensor = await getLightSensor();
        worker.postMessage(JSON.stringify({ command: 'getlightsensor_done', lightsensor }));
      } else if (data.command === 'drawLine') {
        await drawLine(data.status);
        worker.postMessage(JSON.stringify({ command: 'drawLine_done' }));
      }

      if (data.command === 'clear_results') {
        setResults([]);
      }
    };

    return worker;
  };

  useEffect(() => {
    const worker = createWorker();
    setPyodideWorker(worker);

    return () => {
      worker.terminate();
    };
  }, []);

  const runPythonScript = useCallback(async () => {
    if (pythonScript === '') {
      setError(t('errors.noCommandError'));
      return;
    }

    if (!pyodideWorker) {
      const worker = createWorker();
      setPyodideWorker(worker);
    }

    const scriptWithSession = {
      command: 'run',
      script: pythonScript,
      sessionId: sessionId,
    };

    pyodideWorker?.postMessage(JSON.stringify(scriptWithSession));
    setError('');
  }, [pythonScript, sessionId, t, pyodideWorker]);

  const stopPythonScript = useCallback(() => {
    pyodideWorker?.terminate();
    const newWorker = createWorker();
    setPyodideWorker(newWorker);
  }, [pyodideWorker]);

  useEffect(() => {
    onRunScript(runPythonScript);
  }, [runPythonScript, onRunScript]);

  useEffect(() => {
    onStopScript(stopPythonScript);
  }, [stopPythonScript, onStopScript]);

  return (
    <div>
      {error && (
        <>
          <p className="errorText" style={{ wordWrap: 'break-word' }}>{error}</p>
        </>
      )}
      {results.map((result, index) => (
        <p key={index} style={{ wordWrap: 'break-word' }}>{result}</p>
      ))}
    </div>
  );
};

export default PythonExecutor;
