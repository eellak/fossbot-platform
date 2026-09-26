"""Persistent Wi-Fi configuration through the OS network manager."""
import os
import subprocess

WIFI_IFACE = os.environ.get("FOSSBOT_WIFI_IFACE", "wlan0")


class WifiError(RuntimeError):
    pass


def _nmcli(*args, wait=10):
    try:
        result = subprocess.run(
            ["nmcli", "--wait", str(wait), "--terse", "--escape", "yes", *args],
            capture_output=True, text=True, timeout=wait + 5,
            env={**os.environ, "LC_ALL": "C"},
        )
    except FileNotFoundError:
        raise WifiError("WiFi unavailable") from None
    except subprocess.TimeoutExpired:
        raise WifiError("WiFi timed out") from None
    if result.returncode:
        # Never expose command arguments (which may contain a password).
        error = result.stderr.lower()
        if "authorized" in error or "permission" in error:
            raise WifiError("WiFi access denied")
        if "secret" in error or "password" in error:
            raise WifiError("Check WiFi password")
        if "not running" in error:
            raise WifiError("WiFi unavailable")
        raise WifiError("WiFi failed; retry")
    return result.stdout.rstrip("\n")


def _fields(line):
    """Decode nmcli's escaped colons and backslashes, preserving SSID spaces."""
    fields, field, escaped = [], [], False
    for char in line:
        if escaped:
            field.append(char)
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == ":":
            fields.append("".join(field))
            field = []
        else:
            field.append(char)
    fields.append("".join(field))
    return fields


def get_saved_networks():
    result = []
    for line in _nmcli("--fields", "UUID,TYPE", "connection", "show").splitlines():
        uuid, kind = _fields(line)
        if kind != "802-11-wireless":
            continue
        mode = _nmcli("--get-values", "802-11-wireless.mode", "connection", "show", "uuid", uuid)
        if mode not in ("", "infrastructure"):
            continue
        ssid = _nmcli("--get-values", "802-11-wireless.ssid", "connection", "show", "uuid", uuid)
        result.append({"id": uuid, "ssid": _fields(ssid)[0]})
    return result


def scan_wifi_networks(limit=30):
    output = _nmcli("--fields", "SSID,SIGNAL,SECURITY", "device", "wifi", "list",
                    "ifname", WIFI_IFACE, "--rescan", "yes", wait=8)
    networks = {}
    for line in output.splitlines():
        ssid, signal, security = _fields(line)
        if not ssid:
            continue
        network = {"ssid": ssid, "signal": int(signal), "security": security or "--"}
        if ssid not in networks or int(signal) > networks[ssid]["signal"]:
            networks[ssid] = network
    return sorted(networks.values(), key=lambda item: item["signal"], reverse=True)[:limit]


def connect_saved_network(net_id):
    try:
        _nmcli("connection", "modify", "uuid", net_id, "connection.autoconnect", "yes")
        _nmcli("connection", "up", "uuid", net_id, "ifname", WIFI_IFACE, wait=40)
        return True, "Connected"
    except WifiError as error:
        return False, str(error)


def connect_wifi(ssid, password):
    if not ssid:
        return False, "No SSID"
    try:
        saved = next((net for net in get_saved_networks() if net["ssid"] == ssid), None)
        if saved:
            if password:
                _nmcli("connection", "modify", "uuid", saved["id"],
                        "802-11-wireless-security.psk", password,
                        "802-11-wireless-security.psk-flags", "0")
            return connect_saved_network(saved["id"])
        args = ["device", "wifi", "connect", ssid, "ifname", WIFI_IFACE, "private", "no"]
        if password:
            args += ["password", password]
        # nmcli creates a persistent, autoconnecting system profile and waits
        # for activation; a successful subprocess means connection succeeded.
        _nmcli(*args, wait=40)
        return True, "Connected"
    except WifiError as error:
        return False, str(error)
