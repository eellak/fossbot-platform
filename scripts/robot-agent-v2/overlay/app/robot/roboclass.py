import socketio
import signal
import contextlib
import io
import subprocess
import traceback
from fossbot_lib.parameters_parser.parser import load_parameters
from fossbot_lib.common.data_structures import configuration
from fossbot_lib.common.interfaces import robot_interface
from blockly_server.config import Config

from blockly_server.app.robot.hardware_broker import HardwareBrokerClient

MOTOR_OUTPUT_PINS = (12, 13, 5, 0, 19, 26)


def hold_motor_outputs_low():
    """Keep both motor enable and direction pins low after GPIO cleanup."""
    for pin in MOTOR_OUTPUT_PINS:
        subprocess.run(
            ['sudo', '-n', '/usr/bin/raspi-gpio', 'set', str(pin), 'op', 'dl'],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


class Communication():
    def __init__(self, namespace='/test', program_id=None):
        self.namespace = namespace
        self.program_id = program_id
        self.sio = socketio.Client()
        self.sio.connect(f'http://{Config.BROWSER_HOST}:{Config.PORT}')
        self.start_event_handlers()

    def start_event_handlers(self):
        self.sio.on('connect', self.connect, namespace=self.namespace)
        self.sio.on('connect_error', self.connect_error, namespace=self.namespace)
        self.sio.on('disconnect', self.disconnect, namespace=self.namespace)

    def transmit(self, message, stream='stdout'):
        self.sio.emit('terminal_msgs', {
            'data': message,
            'programId': self.program_id,
            'stream': stream,
        })

    def connect(self):
        print("I'm connected!")

    def connect_error(self,data):
        print("The connection failed!")

    def disconnect(self):
        print("I'm disconnected!")


class SocketWriter(io.TextIOBase):
    def __init__(self, communication, stream):
        self.communication = communication
        self.stream = stream
        self.buffer = ''

    def write(self, value):
        self.buffer += str(value)
        while '\n' in self.buffer:
            line, self.buffer = self.buffer.split('\n', 1)
            if line:
                self.communication.transmit(line, self.stream)
        return len(value)

    def flush(self):
        if self.buffer:
            self.communication.transmit(self.buffer, self.stream)
            self.buffer = ''


class Agent():
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Agent, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        self.parameters = None

    def load_parameters(self):
        file_params = load_parameters(path=Config.ADMIN_PARAMS)
        common_params = {
            "sensor_distance": configuration.SensorDistance(**file_params["sensor_distance"]),
            "motor_left_speed": configuration.MotorLeftSpeed(**file_params["motor_left"]),
            "motor_right_speed": configuration.MotorRightSpeed(**file_params["motor_right"]),
            "default_step": configuration.DefaultStep(**file_params["step"]),
            "light_sensor": configuration.LightSensor(**file_params["light_sensor"]),
            "line_sensor_left": configuration.LineSensorLeft(**file_params["line_sensor_left"]),
            "line_sensor_center": configuration.LineSensorCenter(**file_params["line_sensor_center"]),
            "line_sensor_right": configuration.LineSensorRight(**file_params["line_sensor_right"]),
            "rotate_90": configuration.Rotate90(**file_params["rotate_90"])
        }

        return configuration.RobotParameters(**common_params)


    def execute(self, code, program_id=None):
        robot = None
        previous_sigterm_handler = signal.getsignal(signal.SIGTERM)

        def stop_script(signum, frame):
            print('[safety] Stop signal received by robot script.', flush=True)
            raise SystemExit(0)

        signal.signal(signal.SIGTERM, stop_script)
        try:
            robot = HardwareBrokerClient().robot
            param = load_parameters(path=Config.ADMIN_PARAMS)
            robot.rgb_led.anode = param['rgb_led_type']["value"]
            coms = Communication(program_id=program_id)
            transmit = coms.transmit
            stdout_writer = SocketWriter(coms, 'stdout')
            stderr_writer = SocketWriter(coms, 'stderr')
            with contextlib.redirect_stdout(stdout_writer), contextlib.redirect_stderr(stderr_writer):
                try:
                    exec(code)
                except Exception:
                    traceback.print_exc(file=stderr_writer)
                    raise
                finally:
                    stdout_writer.flush()
                    stderr_writer.flush()
        finally:
            if robot is not None:
                try:
                    robot.stop()
                    print('[safety] Motors stopped.', flush=True)
                except Exception as stop_error:
                    print(f'[safety] robot.stop failed: {stop_error}', flush=True)
            # The broker owns GPIO and the OLED for the lifetime of the service;
            # the worker must never call robot.exit() or clean global GPIO.
            signal.signal(signal.SIGTERM, previous_sigterm_handler)

    def stop(self):
        hold_motor_outputs_low()


if __name__ == '__main__':
    a = Agent()
    a.execute('print("hello")')
    a.reset()
