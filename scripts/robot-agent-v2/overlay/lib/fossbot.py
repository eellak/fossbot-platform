"""Physical FOSSBot v2 using the pin map recovered from the deployed robot."""

import time

from fossbot_lib.real_robot.control import (
    Accelerometer, AnalogueReadings, Button, Buzzer, LedRGB, Motor, Odometer,
    Screen, Timer, UltrasonicSensor, clean, start_lib,
)


class FossBot:
    def __init__(self, _parameters=None) -> None:
        start_lib()
        self.motor_right = Motor(13, 5, 0, 40)
        self.motor_left = Motor(12, 19, 26, 40)
        self.ultrasonic = UltrasonicSensor(23, 24)
        self.odometer_right = Odometer(25)
        self.odometer_left = Odometer(1)
        self.rgb_led = LedRGB(16, 21, 20)
        self.analogue_reader = AnalogueReadings()
        self.accelerometer = Accelerometer()
        self.buzzer = Buzzer(22)
        self.timer = Timer()
        self.screen = Screen(1, 0x3C, 128, 64)
        self.bt1, self.bt2, self.bt3, self.bt4 = (
            Button(27), Button(17), Button(4), Button(14)
        )
        self._steps_per_360 = 45
        self._min_speed = 25

    def just_move(self, direction="forward"):
        self.odometer_left.reset()
        self.odometer_right.reset()
        self.motor_left.move(direction)
        self.motor_right.move(direction)

    def move_distance(self, dist, direction="forward"):
        target = abs(float(dist))
        self.just_move(direction)
        try:
            while self.odometer_right.get_distance() < target:
                time.sleep(0.01)
        finally:
            self.stop()

    def reset_dir(self):
        # stop() deliberately leaves both H-bridge direction pins low.
        pass

    def stop(self):
        self.motor_left.stop()
        self.motor_right.stop()

    def wait(self, seconds):
        time.sleep(seconds)

    def move_forward_distance(self, dist): self.move_distance(dist, "forward")
    def move_forward_default(self): self.move_distance(30, "forward")
    def move_forward(self): self.just_move("forward")
    def move_reverse_distance(self, dist): self.move_distance(dist, "reverse")
    def move_reverse_default(self): self.move_distance(30, "reverse")
    def move_reverse(self): self.just_move("reverse")

    def just_rotate(self, dir_id):
        self.odometer_left.reset()
        self.odometer_right.reset()
        self.motor_left.move("reverse" if dir_id == 0 else "forward")
        self.motor_right.move("reverse" if dir_id == 1 else "forward")

    def rotate_degrees(self, degrees, clockwise=True, speed=None):
        if speed is not None:
            self.motor_left.set_speed(speed)
            self.motor_right.set_speed(speed)
        target = int(round(abs(float(degrees)) * self._steps_per_360 / 360))
        self.just_rotate(1 if clockwise else 0)
        try:
            while self.odometer_right.get_steps() < target:
                time.sleep(0.005)
        finally:
            self.stop()

    def rotate_90(self, dir_id): self.rotate_degrees(90, dir_id == 1)
    def rotate_clockwise(self): self.just_rotate(1)
    def rotate_counterclockwise(self): self.just_rotate(0)
    def rotate_clockwise_90(self): self.rotate_degrees(90, True)
    def rotate_counterclockwise_90(self): self.rotate_degrees(90, False)

    def get_distance(self): return self.ultrasonic.get_distance()
    def check_for_obstacle(self): return self.get_distance() <= 10

    def play_sound(self, melody, duty=50, gap_s=0.03):
        self.buzzer.play(melody, duty=duty, gap_s=gap_s)

    def boot_up_sound(self):
        self.play_sound([(784, .12), (988, .12), (1175, .15), (0, .06), (1047, .3)])

    def get_floor_sensor(self, sensor_id):
        mapping = {1: (0, 7), 2: (1, 2), 3: (0, 6)}
        chip, pin = mapping[int(sensor_id)]
        return self.analogue_reader.get_reading(pin=pin, chip=chip)

    def check_on_line(self, sensor_id): return self.get_floor_sensor(sensor_id) >= 100
    def get_acceleration(self, axis): return self.accelerometer.get_acceleration(axis)
    def get_gyroscope(self, axis): return self.accelerometer.get_gyro(axis)
    def rgb_set_color(self, color): self.rgb_led.set_on(color)
    def get_light_sensor(self): return self.analogue_reader.get_reading(pin=0, chip=1)
    def get_power_sensor(self): return self.analogue_reader.get_reading(pin=4, chip=1)
    def check_for_dark(self): return self.get_light_sensor() >= 100
    def get_noise_detection(self): return self.analogue_reader.get_reading(pin=1, chip=1)

    def get_obstacle_sensor(self, sensor_id):
        chip, pin = {0: (0, 5), 1: (1, 7), 2: (0, 4), 3: (1, 5)}[int(sensor_id)]
        return self.analogue_reader.get_reading(pin=pin, chip=chip)

    def stop_timer(self): self.timer.stop_timer()
    def start_timer(self): self.timer.start_timer()
    def get_elapsed(self): return self.timer.get_elapsed()

    def exit(self):
        self.stop()
        self.rgb_set_color("closed")
        self.buzzer.cleanup()
        clean()

