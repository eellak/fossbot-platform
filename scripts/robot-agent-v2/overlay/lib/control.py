"""Trixie hardware drivers for the physical FOSSBot v2.

Motor enable pins GPIO12/GPIO13 are driven by the BCM2835 hardware PWM
controller exposed through Linux sysfs.  They must not be passed to
``RPi.GPIO.PWM`` because that would replace hardware PWM with software timing.
"""

import math
import threading
import time
from datetime import datetime
from pathlib import Path

import RPi.GPIO as GPIO
import smbus
import spidev
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import sh1106
from PIL import ImageDraw, ImageFont


PWM_CHIP = Path("/sys/class/pwm/pwmchip0")
PWM_CHANNELS = {12: 0, 13: 1}
PWM_FREQUENCY_HZ = 200


def start_lib() -> None:
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)


def clean() -> None:
    GPIO.cleanup()


class Timer:
    def __init__(self):
        self.start = 0

    def stop_timer(self) -> None:
        self.start = 0

    def start_timer(self) -> None:
        self.start = datetime.now()

    def elapsed(self) -> None:
        print(f"The elapsed time in sec is {self.get_elapsed()}")

    def get_elapsed(self) -> int:
        if self.start == 0:
            return 0
        return int((datetime.now() - self.start).total_seconds())


class HardwarePWM:
    """Small sysfs wrapper for one already-prepared hardware PWM channel."""

    def __init__(self, gpio_pin: int, frequency_hz: int = PWM_FREQUENCY_HZ):
        if gpio_pin not in PWM_CHANNELS:
            raise ValueError(f"GPIO{gpio_pin} is not a configured PWM pin")
        self.channel = PWM_CHANNELS[gpio_pin]
        self.path = PWM_CHIP / f"pwm{self.channel}"
        self.period_ns = int(1_000_000_000 / frequency_hz)
        if not self.path.is_dir():
            raise RuntimeError(
                f"{self.path} is unavailable; run the service PWM preparation first"
            )
        self._write("enable", 0)
        self._write("duty_cycle", 0)
        self._write("period", self.period_ns)
        self._write("enable", 1)

    def _write(self, name: str, value: int) -> None:
        (self.path / name).write_text(str(int(value)), encoding="ascii")

    def set_duty_cycle(self, percent: float) -> None:
        percent = max(0.0, min(100.0, float(percent)))
        self._write("duty_cycle", int(self.period_ns * percent / 100.0))

    def stop(self) -> None:
        self.set_duty_cycle(0)


class Motor:
    def __init__(
        self, speed_pin: int, terma_pin: int, termb_pin: int, dc_value: int = 40
    ) -> None:
        self.terma_pin = terma_pin
        self.termb_pin = termb_pin
        self.dc_value = max(0, min(100, int(dc_value)))
        GPIO.setup(self.terma_pin, GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(self.termb_pin, GPIO.OUT, initial=GPIO.LOW)
        self.mot = HardwarePWM(speed_pin)

    def set_speed(self, speed: int) -> None:
        speed = int(speed)
        if not 0 <= speed <= 100:
            raise ValueError("Motor speed must be between 0 and 100")
        self.dc_value = speed
        self.mot.set_duty_cycle(speed)

    def dir_control(self, direction: str) -> None:
        if direction == "forward":
            GPIO.output(self.terma_pin, GPIO.HIGH)
            GPIO.output(self.termb_pin, GPIO.LOW)
        elif direction == "reverse":
            GPIO.output(self.terma_pin, GPIO.LOW)
            GPIO.output(self.termb_pin, GPIO.HIGH)
        else:
            raise ValueError("Motor direction must be 'forward' or 'reverse'")

    def move(self, direction: str = "forward") -> None:
        # Keep PWM at zero while changing the H-bridge direction.
        self.mot.set_duty_cycle(0)
        self.dir_control(direction)
        self.mot.set_duty_cycle(self.dc_value)

    def stop(self) -> None:
        self.mot.stop()
        GPIO.output(self.terma_pin, GPIO.LOW)
        GPIO.output(self.termb_pin, GPIO.LOW)


class Odometer:
    def __init__(self, pin: int) -> None:
        self.pin = pin
        self.sensor_disc = 20
        self.steps = 0
        self.wheel_diameter = 6.65
        self._lock = threading.Lock()
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        GPIO.add_event_detect(pin, GPIO.RISING, callback=self.count_revolutions, bouncetime=1)

    def count_revolutions(self, _channel=None) -> None:
        with self._lock:
            self.steps += 1

    def get_steps(self) -> int:
        with self._lock:
            return self.steps

    def get_revolutions(self) -> float:
        return self.get_steps() / self.sensor_disc

    def get_distance(self) -> float:
        return round(self.get_revolutions() * self.wheel_diameter * math.pi, 2)

    def reset(self) -> None:
        with self._lock:
            self.steps = 0


class UltrasonicSensor:
    def __init__(self, echo_pin: int = 23, trig_pin: int = 24) -> None:
        self.echo_pin = echo_pin
        self.trig_pin = trig_pin
        GPIO.setup(echo_pin, GPIO.IN)
        GPIO.setup(trig_pin, GPIO.OUT, initial=GPIO.LOW)

    def get_distance(self) -> float:
        GPIO.output(self.trig_pin, GPIO.HIGH)
        time.sleep(0.00001)
        GPIO.output(self.trig_pin, GPIO.LOW)
        deadline = time.monotonic() + 0.03
        while GPIO.input(self.echo_pin) == 0:
            if time.monotonic() >= deadline:
                return 400.0
        started = time.monotonic()
        deadline = started + 0.03
        while GPIO.input(self.echo_pin) == 1:
            if time.monotonic() >= deadline:
                return 400.0
        return min(400.0, (time.monotonic() - started) * 34300 / 2)


class Accelerometer:
    def __init__(self, address: int = 0x68) -> None:
        self.address = address
        self.bus = smbus.SMBus(1)
        # Wake the MPU6050. It powers up in sleep mode.
        self.bus.write_byte_data(address, 0x6B, 0)

    def _word(self, register: int) -> int:
        value = self.bus.read_byte_data(self.address, register) << 8
        value |= self.bus.read_byte_data(self.address, register + 1)
        return value - 65536 if value >= 32768 else value

    def get_acceleration(self, dimension: str) -> float:
        register = {"x": 0x3B, "y": 0x3D, "z": 0x3F}[dimension]
        return self._word(register) / 16384.0 * 9.80665

    def get_gyro(self, dimension: str) -> float:
        register = {"x": 0x43, "y": 0x45, "z": 0x47}[dimension]
        return self._word(register) / 131.0


class AnalogueReadings:
    """Read either MCP3008 using CE0 (chip 0) or CE1 (chip 1)."""

    def __init__(self, bus: int = 0) -> None:
        self.devices = []
        for device in (0, 1):
            adc = spidev.SpiDev()
            adc.open(bus, device)
            adc.max_speed_hz = 1_000_000
            self.devices.append(adc)
        self._lock = threading.Lock()

    def get_reading(self, pin: int, chip: int = 0) -> float:
        if chip not in (0, 1) or not 0 <= int(pin) <= 7:
            raise ValueError("MCP3008 chip must be 0/1 and channel must be 0..7")
        with self._lock:
            reply = self.devices[chip].xfer2([1, (8 + int(pin)) << 4, 0])
        return float(((reply[1] & 3) << 8) | reply[2])


class GenOutput:
    def __init__(self, pin: int) -> None:
        self.pin = pin
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)

    def set_on(self) -> None:
        GPIO.output(self.pin, GPIO.HIGH)

    def set_off(self) -> None:
        GPIO.output(self.pin, GPIO.LOW)


class LedRGB:
    def __init__(self, pin_r=16, pin_b=21, pin_g=20, anode=False) -> None:
        self.p_r, self.p_b, self.p_g = GenOutput(pin_r), GenOutput(pin_b), GenOutput(pin_g)
        self.anode = anode
        self.set_on("closed")

    def set_on(self, color: str) -> None:
        color = str(color).lower()
        if color == "off":
            color = "closed"
        levels = {
            "closed": (0, 0, 0), "red": (1, 0, 0), "green": (0, 0, 1),
            "blue": (0, 1, 0), "white": (1, 1, 1), "violet": (1, 1, 0),
            "cyan": (0, 1, 1), "yellow": (1, 0, 1),
        }
        if color not in levels:
            raise ValueError(f"Unsupported RGB color: {color}")
        values = levels[color]
        if self.anode:
            values = tuple(1 - value for value in values)
        for output, value in zip((self.p_r, self.p_b, self.p_g), values):
            output.set_on() if value else output.set_off()


class Buzzer:
    def __init__(self, pin: int = 22, start_freq: int = 440) -> None:
        self.pin = pin
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)
        self.pwm = GPIO.PWM(pin, start_freq)
        self.pwm.start(0)

    def tone(self, frequency_hz: float, duration_s: float, duty: float = 50) -> None:
        if frequency_hz > 0:
            self.pwm.ChangeFrequency(float(frequency_hz))
            self.pwm.ChangeDutyCycle(float(duty))
        else:
            self.pwm.ChangeDutyCycle(0)
        time.sleep(max(0, float(duration_s)))
        self.pwm.ChangeDutyCycle(0)

    def play(self, melody, duty: float = 50, gap_s: float = 0.03) -> None:
        for frequency, duration in melody:
            self.tone(frequency, duration, duty)
            if gap_s:
                time.sleep(gap_s)

    def cleanup(self) -> None:
        pwm, self.pwm = self.pwm, None
        pwm.ChangeDutyCycle(0)
        pwm.stop()
        del pwm
        GPIO.output(self.pin, GPIO.LOW)


class Button:
    def __init__(self, pin: int) -> None:
        self.pin = pin
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    def is_pressed(self) -> bool:
        return GPIO.input(self.pin) == GPIO.LOW


class Screen:
    def __init__(self, i2c_port=1, i2c_address=0x3C, width=128, height=64) -> None:
        serial = i2c(port=i2c_port, address=i2c_address)
        # The 1.3-inch FOSSBot panel uses the SH1106 controller. It answers at
        # the same address as an SSD1306, but its 132-column framebuffer needs
        # a different addressing offset. Using the SSD1306 profile leaves most
        # of the display filled with stale/random RAM.
        self.device = sh1106(serial, width=width, height=height)
        self.font = ImageFont.load_default()
        self._lock = threading.Lock()

    def text_lines(self, lines, line_h=16) -> None:
        with self._lock:
            with canvas(self.device) as draw:
                for index, line in enumerate(list(lines)[:4]):
                    draw.text((0, index * line_h), str(line)[:21], font=self.font, fill="white")
