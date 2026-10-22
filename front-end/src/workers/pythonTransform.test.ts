import { addAwaitToFunctionCalls, transformPythonForSimulator } from './pythonTransform';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('transformPythonForSimulator', () => {
  it('propagates async calls across adjacent function definitions', () => {
    const source = [
      'def search_step():',
      '    move_step("forward")',
      '    return False',
      '',
      'def main():',
      '    while True:',
      '        if search_step():',
      '            break',
      '',
      'main()',
    ].join('\n');

    const transformed = transformPythonForSimulator(source, ['move_step']);

    expect(transformed).toContain('async def search_step():');
    expect(transformed).toContain('    await move_step("forward")');
    expect(transformed).toContain('async def main():');
    expect(transformed).toContain('        if await search_step():');
    expect(transformed).toContain('\nawait main()');
    expect(transformed.split('\n')).toHaveLength(source.split('\n').length);
  });

  it('does not rewrite strings, comments, definitions, or object methods', () => {
    const source = [
      'def move_step(direction):',
      '    return direction',
      '# move_step("forward")',
      'message = "move_step(\\"forward\\")"',
      'robot.move_step("forward")',
      'move_step("forward")',
    ].join('\n');

    expect(addAwaitToFunctionCalls(source, ['move_step'])).toBe([
      'def move_step(direction):',
      '    return direction',
      '# move_step("forward")',
      'message = "move_step(\\"forward\\")"',
      'robot.move_step("forward")',
      'await move_step("forward")',
    ].join('\n'));
  });
});

it('awaits known robot methods and helper chains without changing other objects or explicit awaits', () => {
  const source = [
    'def read():', '    return robot.get_distance()',
    'def main():', '    print(read())', '    robot.move_forward_distance(20)', '    robot.stop()',
    'main()', 'await robot.stop()', 'other.robot.stop()', 'other.stop()',
    '# robot.stop()', 'text = "robot.get_distance()"',
  ].join('\n');
  const transformed = transformPythonForSimulator(source, [
    'robot.get_distance', 'robot.move_forward_distance', 'robot.stop',
  ]);
  expect(transformed).toContain('return await robot.get_distance()');
  expect(transformed).toContain('async def main():\n    print(await read())');
  expect(transformed).toContain('await robot.move_forward_distance(20)');
  expect(transformed).toContain('\nawait main()');
  expect(transformed).not.toContain('await await');
  expect(transformed).toContain('other.robot.stop()\nother.stop()');
  expect(transformed).toContain('# robot.stop()\ntext = "robot.get_distance()"');
  expect(transformed.split('\n')).toHaveLength(source.split('\n').length);
});

it('awaits detection results before indexing or calling dictionary methods', () => {
  const source = 'x = robot.get_detection("person")["center_x_ratio"]\ny = robot.get_detection("person").get("center_y_ratio")';
  expect(transformPythonForSimulator(source, ['robot.get_detection'])).toBe(
    'x = (await robot.get_detection("person"))["center_x_ratio"]\ny = (await robot.get_detection("person")).get("center_y_ratio")',
  );
});

it('awaits robot motor components while leaving other robots and strings unchanged', () => {
  const source = 'def steer():\n    robot.motor_left.set_speed(28)\n    robot.motor_right.move("reverse")\nsteer()\nother.motor_left.set_speed(28)\nother.robot.motor_left.set_speed(28)\ntext = "robot.motor_left.set_speed(28)"';
  const transformed = transformPythonForSimulator(source, ['robot.motor_left.set_speed', 'robot.motor_right.move']);
  expect(transformed).toContain('async def steer():\n    await robot.motor_left.set_speed(28)');
  expect(transformed).toContain('await robot.motor_right.move("reverse")');
  expect(transformed).toContain('\nawait steer()');
  expect(transformed).toContain('other.robot.motor_left.set_speed(28)');
  expect(transformed).toContain('text = "robot.motor_left.set_speed(28)"');
});
