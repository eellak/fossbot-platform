import os
import signal
import threading
import time
import subprocess
from collections import deque

# ----------------- Orphan-safe exit -----------------
def exit_when_parent_dies(parent_pid=None, interval=0.5):
    if parent_pid is None:
        parent_pid = os.getppid()

    def _watch():
        while True:
            try:
                ppid_now = os.getppid()
                if ppid_now != parent_pid and ppid_now == 1:
                    os.kill(os.getpid(), signal.SIGTERM)
                    return
            except Exception:
                try:
                    os.kill(os.getpid(), signal.SIGTERM)
                except Exception:
                    pass
                return
            time.sleep(interval)

    threading.Thread(target=_watch, daemon=True).start()


def get_wifi_ssid():
    try:
        ssid = subprocess.check_output(["iwgetid", "-r"], stderr=subprocess.DEVNULL) \
                         .decode("utf-8").strip()
        return ssid if ssid else "Not Connected"
    except Exception:
        return "Not Connected"


def get_ip_address():
    try:
        out = subprocess.check_output(["hostname", "-I"], stderr=subprocess.DEVNULL) \
                        .decode("utf-8").strip()
        candidates = [x for x in out.split() if x and not x.startswith("127.")]
        ipv4 = [x for x in candidates if x.count(".") == 3]
        if ipv4:
            return ipv4[0]
        return candidates[0] if candidates else "No IP"
    except Exception:
        return "No IP"


def _to_float_or_none(x):
    try:
        if x is None:
            return None
        if isinstance(x, (int, float)):
            return float(x)
        if isinstance(x, str):
            return float(x.strip().replace("%", ""))
        return None
    except Exception:
        return None


def read_battery_raw(robot):
    return robot.get_power_sensor()


# ----------------- Battery conversion + smoothing -----------------
ADC_AT_12V = 825.0
V_AT_ADC_AT_12V = 12.0

V_FULL = 12.6
V_STOP = 9.9

LOW_BATT_PCT = 10.0
LOW_BEEP_EVERY_S = 2.0

SMOOTH_WINDOW_S = 2.0
SAMPLE_EVERY_S = 0.2


def raw_to_voltage(raw, adc_at_12v=ADC_AT_12V, v_at_adc=V_AT_ADC_AT_12V):
    val = _to_float_or_none(raw)
    if val is None:
        return None
    return (val / float(adc_at_12v)) * float(v_at_adc)

def percent_from_voltage(v, v_full=V_FULL, v_stop=V_STOP):
    if v is None or v_full <= v_stop:
        return None
    pct = (v - v_stop) / (v_full - v_stop) * 100.0
    return max(0.0, min(100.0, pct))


class BatteryMonitor:
    def __init__(self, robot):
        self.robot = robot
        self._lock = threading.Lock()
        self._stop = threading.Event()

        self._raw = None
        self._v_inst = None
        self._v_smooth = None
        self._pct = None

        self._buf = deque(maxlen=max(1, int(SMOOTH_WINDOW_S /SAMPLE_EVERY_S)))
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while not self._stop.is_set():
            try:
                raw = read_battery_raw(self.robot)
                v = raw_to_voltage(raw)
                if v is not None:
                    self._buf.append(v)
                    v_smooth = sum(self._buf) / len(self._buf)
                    pct = percent_from_voltage(v_smooth)
                else:
                    v_smooth = None
                    pct = None

                with self._lock:
                    self._raw = raw
                    self._v_inst = v
                    self._v_smooth = v_smooth
                    self._pct = pct
            except Exception:
                pass

            self._stop.wait(SAMPLE_EVERY_S)

    def get(self):
        with self._lock:
            return {"raw": self._raw, "v_inst": self._v_inst, "v": self._v_smooth, "pct": self._pct}

    def stop(self):
        self._stop.set()


# NetworkManager owns Wi-Fi on Raspberry Pi OS Trixie.
from .wifi_manager import (
    get_saved_networks, connect_saved_network, scan_wifi_networks, connect_wifi,
)

# ----------------- Bluetooth helpers -----------------

def _run_bt_command(command, timeout=30):
    """Keep the pairing agent alive until BlueZ completes the command."""
    import shlex
    if command.startswith(("pair ", "connect ")):
        from .bluetooth_pairing import run_with_agent
        return run_with_agent(command, timeout=max(timeout, 45))
    args = ["bluetoothctl"]
    # --timeout keeps bluetoothctl alive even after read-only commands finish.
    # Only discovery needs that window; all commands have a subprocess deadline.
    if command == "scan on":
        args += ["--timeout", str(timeout)]
    try:
        result = subprocess.run(
            [*args, *shlex.split(command)],
            capture_output=True, text=True, timeout=timeout + 5,
            env={**os.environ, "LC_ALL": "C"},
        )
        output = result.stdout + result.stderr
        if result.returncode or "Failed" in output or "not available" in output:
            return output, "Bluetooth failed"
        return output, None
    except subprocess.TimeoutExpired:
        return None, "Bluetooth timed out"
    except OSError:
        return None, "Bluetooth unavailable"


def get_saved_bluetooth_devices():
    """Read BlueZ's saved/connected devices without starting discovery."""
    import re
    devices = {}
    for category in ("Paired", "Connected"):
        output, error = _run_bt_command(f"devices {category}", timeout=5)
        if error:
            raise RuntimeError(error)
        output = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", output)
        for line in output.splitlines():
            match = re.match(r"^Device ([0-9A-Fa-f:]{17}) (.+)$", line.strip())
            if match:
                mac, name = match.groups()
                device = devices.setdefault(mac, {
                    "mac": mac, "name": name, "paired": False, "connected": False,
                })
                device[category.lower()] = True
    return sorted(devices.values(), key=lambda device: (not device["connected"], device["name"]))


def scan_bluetooth_devices(scan_time=10):
    import re
    output, error = _run_bt_command("power on", timeout=5)
    if error:
        raise RuntimeError("Bluetooth off/blocked")
    output, error = _run_bt_command("scan on", timeout=scan_time)
    if error:
        raise RuntimeError(error)
    # Discovery notifications contain prefixes and ANSI escapes. Ask BlueZ
    # for its device list separately after the timed discovery session.
    output, error = _run_bt_command("devices", timeout=5)
    if error:
        raise RuntimeError(error)
    output = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", output)
    devices = {}
    for line in output.splitlines():
        match = re.match(r"^Device ([0-9A-Fa-f:]{17}) (.+)$", line.strip())
        if match:
            mac, name = match.groups()
            devices[mac] = {"mac": mac, "name": name}
    return list(devices.values())


def pair_device(mac):
    """Pair with a bluetooth device."""
    info, error = _run_bt_command(f"info {mac}", timeout=5)
    if not error and "Paired: yes" in info:
        return True, "Already paired"
    out, err = _run_bt_command(f"pair {mac}")
    if err:
        return False, err
    if "Pairing successful" in out:
        return True, "Paired!"
    if out:
        return False, "\n".join(out.strip().split('\n')[-2:])
    return False, "Pairing failed"

def connect_device(mac):
    """Connect to a bluetooth device."""
    info, error = _run_bt_command(f"info {mac}", timeout=5)
    if not error and "Connected: yes" in info and "Paired: yes" in info:
        return True, "Already connected"
    out, err = _run_bt_command(f"connect {mac}")
    if err:
        return False, err
    if "Connection successful" in out:
        return True, "Connected!"
    if out:
        return False, "\n".join(out.strip().split('\n')[-2:])
    return False, "Connection failed"

def trust_device(mac):
    """Trust a bluetooth device."""
    out, err = _run_bt_command(f"trust {mac}")
    if err:
        return False, err
    if "trust succeeded" in out:
        return True, "Trusted!"
    if out:
        return False, "\n".join(out.strip().split('\n')[-2:])
    return False, "Trust failed"