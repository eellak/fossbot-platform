"""Keep a BlueZ authentication agent alive for the entire pairing operation."""
import os
import pty
import re
import select
import subprocess
import time


def run_with_agent(command, timeout=45):
    if not re.fullmatch(r"(?:pair|connect) (?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", command):
        return None, "Invalid controller"
    master, slave = pty.openpty()
    process = None
    transcript = []

    def wait_for(marker, deadline):
        output = ""
        while time.monotonic() < deadline:
            if select.select([master], [], [], min(0.2, max(0, deadline - time.monotonic())))[0]:
                try:
                    data = os.read(master, 8192)
                except OSError:
                    break
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                transcript.append(text)
                output += text
                if "Failed" in output or "not available" in output:
                    if "Authentication" in output:
                        raise RuntimeError("Pairing rejected")
                    raise RuntimeError("Bluetooth failed")
                if marker in output:
                    return
            elif process.poll() is not None:
                break
        raise RuntimeError("Bluetooth timed out")

    try:
        process = subprocess.Popen(
            ["bluetoothctl", "--agent", "NoInputNoOutput"],
            stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
            env={**os.environ, "LC_ALL": "C", "TERM": "dumb"},
        )
        os.close(slave)
        slave = None
        wait_for("Agent registered", time.monotonic() + 8)
        os.write(master, b"default-agent\n")
        wait_for("Default agent request successful", time.monotonic() + 8)
        os.write(master, (command + "\n").encode("ascii"))
        marker = "Pairing successful" if command.startswith("pair ") else "Connection successful"
        wait_for(marker, time.monotonic() + timeout)
        return "".join(transcript), None
    except (OSError, RuntimeError) as error:
        return "".join(transcript), str(error) if isinstance(error, RuntimeError) else "Bluetooth unavailable"
    finally:
        if process is not None:
            # EOF/termination unregisters the temporary agent on every path.
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        os.close(master)
        if slave is not None:
            os.close(slave)
