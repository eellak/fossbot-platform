const COMMANDS_JSON = {
  "kind": "commands",
  "contents": [
    {
      "kind": "category",
      "name": "Movement",
      "contents": [
        {
          "kind": "command",
          "name": "Just Move",
          "description": "Moves in the specified direction. Param: direction='forward' or 'backward'",
          "command": "robot.just_move()"
        },
        {
          "kind": "command",
          "name": "Move One Step",
          "description": "Moves the robot for one step in the specified direction. Param: direction='forward' or 'backward'",
          "command": "robot.move_step()"
        },
        {
          "kind": "command",
          "name": "Move Forward Distance",
          "description": "Moves forward a specified distance in centimetres. Param: distance=<number>",
          "command": "robot.move_forward_distance()"
        },
        {
          "kind": "command",
          "name": "Move Reverse Distance",
          "description": "Moves backward a specified distance in centimetres. Param: distance=<number>",
          "command": "robot.move_reverse_distance()"
        },
        {
          "kind": "command",
          "name": "Stop Moving",
          "description": "Robot stops moving",
          "command": "robot.stop()"
        },
        {
          "kind": "command",
          "name": "Rotate 90",
          "description": "Rotates 90 degrees. Param: direction='left' or 'right'",
          "command": "robot.rotate_90()"
        },
        {
          "kind": "command",
          "name": "Rotate 45",
          "description": "Rotates 45 degrees. Param: direction='left' or 'right'",
          "command": "robot.rotate_45()"
        },
        {
          "kind": "command",
          "name": "Rotate Degrees",
          "description": "Rotates by degrees. Params: degrees=<number>, clockwise=True or False",
          "command": "robot.rotate_degrees()"
        },
        {
          "kind": "command",
          "name": "Rotate Clockwise",
          "description": "Starts clockwise rotation; call robot.stop() to stop",
          "command": "robot.rotate_clockwise()"
        },
        {
          "kind": "command",
          "name": "Rotate Counterclockwise",
          "description": "Starts counterclockwise rotation; call robot.stop() to stop",
          "command": "robot.rotate_counterclockwise()"
        },
        {
          "kind": "command",
          "name": "Just Rotate",
          "description": "Rotates in the specified direction. Param: direction='left' or 'right'",
          "command": "robot.just_rotate()"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Sensors",
      "contents": [
        {
          "kind": "command",
          "name": "Get Obstacle Distance",
          "description": "Gets the front obstacle distance in centimetres (simulator maximum: 300 cm)",
          "command": "robot.get_distance()"
        },
        {
          "kind": "command",
          "name": "Get Acceleration",
          "description": "Gets the current acceleration. Param: axis='x', 'y', or 'z'",
          "command": "robot.get_acceleration()"
        },
        {
          "kind": "command",
          "name": "Get Light Sensor",
          "description": "Gets the current light sensor value",
          "command": "robot.get_light_sensor()"
        },
        {
          "kind": "command",
          "name": "Get Gyroscope",
          "description": "Gets the current gyroscope value. Param: axis='x', 'y', or 'z'",
          "command": "robot.get_gyroscope()"
        },
        {
          "kind": "command",
          "name": "Get Floor Sensor",
          "description": "Gets the current floor sensor value. Param: sensor_id=<number>",
          "command": "robot.get_floor_sensor()"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Interactions",
      "contents": [
        {
          "kind": "command",
          "name": "RGB Set Color",
          "description": "Sets the RGB color. Param: color=<string> ('red','green','blue','violet','white','off')",
          "command": "robot.rgb_set_color()"
        },
        {
          "kind": "command",
          "name": "Draw",
          "description": "Toggles drawing. Param: status=<boolean>",
          "command": "robot.draw()"
        }
      ]
    }
  ]
};

export default COMMANDS_JSON;
