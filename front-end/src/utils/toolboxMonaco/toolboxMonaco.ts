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
          "command": "just_move()"
        },
        {
          "kind": "command",
          "name": "Move Forward Distance",
          "description": "Moves forward a specified distance. Param: distance=<number>",
          "command": "move_forward_distance()"
        },
        {
          "kind": "command",
          "name": "Move Reverse Distance",
          "description": "Moves backward a specified distance. Param: distance=<number>",
          "command": "move_reverse_distance()"
        },
        {
          "kind": "command",
          "name": "Stop Moving",
          "description": "Robot stops moving",
          "command": "stop()"
        },
        {
          "kind": "command",
          "name": "Rotate 90",
          "description": "Rotates 90 degrees. Param: direction='left' or 'right'",
          "command": "rotate_90()"
        },
        {
          "kind": "command",
          "name": "Rotate 45",
          "description": "Rotates 45 degrees. Param: direction='left' or 'right'",
          "command": "rotate_45()"
        },
        {
          "kind": "command",
          "name": "Rotate Degrees",
          "description": "Rotates a specified angle in degrees. Param: angle=<number>",
          "command": "rotate_degrees()"
        },
        {
          "kind": "command",
          "name": "Rotate Clockwise",
          "description": "Rotates 1 degree clockwise",
          "command": "rotate_clockwise()"
        },
        {
          "kind": "command",
          "name": "Rotate Counterclockwise",
          "description": "Rotates 1 degree counterclockwise",
          "command": "rotate_counterclockwise()"
        },
        {
          "kind": "command",
          "name": "Just Rotate",
          "description": "Rotates in the specified direction. Param: direction='left' or 'right'",
          "command": "just_rotate()"
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
          "description": "Gets the closest obstacle distance in front of the robot (returns 3 if no obstacle)",
          "command": "get_obstacle_distance()"
        },
        {
          "kind": "command",
          "name": "Get Acceleration",
          "description": "Gets the current acceleration. Param: axis='x', 'y', or 'z'",
          "command": "get_acceleration()"
        },
        {
          "kind": "command",
          "name": "Get Light Sensor",
          "description": "Gets the current light sensor value",
          "command": "get_light_sensor()"
        },
        {
          "kind": "command",
          "name": "Get Gyroscope",
          "description": "Gets the current gyroscope value. Param: axis='x', 'y', or 'z'",
          "command": "get_gyroscope()"
        },
        {
          "kind": "command",
          "name": "Get Floor Sensor",
          "description": "Gets the current floor sensor value. Param: sensor_id=<number>",
          "command": "get_floor_sensor()"
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
          "command": "rgb_set_color()"
        },
        {
          "kind": "command",
          "name": "Draw",
          "description": "Toggles drawing. Param: status=<boolean>",
          "command": "draw()"
        }
      ]
    }
  ]
};

export default COMMANDS_JSON;
