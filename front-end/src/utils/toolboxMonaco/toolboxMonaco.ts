const COMMANDS_JSON = {
  kind: 'commands',
  contents: [
    {
      kind: 'category',
      name: 'Movement',
      contents: [
        {
          kind: 'command',
          name: 'Just Move',
          description:
            'Moves forwards/backwords <br> Param: direction: the direction to be headed to.',
          command: 'robot.just_move() ',
        },
        {
          kind: 'command',
          name: 'Move Distance',
          description:
            'Moves to input direction (default == forward) a specified - input distance (cm). <br> Param: dist: the distance to be moved (in cm). direction: the direction to be moved towards.',
          command: 'robot.move_distance() ',
        },
        {
          kind: 'command',
          name: 'Reset Direction',
          description: 'Resets all motors direction to default (forward).',
          command: 'robot.reset_dir() ',
        },
        {
          kind: 'command',
          name: 'Stop Moving',
          description: 'Robot stops moving',
          command: 'robot.stop() ',
        },
        {
          kind: 'command',
          name: 'Wait(sleep)',
          description:
            'Wait (sleeps) for an amount of time. <br> Param: time_s: the time (seconds) of sleep.',
          command: 'robot.wait() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Moving Forward',
      contents: [
        {
          kind: 'command',
          name: 'Move forward distance',
          description:
            'Moves robot forward input distance. <br> Param: dist: the distance (cm) to be moved by robot.',
          command: 'robot.move_forward_distance() ',
        },
        {
          kind: 'command',
          name: 'Move forward default',
          description: 'Moves robot forward default distance.',
          command: 'robot.default() ',
        },
        {
          kind: 'command',
          name: 'Move forward',
          description: 'Moves robot forward.',
          command: 'robot.move_forward() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Moving Reverse',
      contents: [
        {
          kind: 'command',
          name: 'Move reverse distance',
          description:
            'Moves robot input distance in reverse. <br> Param: dist: the distance (cm) to be moved by robot.',
          command: 'robot.move_reverse_distance() ',
        },
        {
          kind: 'command',
          name: 'Move reverse default',
          description: 'Moves robot default distance in reverse.',
          command: 'robot.move_reverse_default() ',
        },
        {
          kind: 'command',
          name: 'Move reverse',
          description: 'Moves robot in reverse.',
          command: 'robot.move_reverse() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Rotation',
      contents: [
        {
          kind: 'command',
          name: 'Just rotate',
          description:
            'Rotates fossbot towards the specified direction id. <br> Param: dir_id: the direction id to rotate to: <br> - counterclockwise: dir_id == 0 <br> - clockwise: dir_id == 1',
          command: 'robot.just_rotate() ',
        },
        {
          kind: 'command',
          name: 'Rotate 90 degrees',
          description:
            'Rotates fossbot 90 degrees towards the specified direction id. <br> Param: dir_id: the direction id to rotate 90 degrees: <br> - counterclockwise: dir_id == 0 <br> - clockwise: dir_id == 1',
          command: 'robot.rotate_90() ',
        },
        {
          kind: 'command',
          name: 'Rotate clockwise',
          description: 'Rotates fossbot clockwise.',
          command: 'robot.rotate_clockwise() ',
        },
        {
          kind: 'command',
          name: 'Rotate counterclockwise',
          description: 'Rotates fossbot counterclockwise.',
          command: 'robot.rotate_counterclockwise() ',
        },
        {
          kind: 'command',
          name: 'Rotate clockwise 90 degrees',
          description: 'Rotates fossbot 90 degrees clockwise.',
          command: 'robot.rotate_clockwise_90() ',
        },
        {
          kind: 'command',
          name: 'Rotate counterclockwise 90 degrees',
          description: 'Rotates fossbot 90 degrees counterclockwise.',
          command: 'robot.rotate_counterclockwise_90() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Ultrasonic Sensor',
      contents: [
        {
          kind: 'command',
          name: 'Distance counter',
          description: 'Returns distance of nearest obstacle in cm.',
          command: 'robot.get_distance() ',
        },
        {
          kind: 'command',
          name: 'Check for obstacle',
          description: 'Returns True only if an obstacle is detected.',
          command: 'robot.check_for_obstacle() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Sound',
      contents: [
        {
          kind: 'command',
          name: 'Play sound',
          description:
            'Plays mp3 file specified by input audio_path. <br> Param: audio_path: the path to the mp3 file to be played.',
          command: 'robot.play_sound() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Floor Sensors',
      contents: [
        {
          kind: 'command',
          name: 'Get reading of floor - line sensor',
          description:
            'Gets reading of a floor - line sensor specified by sensor_id. <br> Param: sensor_id: the id of the wanted floor - line sensor. <br> Returns: the reading of input floor - line sensor.',
          command: 'robot.get_floor_sensor() ',
        },
        {
          kind: 'command',
          name: 'Check if on black line',
          description:
            'Checks if line sensor (specified by sensor_id) is on black line. <br> Param: sensor_id: the id of the wanted floor - line sensor. <br> Returns: True if sensor is on line, else False.',
          command: 'robot.get_floor_sensor() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Accelerometer',
      contents: [
        {
          kind: 'command',
          name: 'Get acceleration',
          description:
            'Gets acceleration of specified axis. <br> Param: axis: the axis to get the acceleration from. <br> Returns: the acceleration of specified axis.',
          command: 'robot.get_acceleration() ',
        },
        {
          kind: 'command',
          name: 'Get gyroscope',
          description:
            'Gets gyroscope of specified axis. <br> Param: axis: the axis to get the gyroscope from. <br> Returns: the gyroscope of specified axis.',
          command: 'robot.get_gyroscope() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'RGB',
      contents: [
        {
          kind: 'command',
          name: 'Set RGB color',
          description: 'Sets led to input color. <br> Param: color: the wanted color.',
          command: 'robot.rgb_set_color() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Light Sensor',
      contents: [
        {
          kind: 'command',
          name: 'Get light sensor',
          description: 'Returns the reading of the light sensor.',
          command: 'robot.get_light_sensor() ',
        },
        {
          kind: 'command',
          name: 'Check if dark',
          description: 'Returns True only if light sensor detects dark.',
          command: 'robot.check_for_dark() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Noise Detection',
      contents: [
        {
          kind: 'command',
          name: 'Get noise detection',
          description: 'Returns True only if noise is detected.',
          command: 'robot.get_noise_detection() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Exit',
      contents: [
        {
          kind: 'command',
          name: 'Exit',
          description: 'Exits.',
          command: 'robot.exit() ',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Timer',
      contents: [
        {
          kind: 'command',
          name: 'Stop timer',
          description: 'Stops the timer.',
          command: 'robot.stop_timer() ',
        },
        {
          kind: 'command',
          name: 'Start timer',
          description: 'Starts the timer.',
          command: 'robot.start_timer() ',
        },
        {
          kind: 'command',
          name: 'Time from start',
          description: 'Returns the time from start.',
          command: 'robot.get_elapsed() ',
        },
      ],
    },
  ],
};

export default COMMANDS_JSON;
