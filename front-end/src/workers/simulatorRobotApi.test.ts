import { SIMULATOR_BRIDGE_FUNCTIONS, SIMULATOR_ROBOT_API, SIMULATOR_ROBOT_METHODS } from './simulatorRobotApi';
import { transformPythonForSimulator } from './pythonTransform';

declare const it: any, expect: any, require: any;
const { spawnSync } = require('child_process');

it('executes robot methods and legacy Blockly calls with their respective units and directions', () => {
  const program = transformPythonForSimulator(`
def distance():
    return robot.get_distance()
assert distance() == 42
assert robot.get_detection('PERSON', min_confidence=0.8, max_age=0.8)['center_x_ratio'] == 0.375
assert robot.get_detection('cat') is None
assert robot.get_detection('person', min_confidence=1.1) is None
assert isinstance(robot.get_detections(), list)
assert robot.get_road_detection(black_threshold=110)['center_error'] == 0.1
assert robot.get_depth()['regions']['center_m'] == 2.5
assert robot.get_aruco_marker(7)['id'] == 7
assert robot.get_aruco_marker(99) is None
assert len(robot.get_aruco_markers()) == 1
assert robot.get_obstacle_distance() == 42
assert get_obstacle_distance() == 0.42
assert get_distance() == 0.42
assert not robot.check_for_obstacle()
robot.move_forward_distance(distance=20)
robot.move_reverse_default()
robot.move_reverse()
robot.just_move('reverse')
robot.rotate_degrees(45, clockwise=False, speed=25)
robot.rotate_clockwise_90()
robot.rotate_counterclockwise()
robot.wait(0)
move_step('forward')
rotate_90('left')
robot.rgb_set_color(color='green')
stop()
robot.stop()
robot.motor_left.set_speed(speed=28)
robot.motor_right.set_speed(30)
robot.move_forward()
robot.motor_left.set_speed(32)
robot.motor_right.move('reverse')
robot.motor_left.stop()
robot.stop()
robot.motor_left.set_speed(70)
assert robot.motor_left.dc_value == 70
try:
    robot.motor_right.set_speed(101)
    assert False, 'Invalid speed was accepted'
except ValueError:
    pass
`, [...SIMULATOR_BRIDGE_FUNCTIONS, ...SIMULATOR_ROBOT_METHODS.map((name) => `robot.${name}`)]);
  const fixture = `
import asyncio, ast, json
calls = []
def bridge(name):
    async def call(*args):
        calls.append([name, list(args)])
        return 0.42 if name in ('get_distance', 'get_obstacle_distance') else None
    return call
namespace = {name: bridge(name) for name in ${JSON.stringify(SIMULATOR_BRIDGE_FUNCTIONS)}}
async def camera(max_age):
    return json.dumps([{'label': 'person', 'confidence': 1, 'center_x_ratio': 0.375}])
namespace['_get_camera_detections'] = camera
async def vision(mode, max_age, threshold):
    assert max_age > 0
    if mode == 'road':
        assert threshold == 110
        return json.dumps({'center_error': 0.1})
    if mode == 'depth': return json.dumps({'regions': {'center_m': 2.5}})
    return json.dumps([{'id': 7}])
namespace['_get_camera_vision'] = vision
namespace['_drive_motors'] = bridge('_drive_motors')
exec(${JSON.stringify(SIMULATOR_ROBOT_API)}, namespace)
asyncio.run(eval(compile(${JSON.stringify(program)}, '<exec>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), namespace))
print(json.dumps(calls))
`;
  const result = spawnSync('python3', ['-'], { input: fixture, encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  const calls = JSON.parse(result.stdout);
  expect(calls).toEqual(expect.arrayContaining([
    ['move_forward_distance', [20]], ['move_reverse_distance', [30]],
    ['_drive_motors', [-0.4, -0.4]], ['rotate_degrees', [45]], ['rotate_degrees', [-90]],
    ['_drive_motors', [-0.4, 0.4]], ['move_step', ['forward']], ['rotate_90', ['left']],
    ['rgb_set_color', ['green']], ['stop', []],
  ]));
  expect(calls.filter(([name]: [string]) => name === 'stop')).toHaveLength(3);
  const drives = calls.filter(([name]: [string]) => name === '_drive_motors');
  expect(drives.slice(-4)).toEqual([
    ['_drive_motors', [0.28, 0.3]], ['_drive_motors', [0.32, 0.3]],
    ['_drive_motors', [0.32, -0.3]], ['_drive_motors', [0, -0.3]],
  ]);
  expect(drives).toHaveLength(7);
});
