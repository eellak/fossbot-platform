import { definedFunctions, pythonSuggestions } from './pythonCompletion';
import { SIMULATOR_ROBOT_METHODS } from 'src/workers/simulatorRobotApi';

declare const describe: any;
declare const expect: any;
declare const it: any;

const labels = (receiver?: string) => pythonSuggestions(receiver).map((item) => item.label);

describe('pythonSuggestions', () => {
  it('offers every robot method as a global, except dotted motor members', () => {
    const globals = labels();
    SIMULATOR_ROBOT_METHODS.filter((name) => !name.includes('.')).forEach((name) => {
      expect(globals).toContain(name);
    });
    expect(globals).not.toContain('motor_left.set_speed');
  });

  it('completes robot members after the receiver', () => {
    expect(labels('robot')).toContain('move_forward');
    expect(labels('robot')).toContain('get_detection');
    expect(labels('robot')).not.toContain('if');
  });

  it('completes both motors with their own methods', () => {
    ['motor_left', 'motor_right'].forEach((motor) => {
      expect(labels(motor)).toEqual(['set_speed', 'move', 'dir_control', 'stop', 'dc_value']);
    });
  });

  it('turns bridge parameters into snippet placeholders', () => {
    const beep = pythonSuggestions().find((item) => item.label === 'buzzer_beep');
    expect(beep?.insertText).toBe('buzzer_beep(${1:frequencyHz}, ${2:durationMs})');
    expect(pythonSuggestions().find((item) => item.label === 'move_forward')?.insertText).toBe('move_forward()');
  });
});

describe('definedFunctions', () => {
  it('offers same-file defs with their parameters as placeholders', () => {
    const [greet] = definedFunctions('def greet(name, punct="!"):\n    print(name + punct)');
    expect(greet.label).toBe('greet');
    expect(greet.insertText).toBe('greet(${1:name}, ${2:punct})');
  });

  it('includes async defs and drops self', () => {
    const [drive] = definedFunctions('class Robot:\n  async def drive(self, speed):\n    pass');
    expect(drive.insertText).toBe('drive(${1:speed})');
  });

  it('ignores defs inside strings and comments, and dedupes redefinitions', () => {
    const found = definedFunctions('# def commented()\ntext = "def quoted()"\ndef real():\n  pass\ndef real(a):\n  pass');
    expect(found.map((item) => item.label)).toEqual(['real']);
    expect(found[0].insertText).toBe('real(${1:a})');
  });
});
