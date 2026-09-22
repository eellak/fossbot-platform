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
