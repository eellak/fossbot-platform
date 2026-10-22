/** Keep legacy bridge names available for saved Blockly/Python programs. */
export const SIMULATOR_BRIDGE_FUNCTIONS = [
  'move_forward_distance', 'move_reverse_distance', 'rotate_90', 'rotate_45',
  'rotate_degrees', 'rotate_clockwise', 'rotate_counterclockwise',
  'get_obstacle_distance', 'get_distance', 'rgb_set_color', 'buzzer_beep', 'draw',
  'just_move', 'just_rotate', 'stop', 'get_acceleration', 'get_light_sensor',
  'get_gyroscope', 'get_floor_sensor', 'move_step',
];

export const SIMULATOR_ROBOT_METHODS = [
  ...SIMULATOR_BRIDGE_FUNCTIONS,
  'wait', 'move_forward', 'move_reverse', 'move_forward_default', 'move_reverse_default',
  'get_detection', 'get_detections', 'get_depth', 'get_road_detection', 'get_aruco_markers', 'get_aruco_marker',
  ...['motor_left', 'motor_right'].flatMap(side => ['set_speed', 'move', 'dir_control', 'stop'].map(method => `${side}.${method}`)),
  'rotate_clockwise_90', 'rotate_counterclockwise_90', 'check_for_obstacle',
];

const BRIDGE_PARAMETERS: Record<string, string> = {
  move_forward_distance: 'distance', move_reverse_distance: 'distance', move_step: 'direction',
  rotate_90: 'direction', rotate_45: 'direction', rotate_degrees: 'angle',
  rgb_set_color: 'color', buzzer_beep: 'frequencyHz, durationMs', draw: 'status',
  just_move: 'direction', just_rotate: 'direction', get_acceleration: 'axis',
  get_gyroscope: 'axis', get_floor_sensor: 'sensor_id',
};

// A Python facade supports keyword arguments and ordinary Python method lookup.
// Install separately from the submitted script to preserve editor line numbers.
export const SIMULATOR_ROBOT_API = `
import asyncio as _fossbot_asyncio
import json as _fossbot_json

class _SimulatorMotor:
    def __init__(self, robot):
        self._robot = robot
        self.dc_value = 40
        self._direction = 0

    async def set_speed(self, speed):
        speed = int(speed)
        if not 0 <= speed <= 100:
            raise ValueError('Motor speed must be between 0 and 100')
        self.dc_value = speed
        if self._robot.motor_left._direction or self._robot.motor_right._direction:
            await self._robot._drive()

    async def move(self, direction='forward'):
        if direction not in ('forward', 'reverse'):
            raise ValueError("Motor direction must be 'forward' or 'reverse'")
        self._direction = 1 if direction == 'forward' else -1
        await self._robot._drive()

    async def dir_control(self, direction):
        await self.move(direction)

    async def stop(self):
        self._direction = 0
        await self._robot._drive()

class _SimulatorRobot:
    def __init__(self):
        self.motor_left = _SimulatorMotor(self)
        self.motor_right = _SimulatorMotor(self)

    async def _drive(self):
        await _drive_motors(self.motor_left._direction * self.motor_left.dc_value / 100,
                            self.motor_right._direction * self.motor_right.dc_value / 100)

${SIMULATOR_BRIDGE_FUNCTIONS.map((name) => {
  const parameters = BRIDGE_PARAMETERS[name] || '';
  const call = `return await ${name}(${parameters})`;
  const body = ['move_forward_distance', 'move_reverse_distance', 'move_step', 'rotate_45'].includes(name)
    ? `try:\n            ${call}\n        finally:\n            self.motor_left._direction = self.motor_right._direction = 0`
    : call;
  return `    async def ${name}(self${parameters ? ', ' + parameters : ''}):\n        ${body}`;
}).join('\n\n')}

    async def get_detections(self, max_age=1.0):
        return _fossbot_json.loads(await _get_camera_detections(max_age))

    async def get_detection(self, label, min_confidence=0.0, max_age=1.0):
        wanted = str(label).strip().lower().replace('_', ' ').replace('-', ' ')
        matches = [detection for detection in await self.get_detections(max_age=max_age)
                   if str(detection.get('label', '')).strip().lower() == wanted
                   and float(detection.get('confidence', 0)) >= float(min_confidence)]
        return max(matches, key=lambda detection: detection['confidence'], default=None)

    async def get_depth(self, max_age=1.5):
        return _fossbot_json.loads(await _get_camera_vision('depth', max_age, None))

    async def get_road_detection(self, max_age=0.5, black_threshold=None):
        return _fossbot_json.loads(await _get_camera_vision('road', max_age, black_threshold))

    async def get_aruco_markers(self, max_age=0.5):
        return _fossbot_json.loads(await _get_camera_vision('aruco', max_age, None))

    async def get_aruco_marker(self, marker_id, max_age=0.5):
        wanted = int(marker_id)
        return next((marker for marker in await self.get_aruco_markers(max_age=max_age)
                     if int(marker.get('id', -1)) == wanted), None)

    async def get_distance(self):
        return (await get_distance()) * 100

    async def get_obstacle_distance(self):
        return await self.get_distance()

    async def check_for_obstacle(self):
        return (await self.get_distance()) <= 10

    async def wait(self, seconds):
        await _fossbot_asyncio.sleep(seconds)

    async def just_move(self, direction):
        if direction not in ('forward', 'reverse', 'backward'):
            raise ValueError("Direction must be 'forward' or 'reverse'")
        self.motor_left._direction = self.motor_right._direction = 1 if direction == 'forward' else -1
        await self._drive()

    async def stop(self):
        self.motor_left._direction = self.motor_right._direction = 0
        await stop()

    async def move_forward(self):
        await self.just_move('forward')

    async def move_reverse(self):
        await self.just_move('reverse')

    async def move_forward_default(self):
        await move_forward_distance(30)

    async def move_reverse_default(self):
        await move_reverse_distance(30)

    async def rotate_degrees(self, degrees, clockwise=True, speed=None):
        try:
            await rotate_degrees(-abs(degrees) if clockwise else abs(degrees))
        finally:
            self.motor_left._direction = self.motor_right._direction = 0

    async def rotate_90(self, direction):
        await self.rotate_degrees(90, clockwise=direction in (1, 'right'))

    async def just_rotate(self, direction):
        self.motor_left._direction = 1 if direction in (1, 'right') else -1
        self.motor_right._direction = -self.motor_left._direction
        await self._drive()

    async def rotate_clockwise(self):
        await self.just_rotate(1)

    async def rotate_counterclockwise(self):
        await self.just_rotate(0)

    async def rotate_clockwise_90(self):
        await self.rotate_degrees(90, clockwise=True)

    async def rotate_counterclockwise_90(self):
        await self.rotate_degrees(90, clockwise=False)

robot = _SimulatorRobot()
`;
