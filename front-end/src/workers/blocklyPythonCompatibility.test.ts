import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import '../utils/blocksBlockly/customBlocks';
import { transformPythonForSimulator } from './pythonTransform';
import { SIMULATOR_BRIDGE_FUNCTIONS, SIMULATOR_ROBOT_METHODS } from './simulatorRobotApi';
declare const it: any, expect: any, jest: any;
jest.mock('../utils/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

it('keeps actual Blockly movement and distance generation compatible with the simulator', () => {
  const workspace = new Blockly.Workspace();
  try {
    const move = workspace.newBlock('move_distance');
    move.setFieldValue('20', 'distance');
    const stop = workspace.newBlock('stop');
    move.nextConnection!.connect(stop.previousConnection!);
    const code = pythonGenerator.workspaceToCode(workspace);
    expect(code).toContain('move_forward_distance(20)');
    expect(code).toContain('stop()');
    const distance = workspace.newBlock('distance');
    pythonGenerator.init(workspace);
    expect(pythonGenerator.blockToCode(distance)).toEqual(['get_obstacle_distance()', expect.any(Number)]);
    const transformed = transformPythonForSimulator(code, [
      ...SIMULATOR_BRIDGE_FUNCTIONS, ...SIMULATOR_ROBOT_METHODS.map(name => `robot.${name}`),
    ]);
    expect(transformed).toContain('await move_forward_distance(20)');
    expect(transformed).toContain('await stop()');
  } finally { workspace.dispose(); }
});
