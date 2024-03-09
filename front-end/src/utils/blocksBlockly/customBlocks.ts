import * as Blockly from 'blockly/core';
import { pythonGenerator, Order } from 'blockly/python';
import i18n from '../i18n'


//MOVE DISTANCE # default forward, reverse
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
      .appendField(new Blockly.FieldNumber(0, 0, 1000), 'distance')
      .appendField('cms');
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
  var code = 'await robot.move_distance(' + distance_value + ',' + input_value + ')\n';
  return code;
};

//JUST MOVE
//TODO: ADD PARAMETERS: forward or reverse
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
  var code = 'await robot.just_move(' + input_value + ')\n';
  return code;
};

// STOP  ok
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
  var code = 'await robot.stop()\n';
  return code;
};

// SLEEP
Blockly.Blocks['sleep'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.sleep'))
      .appendField(new Blockly.FieldNumber(0, null, null), 'wait_s')
      .appendField('seconds');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(i18n.t('blocklyBlocks.sleepTooltip') );
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['sleep'] = function (block) {
  var input_value = block.getFieldValue('wait_s');
  return 'time.sleep(' + input_value + ')\n';
};

// TURN RIGHT / CLOCKWISE
//0:
//1: rght
Blockly.Blocks['just_rotate'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('Just rotate')
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.right'), '1'],
          [i18n.t('blocklyBlocks.left'), '0'],
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
  var code = 'await robot.just_rotate(' + input_value + ')\n';
  return code;
};

// ROTATE 90
Blockly.Blocks['rotate_90'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.rotate9Degrees'))
      .appendField(
        new Blockly.FieldDropdown([
          ['right', '1'],
          ['left', '0'],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(
      i18n.t('blocklyBlocks.rotate9DegreesTooltip')
    );
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['rotate_90'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = 'await robot.rotate_90(' + input_value + ')\n';
  return code;
};

//PLAY SOUND
Blockly.Blocks['play_sound'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.playSound'))
      .appendField(
        new Blockly.FieldDropdown([
          ['empodio', "'res://soundfx/empodio.mp3'"],
          ['euxaristw', "'res://soundfx/euxaristw.mp3'"],
          ['geia', "'res://soundfx/geia.mp3'"],
          ['kalhmera', "'res://soundfx/kalhmera.mp3'"],
          ['machine_gun', "'res://soundfx/machine_gun.mp3'"],
          ['mpravo', "'res://soundfx/mpravo.mp3'"],
          ['processing', "'res://soundfx/processing.mp3'"],
          ['r2d2', "'res://soundfx/r2d2.mp3'"],
          ['startup', "'res://soundfx/startup.mp3'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(135);
    this.setTooltip(
      i18n.t('blocklyBlocks.playSoundTooltip')
    );
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['play_sound'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = 'await robot.play_sound(' + input_value + ')\n';
  return code;
};

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
  var code = 'await robot.get_distance()';
  return [code, Order.NONE];
};

//GET FLOOR SENSOR
Blockly.Blocks['floor_sensor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.leftSensor'), '1'],
          [i18n.t('blocklyBlocks.middleSensor'), '2'],
          [i18n.t('blocklyBlocks.rightSensor'), '3'],
        ]),
        'floor_sensor_option',
      )
      .appendField(i18n.t('blocklyBlocks.floorSensor'));
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.floorSensorTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['floor_sensor'] = function (block) {
  var input_value = block.getFieldValue('floor_sensor_option');
  var code = 'await robot.get_floor_sensor(' + input_value + ')';
  return [code, Order.NONE];
};

//GET ACCELERATION
Blockly.Blocks['get_acceleration'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(i18n.t('blocklyBlocks.getAcceleration'))
      .appendField(
        new Blockly.FieldDropdown([
          ['χ', 'x'],
          ['ψ', 'y'],
          ['ζ', 'z'],
        ]),
        'option',
      );
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(
      i18n.t('blocklyBlocks.getAccelerationTooltip')
    );
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['get_acceleration'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = 'await robot.get_acceleration("' + input_value + '")';
  return [code, Order.NONE];
};

//GET GYROSCOPE
Blockly.Blocks['get_gyroscope'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(      i18n.t('blocklyBlocks.getGyroscope')
      )
      .appendField(
        new Blockly.FieldDropdown([
          ['χ', 'x'],
          ['ψ', 'y'],
          ['ζ', 'z'],
        ]),
        'option',
      );
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(
      i18n.t('blocklyBlocks.getGyroscopeTooltip')
    );
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['get_gyroscope'] = function (block) {
  var input_value = block.getFieldValue('option');
  var code = 'await robot.get_gyro("' + input_value + '")';
  return [code, Order.NONE];
};

//SET COLOR ok
Blockly.Blocks['set_color'] = {
  init: function () {
    this.appendDummyInput()
      .appendField( i18n.t('blocklyBlocks.set'))
      .appendField(
        new Blockly.FieldDropdown([
          [i18n.t('blocklyBlocks.red'), "'red'"],
          [i18n.t('blocklyBlocks.green'), "'green'"],
          [i18n.t('blocklyBlocks.blue'), "'blue'"],
          [i18n.t('blocklyBlocks.white'), "'white'"],
          [i18n.t('blocklyBlocks.violet'), "'violet'"],
          [i18n.t('blocklyBlocks.cyan'), "'cyan'"],
          [i18n.t('blocklyBlocks.yellow'), "'yellow'"],
          [i18n.t('blocklyBlocks.closed'), "'closed'"],
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
  return 'await robot.rgb_set_color(' + input_value + ')\n';
};

// LIGHT SENSOR
Blockly.Blocks['light_sensor'] = {
  init: function () {
    this.appendDummyInput().appendField(i18n.t('blocklyBlocks.lighSensor'));
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.lighSensorTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['light_sensor'] = function (block) {
  var code = 'await robot.get_light_sensor()';
  return [code, Order.NONE];
};

// NOISE DETECTION
Blockly.Blocks['noise_detection'] = {
  init: function () {
    this.appendDummyInput().appendField(i18n.t('blocklyBlocks.noiseDetection'));
    this.setOutput(true, 'Boolean');
    this.setColour(45);
    this.setTooltip(i18n.t('blocklyBlocks.noiseDetectionTooltip'));
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['noise_detection'] = function (block) {
  var code = 'await robot.get_noise_detection()';
  return [code, Order.NONE];
};
