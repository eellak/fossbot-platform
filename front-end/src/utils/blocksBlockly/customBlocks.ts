import * as Blockly from 'blockly/core';
import { pythonGenerator, Order } from 'blockly/python';

//MOVE DISTANCE # default forward, reverse
Blockly.Blocks['move_distance'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('Move distance')
      .appendField(
        new Blockly.FieldDropdown([
          ['forward', "'forward'"],
          ['reverse', "'reverse'"],
        ]),
        'option',
      ) 
      .appendField(new Blockly.FieldNumber(0, 0, 1000), 'distance')
      .appendField('cms')
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(
      'Moves to input direction (default == forward) a specified - input distance (cm). <br> Param: dist: the distance to be moved (in cm). direction: the direction to be moved towards.',
    );
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
      .appendField('Just move')
      .appendField(
        new Blockly.FieldDropdown([
          ['forward', "'forward'"],
          ['reverse', "'reverse'"],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(
      'Moves forwards/backwords <br> Param: direction: the direction to be headed to.',
    );
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
    this.appendDummyInput().appendField('Stop moving');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip('Robot stops moving');
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
      .appendField('Sleep')
      .appendField(new Blockly.FieldNumber(0, null, null), 'wait_s')
      .appendField('seconds');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(
      'sleeps for an amount of time. <br> Param: time_s: the time (seconds) of sleep.',
    );
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
          ['right', '1'],
          ['left', '0'],
        ]),
        'option',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(290);
    this.setTooltip(
      'Rotates fossbot towards the specified direction id. <br> Param: dir_id: the direction id to rotate to: <br> - counterclockwise: dir_id == 0 <br> - clockwise: dir_id == 1',
    );
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
      .appendField('Rotate 90 degrees')
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
      'Rotates fossbot 90 degrees towards the specified direction id. <br> Param: dir_id: the direction id to rotate 90 degrees: <br> - counterclockwise: dir_id == 0 <br> - clockwise: dir_id == 1',
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
      .appendField('Play sound')
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
      'Plays mp3 file specified by input audio_path. <br> Param: audio_path: the path to the mp3 file to be played.',
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
    this.appendDummyInput().appendField('Distance counter');
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip('Returns distance of nearest obstacle in cm.');
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
          ['Left sensor', '1'],
          ['Middle sensor', '2'],
          ['right_sensor', '3'],
        ]),
        'floor_sensor_option',
      )
      .appendField('Floor sensor');
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip('');
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
      .appendField('get_acceleration')
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
      'Gets acceleration of specified axis. <br> Param: axis: the axis to get the acceleration from. <br> Returns: the acceleration of specified axis.',
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
      .appendField('Get gyroscope')
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
      'Gets gyroscope of specified axis. <br> Param: axis: the axis to get the gyroscope from. <br> Returns: the gyroscope of specified axis.',
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
      .appendField('Set')
      .appendField(
        new Blockly.FieldDropdown([
          ["'red'", "'red'"],
          ["'green'", "'green'"],
          ["'blue'", "'blue'"],
          ["'white'", "'white'"],
          ["'violet'", "'violet'"],
          ["'cyan'", "'cyan'"],
          ["'yellow'", "'yellow'"],
          ["'closed'", "'closed'"],
        ]),
        'color_option',
      )
      .appendField('color');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(135);
    this.setTooltip('Sets led to input color. <br> Param: color: the wanted color.');
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
    this.appendDummyInput().appendField('Get light sensor');
    this.setOutput(true, 'Number');
    this.setColour(45);
    this.setTooltip('Returns the reading of the light sensor.');
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
    this.appendDummyInput().appendField('Get noise detection');
    this.setOutput(true, 'Boolean');
    this.setColour(45);
    this.setTooltip('Returns True only if noise is detected.');
    this.setHelpUrl('');
  },
};

pythonGenerator.forBlock['noise_detection'] = function (block) {
  var code = 'await robot.get_noise_detection()';
  return [code, Order.NONE];
};
