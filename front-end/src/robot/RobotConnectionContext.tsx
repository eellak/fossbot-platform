import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';

export type ExecutionTarget = 'simulation' | 'robot';
export type RobotConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type DiscoveredRobot = {
  url: string;
  label: string;
};

export type RobotProgramState =
  | 'idle'
  | 'accepted'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'stopped'
  | 'failed';

export type RobotTelemetry = {
  timestamp?: number;
  sequence?: number;
  agentVersion?: string;
  program?: {
    state?: RobotProgramState;
    programId?: string | null;
    origin?: string | null;
  };
  power?: {
    raw?: number | null;
    voltage?: number | null;
    percentage?: number | null;
  };
  sensors?: {
    distanceCm?: number | null;
    obstacle?: {
      frontLeft?: number | null;
      frontRight?: number | null;
      rearLeft?: number | null;
      rearRight?: number | null;
    };
    floor?: {
      left?: number | null;
      center?: number | null;
      right?: number | null;
    };
    light?: number | null;
    noise?: number | null;
    acceleration?: SensorVector;
    gyroscope?: SensorVector;
    odometry?: {
      leftCm?: number | null;
      rightCm?: number | null;
    };
  };
  rc?: {
    active?: boolean;
  };
};

export type SensorVector = {
  x?: number | null;
  y?: number | null;
  z?: number | null;
};

export type RobotTerminalLine = {
  id: string;
  programId?: string;
  stream: 'stdout' | 'stderr';
  text: string;
  timestamp?: number;
};

type InteractiveRobotAction =
  | 'forward'
  | 'reverse'
  | 'left'
  | 'right'
  | 'light-on'
  | 'light-off';

export type RcAction = 'stop' | 'light-on' | 'light-off' | 'beep';

type RobotConnectionContextValue = {
  target: ExecutionTarget;
  setTarget: (target: ExecutionTarget) => void;
  robotUrl: string;
  setRobotUrl: (url: string) => void;
  status: RobotConnectionStatus;
  statusMessage: string;
  output: string[];
  terminalLines: RobotTerminalLine[];
  clearTerminal: () => void;
  telemetry?: RobotTelemetry;
  programState: RobotProgramState;
  connect: (url?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  discover: (networkPrefix?: string) => Promise<DiscoveredRobot[]>;
  runCode: (code: string, filename: string) => Promise<string>;
  runInteractiveAction: (action: InteractiveRobotAction) => Promise<void>;
  sendRcDrive: (throttle: number, steering: number, maxSpeed: number) => void;
  runRcAction: (action: RcAction) => Promise<void>;
  stop: () => Promise<void>;
};

type RobotResult = {
  status?: string | number;
  error?: string;
  request_id?: string;
};

type ScriptStatusResult = {
  status?: string;
};

type ProgramSubmitResult = {
  accepted?: boolean;
  error?: string;
  programId?: string;
};

const DEFAULT_ROBOT_URL = 'http://fossbot-000.local:8081';
const STORAGE_KEY = 'fossbot.robotUrl';
const TARGET_STORAGE_KEY = 'fossbot.executionTarget';
const CONNECT_TIMEOUT_MS = 6000;
const DISCOVERY_TIMEOUT_MS = 1200;
const ROBOT_EVENT_TIMEOUT_MS = 3000;
const RobotConnectionContext = createContext<RobotConnectionContextValue | undefined>(undefined);

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const emitAndWait = <T,>(
  socket: Socket,
  eventName: string,
  timeoutMessage: string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, ROBOT_EVENT_TIMEOUT_MS);
    const handleResponse = (response: T) => {
      cleanup();
      resolve(response);
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off(eventName, handleResponse);
    };
    socket.once(eventName, handleResponse);
    socket.emit(eventName);
  });

const emitPayloadAndWait = <T,>(
  socket: Socket,
  requestEvent: string,
  responseEvent: string,
  payload: unknown,
  timeoutMessage: string,
  timeout = ROBOT_EVENT_TIMEOUT_MS,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeout);
    const handleResponse = (response: T) => {
      cleanup();
      resolve(response);
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off(responseEvent, handleResponse);
    };
    socket.once(responseEvent, handleResponse);
    socket.emit(requestEvent, payload);
  });

const stopRunningProgram = async (socket: Socket): Promise<boolean> => {
  const scriptStatus = await emitAndWait<ScriptStatusResult>(
    socket,
    'script_status',
    'The robot did not report its program status.',
  );
  if (scriptStatus.status !== 'still running') return false;

  await emitAndWait<unknown>(
    socket,
    'stop_script',
    'The robot did not acknowledge the stop request.',
  );
  // The Pi agent terminates the old worker asynchronously. Give its completion
  // thread time to finish before assigning the hardware to the next mode.
  await delay(750);
  return true;
};

const normalizeRobotUrl = (value: string): string => {
  const candidate = value.trim();
  if (!candidate) {
    throw new Error('Enter a robot URL.');
  }
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The robot URL must use http:// or https://.');
  }
  if (!url.port) {
    url.port = '8081';
  }
  return url.toString().replace(/\/$/, '');
};

const createRobotSocket = (url: string, timeout = CONNECT_TIMEOUT_MS): Socket =>
  io(url, {
    // FOSSBot's Flask-SocketIO agent is served by Werkzeug and uses polling.
    transports: ['polling'],
    reconnection: false,
    timeout,
  });

const connectionErrorMessage = (
  error: unknown,
  robotUrl: string,
  robotIsReachable: boolean,
): string => {
  const socketError = error as Error & {
    context?: { responseText?: string; status?: number };
    description?: number;
  };
  const serverResponse = socketError.context?.responseText || '';
  if (/not an accepted origin/i.test(serverResponse)) {
    return `The robot rejected this website's origin (${window.location.origin}). Update the FOSSBot agent to allow this origin.`;
  }
  const detail = socketError?.message || String(error);
  if (robotIsReachable) {
    return (
      `${robotUrl} is reachable from this browser, but its Socket.IO agent did not accept ` +
      `a readable connection from ${window.location.origin}. Opening the robot in another tab ` +
      `does not grant cross-origin access. Add this website origin to the FOSSBot agent's ` +
      `allowed origins. (${detail})`
    );
  }
  return (
    `The browser could not reach ${robotUrl}. Check the address and Wi-Fi, then allow ` +
    `“Local network access” for ${window.location.host} if your browser offers that permission. ` +
    `(${detail})`
  );
};

const isPrivateNetworkPrefix = (value: string): boolean => {
  const octets = value.split('.').map(Number);
  if (
    octets.length !== 3 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
};

const buildPhysicalRobotProgram = (code: string): string => {
  const compatibilityPrelude = `
# FOSSBot Platform compatibility helpers for programs created for the simulator.
from time import sleep as _fossbot_sleep

def move_forward_distance(distance, _robot=robot):
    _robot.move_forward_distance(abs(distance))

def move_reverse_distance(distance, _robot=robot):
    _robot.move_reverse_distance(abs(distance))

def move_step(direction="forward", _robot=robot):
    if direction in ("backward", "reverse"):
        _robot.move_reverse_default()
    else:
        _robot.move_forward_default()

def just_move(direction="forward", _robot=robot):
    if direction in ("backward", "reverse"):
        _robot.move_reverse()
    else:
        _robot.move_forward()

def rotate_90(direction="right", _robot=robot):
    if direction in ("left", "counterclockwise"):
        _robot.rotate_counterclockwise_90()
    else:
        _robot.rotate_clockwise_90()

def rotate_45(direction="right", _robot=robot):
    _robot.rotate_degrees(45, clockwise=direction not in ("left", "counterclockwise"))

def rotate_degrees(angle, _robot=robot):
    _robot.rotate_degrees(abs(angle), clockwise=angle >= 0)

def rotate_clockwise(_robot=robot):
    _robot.rotate_clockwise()

def rotate_counterclockwise(_robot=robot):
    _robot.rotate_counterclockwise()

def just_rotate(direction="right", _robot=robot):
    if direction in ("left", "counterclockwise"):
        _robot.rotate_counterclockwise()
    else:
        _robot.rotate_clockwise()

def stop(_robot=robot):
    _robot.stop()

def get_obstacle_distance(_robot=robot):
    return _robot.get_distance()

def get_floor_sensor(sensor_id, _robot=robot):
    return _robot.get_floor_sensor(3 if sensor_id == 0 else sensor_id)

def get_acceleration(axis, _robot=robot):
    return _robot.get_acceleration(axis)

def get_gyroscope(axis, _robot=robot):
    return _robot.get_gyroscope(axis)

def get_light_sensor(_robot=robot):
    return _robot.get_light_sensor()

def rgb_set_color(color, _robot=robot):
    # The physical library calls its off state "closed". The v2 broker accepts
    # both names, while "closed" also keeps older FOSSBot agents compatible.
    _robot.rgb_set_color("closed" if color in ("off", "closed") else color)

def draw(status, _transmit=transmit):
    _transmit("Drawing is a simulator-only visual aid; the physical marker is mechanical.")
`;
  return `${compatibilityPrelude}\n${code}`;
};

const probeRobot = async (
  url: string,
  timeout = DISCOVERY_TIMEOUT_MS,
): Promise<DiscoveredRobot | undefined> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    // An opaque response is sufficient for reachability. We deliberately probe
    // the home page instead of creating an Engine.IO session that we cannot read
    // until the robot allows this website's origin.
    await fetch(`${url}/?fossbot_probe=${Date.now()}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return { url, label: 'Device responding on the FOSSBot port' };
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timer);
  }
};

export const RobotConnectionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [target, setTargetState] = useState<ExecutionTarget>(() => {
    try {
      return window.localStorage.getItem(TARGET_STORAGE_KEY) === 'robot' ? 'robot' : 'simulation';
    } catch {
      return 'simulation';
    }
  });
  const [robotUrl, setRobotUrlState] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_ROBOT_URL;
    } catch {
      return DEFAULT_ROBOT_URL;
    }
  });
  const [status, setStatus] = useState<RobotConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState(
    target === 'robot'
      ? 'Physical robot mode selected. Connect to your FOSSBot.'
      : 'Simulation is active.',
  );
  const [output, setOutput] = useState<string[]>([]);
  const [terminalLines, setTerminalLines] = useState<RobotTerminalLine[]>([]);
  const [telemetry, setTelemetry] = useState<RobotTelemetry>();
  const [programState, setProgramState] = useState<RobotProgramState>('idle');
  const socketRef = useRef<Socket>();
  const supportsV2Ref = useRef(false);
  const robotUrlRef = useRef(robotUrl);
  const runQueueRef = useRef<Promise<void>>(Promise.resolve());
  const rcActionQueueRef = useRef<Promise<void>>(Promise.resolve());

  const appendOutput = useCallback((line: string) => {
    setOutput((current) => [...current.slice(-199), line]);
  }, []);

  const appendTerminalLine = useCallback(
    (stream: 'stdout' | 'stderr', text: unknown, programId?: string, timestamp?: number) => {
      const normalizedText = String(text ?? '');
      setTerminalLines((current) => [
        ...current.slice(-499),
        {
          id: `${timestamp || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          programId,
          stream,
          text: normalizedText,
          timestamp,
        },
      ]);
    },
    [],
  );

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = undefined;
    if (socket) {
      if (socket.connected && supportsV2Ref.current) {
        socket.emit('rc:action', { action: 'stop' });
      }
      socket.removeAllListeners();
      socket.disconnect();
    }
    supportsV2Ref.current = false;
    setTelemetry(undefined);
    setProgramState('idle');
  }, []);

  const disconnect = useCallback(async () => {
    disconnectSocket();
    setStatus('disconnected');
    setStatusMessage('Robot disconnected.');
  }, [disconnectSocket]);

  const stop = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new Error('Connect to a physical FOSSBot first.');
    }
    if (supportsV2Ref.current) {
      await emitPayloadAndWait<unknown>(
        socket,
        'program:stop',
        'program:stop:result',
        { reason: 'platform' },
        'The robot did not acknowledge the stop request.',
      );
    } else {
      await emitAndWait<unknown>(
        socket,
        'stop_script',
        'The robot did not acknowledge the stop request.',
      );
    }
    setStatusMessage('The robot acknowledged the stop request.');
  }, []);

  const setTarget = useCallback(
    (nextTarget: ExecutionTarget) => {
      if (nextTarget === target) return;
      if (nextTarget === 'simulation') {
        if (socketRef.current?.connected) {
          socketRef.current.emit('stop_script');
        }
        disconnectSocket();
        setStatus('disconnected');
      }
      setTargetState(nextTarget);
      try {
        window.localStorage.setItem(TARGET_STORAGE_KEY, nextTarget);
      } catch {
        // Local storage can be unavailable in privacy-restricted browsers.
      }
      setStatusMessage(
        nextTarget === 'simulation'
          ? 'Simulation is active.'
          : 'Physical robot mode selected. The browser will connect directly to your FOSSBot.',
      );
    },
    [disconnectSocket, target],
  );

  const setRobotUrl = useCallback((url: string) => {
    robotUrlRef.current = url;
    setRobotUrlState(url);
  }, []);

  const connect = useCallback(
    async (urlOverride?: string) => {
      const normalizedUrl = normalizeRobotUrl(urlOverride || robotUrlRef.current);
      disconnectSocket();
      setStatus('connecting');
      setStatusMessage(`Browser connecting directly to ${normalizedUrl}…`);
      setRobotUrl(normalizedUrl);
      setOutput([]);
      setTerminalLines([]);
      try {
        window.localStorage.setItem(STORAGE_KEY, normalizedUrl);
      } catch {
        // Local storage can be unavailable in privacy-restricted browsers.
      }

      const reachableRobot = await probeRobot(normalizedUrl, 3000);
      const socket = createRobotSocket(normalizedUrl);
      socketRef.current = socket;
      socket.on('trm', (message: { data?: unknown; programId?: string; stream?: string }) => {
        if (!supportsV2Ref.current) {
          appendTerminalLine(
            message?.stream === 'stderr' ? 'stderr' : 'stdout',
            message?.data,
            message?.programId,
          );
        }
      });
      socket.on('telemetry:update', (snapshot: RobotTelemetry) => {
        setTelemetry(snapshot);
        setProgramState(snapshot.program?.state || 'idle');
      });
      socket.on('telemetry:snapshot', (snapshot: RobotTelemetry) => {
        setTelemetry(snapshot);
        setProgramState(snapshot.program?.state || 'idle');
      });
      socket.on('robot:state', (snapshot: RobotTelemetry) => {
        setTelemetry(snapshot);
        setProgramState(snapshot.program?.state || 'idle');
      });
      ['accepted', 'started', 'stopping', 'completed', 'stopped', 'failed'].forEach(
        (eventState) => {
          socket.on(`program:${eventState}`, (program: { programId?: string; error?: unknown }) => {
            const normalizedState =
              eventState === 'started' ? 'running' : (eventState as RobotProgramState);
            setProgramState(normalizedState);
            if (eventState === 'failed') {
              appendOutput(`[program] Failed: ${String(program?.error || 'execution error')}`);
            }
          });
        },
      );
      socket.on('program:stdout', (message: {
        line?: unknown;
        programId?: string;
        timestamp?: number;
      }) => {
        appendTerminalLine('stdout', message?.line, message?.programId, message?.timestamp);
      });
      socket.on('program:stderr', (message: {
        line?: unknown;
        programId?: string;
        timestamp?: number;
      }) => {
        appendTerminalLine('stderr', message?.line, message?.programId, message?.timestamp);
      });
      socket.on('fossbot_status', (robotStatus: unknown) =>
        appendOutput(`[status] ${JSON.stringify(robotStatus)}`),
      );
      socket.on('script_status', (scriptStatus: unknown) =>
        appendOutput(`[program] ${JSON.stringify(scriptStatus)}`),
      );
      socket.on('rc:error', (result: { error?: unknown }) => {
        const message = String(result?.error || 'RC command rejected.');
        setStatusMessage(message);
        appendOutput(`[rc] ${message}`);
      });
      socket.on('stop_script', (result: unknown) =>
        appendOutput(`[stop] ${JSON.stringify(result)}`),
      );
      socket.on('disconnect', (reason) => {
        if (socketRef.current !== socket) return;
        setStatus('disconnected');
        setStatusMessage(`Robot disconnected: ${reason}`);
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(
            () => reject(new Error('Connection timed out.')),
            CONNECT_TIMEOUT_MS,
          );
          const cleanup = () => {
            window.clearTimeout(timer);
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
          };
          const onConnect = () => {
            cleanup();
            resolve();
          };
          const onError = (error: Error) => {
            cleanup();
            reject(error);
          };
          socket.once('connect', onConnect);
          socket.once('connect_error', onError);
        });
        setStatus('connected');
        setStatusMessage(`Browser connected directly to ${normalizedUrl}.`);
        appendOutput(`[connection] Connected to ${normalizedUrl}`);
        try {
          const hello = await emitPayloadAndWait<{ agentVersion?: string; state?: RobotTelemetry }>(
            socket,
            'robot:hello',
            'robot:hello',
            { protocolVersion: '1.0', platformVersion: 'web' },
            'The robot does not support the platform v2 handshake.',
            1800,
          );
          supportsV2Ref.current = true;
          if (hello.state) {
            setTelemetry({ ...hello.state, agentVersion: hello.agentVersion });
            setProgramState(hello.state.program?.state || 'idle');
          }
          appendOutput(`[agent] Platform protocol v2 (${hello.agentVersion || 'unknown version'})`);
          socket.emit('telemetry:get_snapshot');
        } catch {
          supportsV2Ref.current = false;
          appendOutput('[agent] Legacy FOSSBot protocol');
          socket.emit('connection', { data: 'FOSSBot Platform browser connected' });
          socket.emit('get_fossbot_status');
        }
      } catch (error) {
        if (socketRef.current === socket) {
          disconnectSocket();
        }
        const message = connectionErrorMessage(error, normalizedUrl, Boolean(reachableRobot));
        setStatus('error');
        setStatusMessage(message);
        throw new Error(message);
      }
    },
    [appendOutput, appendTerminalLine, disconnectSocket, setRobotUrl],
  );

  const discover = useCallback(async (networkPrefix?: string) => {
    const prefix = networkPrefix?.trim();
    if (prefix && !isPrivateNetworkPrefix(prefix)) {
      throw new Error('Enter a private IPv4 prefix such as 192.168.1.');
    }
    const standardCandidates = new Set<string>([
      normalizeRobotUrl(robotUrlRef.current),
      'http://fossbot-000.local:8081',
      'http://10.41.0.1:8081',
    ]);
    const found: DiscoveredRobot[] = [];
    // Probe standard addresses one at a time. Browsers can serialize local
    // network permission decisions, so simultaneous requests to unrelated
    // private networks can otherwise block the valid mDNS request.
    for (const url of standardCandidates) {
      const robot = await probeRobot(url, url.includes('.local') ? 5000 : 2500);
      if (robot) found.push(robot);
      if (robot && !prefix) return found;
    }
    if (!prefix) return found;

    const candidates: string[] = [];
    if (prefix) {
      for (let host = 1; host < 255; host += 1) {
        candidates.push(`http://${prefix}.${host}:8081`);
      }
    }
    let next = 0;
    const worker = async () => {
      while (next < candidates.length) {
        const url = candidates[next++];
        const robot = await probeRobot(url);
        if (robot && !found.some((item) => item.url === robot.url)) found.push(robot);
      }
    };
    await Promise.all(Array.from({ length: Math.min(24, candidates.length) }, worker));
    return found.sort((left, right) => left.url.localeCompare(right.url));
  }, []);

  const runCode = useCallback(
    (code: string, filename: string): Promise<string> => {
      if (!code.trim()) {
        return Promise.reject(new Error('The program is empty.'));
      }
      const socket = socketRef.current;
      if (!socket?.connected) {
        return Promise.reject(new Error('Connect to a physical FOSSBot first.'));
      }

      const execute = async (): Promise<string> => {
        if (socketRef.current !== socket || !socket.connected) {
          throw new Error('The physical FOSSBot disconnected before the program could run.');
        }

        const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        clearTerminal();
        appendOutput(`[run] ${filename} (${requestId})`);
        if (supportsV2Ref.current) {
          const result = await emitPayloadAndWait<ProgramSubmitResult>(
            socket,
            'program:submit',
            'program:submit:result',
            {
              programId: requestId,
              source: buildPhysicalRobotProgram(code),
              sourceType: 'python',
              origin: filename,
            },
            'The robot did not acknowledge the program.',
            10000,
          );
          if (!result.accepted) {
            throw new Error(result.error || 'The robot rejected the program.');
          }
          return result.programId || requestId;
        }

        const previousProgramStopped = await stopRunningProgram(socket);
        if (previousProgramStopped) {
          appendOutput('[transition] Previous program stopped; starting the next mode.');
        }
        return await new Promise<string>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error('The robot did not acknowledge the program.'));
          }, 10000);
          const handleResult = (result: RobotResult) => {
            cleanup();
            if (String(result.status) === '200') {
              resolve(result.request_id || requestId);
            } else {
              reject(
                new Error(
                  result.error || `Robot rejected the program (${result.status || 'unknown'}).`,
                ),
              );
            }
          };
          const cleanup = () => {
            window.clearTimeout(timer);
            socket.off('execute_blockly_result', handleResult);
          };
          socket.on('execute_blockly_result', handleResult);
          socket.emit('execute_blockly', {
            id: -1,
            project_id: -1,
            code: buildPhysicalRobotProgram(code),
            filename,
            request_id: requestId,
          });
        });
      };

      const queuedRun = runQueueRef.current.then(execute, execute);
      runQueueRef.current = queuedRun.then(
        () => undefined,
        () => undefined,
      );
      return queuedRun;
    },
    [appendOutput, clearTerminal],
  );

  const runInteractiveAction = useCallback(
    async (action: InteractiveRobotAction) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        throw new Error('Connect to a physical FOSSBot first.');
      }
      if (supportsV2Ref.current) {
        const commandId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await emitPayloadAndWait<ProgramSubmitResult>(
          socket,
          'interactive:command',
          'interactive:command:result',
          { commandId, command: action },
          'The robot did not acknowledge the interactive command.',
          10000,
        );
        if (!result.accepted) throw new Error(result.error || 'Interactive command rejected.');
        return;
      }
      const movementSpeed =
        'robot.motor_left.set_speed(25)\nrobot.motor_right.set_speed(25)\n';
      const programs: Record<InteractiveRobotAction, string> = {
        forward: `${movementSpeed}robot.move_forward_default()`,
        reverse: `${movementSpeed}robot.move_reverse_default()`,
        left: 'robot.rotate_degrees(90, clockwise=False, speed=25)',
        right: 'robot.rotate_degrees(90, clockwise=True, speed=25)',
        // Keep the process alive briefly because the robot runner clears GPIO
        // outputs when each one-shot interactive command exits.
        'light-on': 'robot.rgb_set_color("white")\nrobot.wait(1)',
        'light-off': 'robot.rgb_set_color("off")',
      };
      await runCode(programs[action], `interactive_${action}.py`);
    },
    [runCode],
  );

  const sendRcDrive = useCallback((throttle: number, steering: number, maxSpeed: number) => {
    const socket = socketRef.current;
    if (!socket?.connected) throw new Error('Connect to a physical FOSSBot first.');
    if (!supportsV2Ref.current) throw new Error('This FOSSBot agent does not support RC mode.');
    socket.emit('rc:drive', { throttle, steering, maxSpeed });
  }, []);

  const runRcAction = useCallback((action: RcAction): Promise<void> => {
    const execute = async () => {
      const socket = socketRef.current;
      if (!socket?.connected) throw new Error('Connect to a physical FOSSBot first.');
      if (!supportsV2Ref.current) throw new Error('This FOSSBot agent does not support RC mode.');
      const result = await emitPayloadAndWait<{ accepted?: boolean; error?: string }>(
        socket,
        'rc:action',
        'rc:action:result',
        { action },
        'The robot did not acknowledge the RC action.',
      );
      if (!result.accepted) throw new Error(result.error || 'The robot rejected the RC action.');
    };
    const queuedAction = rcActionQueueRef.current.then(execute, execute);
    rcActionQueueRef.current = queuedAction.then(
      () => undefined,
      () => undefined,
    );
    return queuedAction;
  }, []);

  useEffect(() => () => disconnectSocket(), [disconnectSocket]);

  const value = useMemo<RobotConnectionContextValue>(
    () => ({
      target,
      setTarget,
      robotUrl,
      setRobotUrl,
      status,
      statusMessage,
      output,
      terminalLines,
      clearTerminal,
      telemetry,
      programState,
      connect,
      disconnect,
      discover,
      runCode,
      runInteractiveAction,
      sendRcDrive,
      runRcAction,
      stop,
    }),
    [
      connect,
      disconnect,
      discover,
      output,
      terminalLines,
      clearTerminal,
      telemetry,
      programState,
      robotUrl,
      runCode,
      runInteractiveAction,
      sendRcDrive,
      runRcAction,
      setRobotUrl,
      setTarget,
      status,
      statusMessage,
      stop,
      target,
    ],
  );

  return (
    <RobotConnectionContext.Provider value={value}>{children}</RobotConnectionContext.Provider>
  );
};

export const useRobotConnection = (): RobotConnectionContextValue => {
  const context = useContext(RobotConnectionContext);
  if (!context) {
    throw new Error('useRobotConnection must be used inside RobotConnectionProvider.');
  }
  return context;
};
