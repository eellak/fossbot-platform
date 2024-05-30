import * as Blockly from 'blockly/core';
import { pythonGenerator, Order } from 'blockly/python';
import i18n from '../i18n';

// MOVE DISTANCE # default forward, reverse
Blockly.Blocks['move_distance'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.moveDistance'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.forward'), "'forward'"],
          [i18n.t('blocklyBlocks.reverse'), "'reverse'"],
        ]),
        'option',
      )
      .appendField(new Blockly.FieldNumber(0, 0, 1000), 'distance');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.moveDistanceTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['move_distance'] = function (block) {
  var input_value = block.getFieldValue('option');
  var distance_value = block.getFieldValue('distance');
  var code = `${input_value === "'forward'" ? 'move_forward_distance' : 'move_reverse_distance'}(${distance_value})\n`;
  return code;
};

// JUST MOVE
Blockly.Blocks['just_move'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.justMove'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.forward'), "'forward'"],
          [i18n.t('blocklyBlocks.reverse'), "'reverse'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.justMoveTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['just_move'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `just_move(${input_value})\n`;
  return code;
};


// move_step
Blockly.Blocks['move_step'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.move_step'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.forward'), "'forward'"],
          [i18n.t('blocklyBlocks.reverse'), "'reverse'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.move_step_description'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['move_step'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `${input_value === "'forward'" ? 'move_forward_distance(-0.4)' : 'move_reverse_distance(0.4)'}\n`;
  return code;
};

// STOP
Blockly.Blocks['stop'] = {
  init: function () {
    this.appendDummyInput().appendField(i18n.t('blocklyBlocks.stopMoving'));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.stopMovingTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['stop'] = function (block) {
  var code = 'stop()\n';
  return code;
};

// SLEEP
Blockly.Blocks['sleep'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.sleep'))
      .appendField(new Blockly.FieldNumber(0, 0, 1000), 'wait_s')
      .appendField('seconds');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.sleepTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['sleep'] = function (block) {
  var input_value = block.getFieldValue('wait_s');
  return `time.sleep(${input_value})\n`;
};

// TURN RIGHT / CLOCKWISE
Blockly.Blocks['just_rotate'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.justRotate'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.right'), "'right'"],
          [i18n.t('blocklyBlocks.left'), "'left'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.justRotateTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['just_rotate'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `just_rotate(${input_value})\n`;
  return code;
};

// ROTATE 90
Blockly.Blocks['rotate_90'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.rotate90Degrees'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.right'), "'right'"],
          [i18n.t('blocklyBlocks.left'), "'left'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.rotate90DegreesTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['rotate_90'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `rotate_90(${input_value})\n`;
  return code;
};


// ROTATE 45
Blockly.Blocks['rotate_45'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.rotate45Degrees'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.right'), "'right'"],
          [i18n.t('blocklyBlocks.left'), "'left'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.rotate45DegreesTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['rotate_45'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `rotate_45(${input_value})\n`;
  return code;
};

// // PLAY SOUND
// Blockly.Blocks['play_sound'] = {
//   init: function () {
//     this.appendDummyInput()
//       .appendField(i18n.t('blocklyBlocks.playSound'))
//       .appendField(
//         new Blockly.FieldDropdown([
//           ['empodio', "'res://soundfx/empodio.mp3'"],
//           ['euxaristw', "'res://soundfx/euxaristw.mp3'"],
//           ['geia', "'res://soundfx/geia.mp3'"],
//           ['kalhmera', "'res://soundfx/kalhmera.mp3'"],
//           ['machine_gun', "'res://soundfx/machine_gun.mp3'"],
//           ['mpravo', "'res://soundfx/mpravo.mp3'"],
//           ['processing', "'res://soundfx/processing.mp3'"],
//           ['r2d2', "'res://soundfx/r2d2.mp3'"],
//           ['startup', "'res://soundfx/startup.mp3'"],
//         ]),
//         'option',
//       );
//     this.setPreviousStatement(true, null);
//     this.setNextStatement(true, null);
//     this.setColour(135);
//     this.setTooltip(i18n.t('blocklyBlocks.playSoundTooltip'));
//     this.setHelpUrl('');
//   },
// };

// pythonGenerator.forBlock['play_sound'] = function (block) {
//   var input_value = block.getFieldValue('option');
//   var code = `await robot.play_sound(${input_value})\n`;
//   return code;
// };

// DISTANCE
Blockly.Blocks['distance'] = {
  init: function () {
    this.appendDummyInput().appendField(i18n.t('blocklyBlocks.distance'));
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.distanceTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['distance'] = function (block) {
  var code = 'get_obstacle_distance()';
  return [code, Order.NONE];
};

// GET FLOOR SENSOR
Blockly.Blocks['floor_sensor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.floorSensor'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.leftSensor'), '0'],
          [i18n.t('blocklyBlocks.middleSensor'), '1'],
          [i18n.t('blocklyBlocks.rightSensor'), '2'],
        ]),
        'floor_sensor_option',
      );
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.floorSensorTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['floor_sensor'] = function (block) {
  var input_value = block.getFieldValue('floor_sensor_option');
  var code = `get_floor_sensor(${input_value})`;
  return [code, Order.NONE];
};

// GET ACCELERATION
Blockly.Blocks['get_acceleration'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.getAcceleration'))
      .appendField(
        new Blockly.FieldDropdown([
          ["x", "'x'"],
          ["y", "'y'"],
          ["z", "'z'"],
        ]),
        'option',
      );
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.getAccelerationTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['get_acceleration'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `get_acceleration(${input_value})`;
  return [code, Order.NONE];
};

// GET GYROSCOPE
Blockly.Blocks['get_gyroscope'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.getGyroscope'))
      .appendField(
        new Blockly.FieldDropdown([
          ["x", "'x'"],
          ["y", "'y'"],
          ["z", "'z'"],
        ]),
        'option',
      );
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.getGyroscopeTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['get_gyroscope'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `get_gyroscope(${input_value})`;
  return [code, Order.NONE];
};

// SET COLOR
Blockly.Blocks['set_color'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.set'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.red'), "'red'"],
          [i18n.t('blocklyBlocks.green'), "'green'"],
          [i18n.t('blocklyBlocks.blue'), "'blue'"],
          [i18n.t('blocklyBlocks.white'), "'white'"],
          [i18n.t('blocklyBlocks.violet'), "'violet'"],
          // [i18n.t('blocklyBlocks.cyan'), "'cyan'"],
          // [i18n.t('blocklyBlocks.yellow'), "'yellow'"],
          [i18n.t('blocklyBlocks.closed'), "'off'"],
        ]),
        'color_option',
      )
      .appendField(i18n.t('blocklyBlocks.color'));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(135);
    this.setTooltip(i18n.t('blocklyBlocks.setColorTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['set_color'] = function (block) {
  var input_value = block.getFieldValue('color_option');
  return `rgb_set_color(${input_value})\n`;
};

// LIGHT SENSOR
Blockly.Blocks['light_sensor'] = {
  init: function () {
    this.appendDummyInput().appendField(i18n.t('blocklyBlocks.lightSensor'));
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.lightSensorTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['light_sensor'] = function (block) {
  var code = 'get_light_sensor()';
  return [code, Order.NONE];
};

// DRAW COMPONENT
Blockly.Blocks['draw'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.draw'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.true'), 'True'],
          [i18n.t('blocklyBlocks.false'), 'False'],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
    this.setTooltip(i18n.t('blocklyBlocks.drawTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['draw'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = `draw(${input_value})\n`;
  return code;
};

// // NOISE DETECTION
// Blockly.Blocks['noise_detection'] = {
//   init: function () {
//     this.appendDummyInput().appendField(i18n.t('blocklyBlocks.noiseDetection'));
//     this.setOutput(true, 'Boolean');
//     this.setColour(45);
//     this.setTooltip(i18n.t('blocklyBlocks.noiseDetectionTooltip'));
//     this.setHelpUrl('');
//   },
// };

// pythonGenerator.forBlock['noise_detection'] = function (block) {
//   var code = 'await robot.get_noise_detection()';
//   return [code, Order.NONE];
// };
