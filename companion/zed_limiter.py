#!/usr/bin/env python3
"""Administrator-owned limiter; native messaging is an unprivileged bridge only."""
import argparse
import ctypes
import datetime as dt
import json
import multiprocessing.connection as ipc
import os
from pathlib import Path
import re
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlsplit

HOST_NAME = "com.extension_zed.limiter"
MAX_MESSAGE = 65536
LEASE = 75
LIMIT = 500


def hostname(value):
    if not isinstance(value, str) or not value or len(value) > 2048:
        raise ValueError("Enter a website URL")
    parsed = urlsplit(value if "://" in value else "https://" + value)
    if parsed.scheme not in ("http", "https") or parsed.username or parsed.password:
        raise ValueError("Use an HTTP(S) website URL without credentials")
    host = (parsed.hostname or "").rstrip(".").lower().removeprefix("www.")
    host = host.encode("idna").decode("ascii")
    # Domain-only rules avoid browser-policy metacharacters and IP aliases.
    if len(host) > 253 or "." not in host or not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in host.split(".")) or host.replace(".", "").isdigit():
        raise ValueError("Use a public domain name, not an IP address or local host")
    return host


def matches(url, host):
    try:
        parsed = urlsplit(url)
        candidate = (parsed.hostname or "").lower().rstrip(".")
        return parsed.scheme in ("http", "https") and (candidate == host or candidate.endswith("." + host))
    except ValueError:
        return False


def day_at(now):
    return dt.datetime.fromtimestamp(now, dt.timezone.utc).strftime("%Y-%m-%d")


def atomic_json(path, value):
    path = Path(path)
    # All callers use installer-owned directories; never accept paths over IPC.
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".zed-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, separators=(",", ":"))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class Store:
    def __init__(self, path, publish, clock=time.time):
        self.path, self.publish, self.clock = Path(path), publish, clock
        self.lock = threading.RLock()
        self.state = json.loads(self.path.read_text()) if self.path.exists() else {"rules": [], "last": clock(), "url": "", "report": 0}
        self.last_policy = None
        # Never carry an unverified foreground tab across a service restart.
        self.state["url"] = ""
        self.tick(restarted=True)

    def tick(self, restarted=False):
        with self.lock:
            # A clock rollback cannot extend allowances or release blocks early.
            now = max(self.clock(), self.state["last"])
            previous = self.state["last"]
            day = day_at(now)
            changed = False
            rules = []
            for rule in self.state["rules"]:
                if rule["mode"] == "block":
                    if rule["until"] > now:
                        rules.append(rule)
                    else:
                        changed = True
                    continue
                if rule["day"] != day:
                    rule.update(day=day, used=0, locked=False)
                    changed = True
                if restarted or now - self.state["report"] > LEASE:
                    if not rule["locked"]:
                        rule["locked"] = True
                        changed = True
                if not rule["locked"] and matches(self.state["url"], rule["host"]):
                    midnight = dt.datetime.fromtimestamp(now, dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
                    rule["used"] = min(rule["minutes"] * 60, rule["used"] + max(0, now - max(previous, midnight)))
                    rule["locked"] = rule["used"] >= rule["minutes"] * 60
                    changed = True
                rules.append(rule)
            self.state["rules"] = rules
            self.state["last"] = now
            blocked = sorted(rule["host"] for rule in rules if rule["mode"] == "block" or rule["locked"])
            if changed or restarted:
                atomic_json(self.path, self.state)
            if blocked != self.last_policy:
                # Persist before acknowledging or publishing a rule change.
                self.publish(blocked)
                self.last_policy = blocked
            return now

    def handle(self, request):
        with self.lock:
            if not isinstance(request, dict) or request.get("action") not in ("status", "add", "report"):
                raise ValueError("Only status, add and foreground reporting are supported")
            now = self.tick()
            if request["action"] == "add":
                host = hostname(request.get("url"))
                mode, minutes = request.get("mode"), request.get("minutes")
                if mode not in ("block", "daily") or type(minutes) is not int or not 1 <= minutes <= (1440 if mode == "daily" else 525600):
                    raise ValueError("Invalid mode or duration")
                if any(rule["host"] == host for rule in self.state["rules"]):
                    raise ValueError("An active rule cannot be edited, shortened or replaced")
                if len(self.state["rules"]) >= LIMIT:
                    raise ValueError("Maximum number of rules reached")
                self.state["rules"].append({"id": int(now * 1000), "host": host, "mode": mode, "minutes": minutes, "until": now + minutes * 60, "day": day_at(now), "used": 0, "locked": False})
                # The first daily rule starts a lease, not an indefinite exemption.
                self.state["report"] = now
                atomic_json(self.path, self.state)
                self.tick()
            elif request["action"] == "report":
                url = request.get("url", "")
                if not isinstance(url, str) or len(url) > 2048:
                    raise ValueError("Invalid foreground URL")
                # Persist only a domain, never paths, search terms or URL tokens.
                parsed = urlsplit(url)
                url = f"{parsed.scheme}://{parsed.hostname}" if parsed.scheme in ("http", "https") and parsed.hostname else ""
                self.state.update(url=url, report=now)
                # Reporting cannot clear a lock or reset an allowance.
                atomic_json(self.path, self.state)
            return {"ok": True, "rules": [{**rule, "until": rule["until"] * 1000, "used": rule["used"] * 1000} for rule in self.state["rules"]]}


class Policies:
    def __init__(self, config):
        self.config = config

    def __call__(self, blocked):
        base = dict(self.config["policies"])
        base["URLBlocklist"] = blocked
        if sys.platform == "win32":
            import winreg
            root = r"SOFTWARE\Policies\Google\Chrome"
            # Keep stable registry slots; never temporarily remove a live block.
            with winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, root + r"\URLBlocklist", 0, winreg.KEY_ALL_ACCESS | winreg.KEY_WOW64_64KEY) as key:
                existing = {}
                for index in range(winreg.QueryInfoKey(key)[1]):
                    name, value, _ = winreg.EnumValue(key, index)
                    existing[name] = value
                desired = set(blocked)
                occupied = set(existing)
                for host in desired - set(existing.values()):
                    slot = next(str(index) for index in range(1, 1001) if str(index) not in occupied)
                    winreg.SetValueEx(key, slot, 0, winreg.REG_SZ, host)
                    occupied.add(slot)
                for name, host in existing.items():
                    if host not in desired:
                        winreg.DeleteValue(key, name)
        elif sys.platform == "darwin":
            # Mandatory configuration profiles own static restrictions; the daemon
            # maintains only the URLBlocklist in the machine managed preferences.
            import plistlib
            target = Path("/Library/Managed Preferences/com.google.Chrome.plist")
            existing = plistlib.loads(target.read_bytes()) if target.exists() else {}
            existing.update(base)
            payload = plistlib.dumps(existing)
            fd, name = tempfile.mkstemp(dir=target.parent, prefix=".zed-")
            with os.fdopen(fd, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(name, 0o644)
            os.replace(name, target)
        else:
            atomic_json(self.config["policy_path"], base)
            os.chmod(self.config["policy_path"], 0o644)


def process_info(pid):
    """Return parent PID and executable path using OS process metadata."""
    if sys.platform == "win32":
        from ctypes import wintypes as w
        class Entry(ctypes.Structure):
            _fields_ = [("size", w.DWORD), ("usage", w.DWORD), ("pid", w.DWORD), ("heap", ctypes.c_size_t), ("module", w.DWORD), ("threads", w.DWORD), ("parent", w.DWORD), ("priority", w.LONG), ("flags", w.DWORD), ("exe", w.WCHAR * 260)]
        api = ctypes.WinDLL("kernel32", use_last_error=True)
        api.CreateToolhelp32Snapshot.restype = w.HANDLE
        api.Process32FirstW.argtypes = [w.HANDLE, ctypes.POINTER(Entry)]
        api.Process32NextW.argtypes = [w.HANDLE, ctypes.POINTER(Entry)]
        api.OpenProcess.restype = w.HANDLE
        api.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, ctypes.POINTER(w.DWORD)]
        api.CloseHandle.argtypes = [w.HANDLE]
        snapshot = api.CreateToolhelp32Snapshot(2, 0)
        entry, parent = Entry(), None
        entry.size = ctypes.sizeof(entry)
        try:
            found = api.Process32FirstW(snapshot, ctypes.byref(entry))
            while found:
                if entry.pid == pid:
                    parent = entry.parent
                    break
                found = api.Process32NextW(snapshot, ctypes.byref(entry))
        finally:
            api.CloseHandle(snapshot)
        if parent is None:
            raise PermissionError("Client process disappeared")
        handle = api.OpenProcess(0x1000, False, pid)
        try:
            buffer, length = ctypes.create_unicode_buffer(32768), w.DWORD(32768)
            if not api.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(length)):
                raise PermissionError("Cannot inspect client executable")
            return parent, buffer.value
        finally:
            api.CloseHandle(handle)
    if sys.platform == "darwin":
        lib = ctypes.CDLL("/usr/lib/libproc.dylib")
        buffer = ctypes.create_string_buffer(4096)
        if lib.proc_pidpath(pid, buffer, len(buffer)) <= 0:
            raise PermissionError("Cannot inspect client executable")
        parent = int(subprocess.check_output(["/bin/ps", "-p", str(pid), "-o", "ppid="], text=True).strip())
        return parent, buffer.value.decode()
    stat = Path(f"/proc/{pid}/stat").read_text()
    parent = int(stat[stat.rfind(")") + 2:].split()[1])
    return parent, os.readlink(f"/proc/{pid}/exe")


def peer_pid(connection):
    if sys.platform == "win32":
        from ctypes import wintypes as w
        api = ctypes.WinDLL("kernel32", use_last_error=True)
        api.GetNamedPipeClientProcessId.argtypes = [w.HANDLE, ctypes.POINTER(w.ULONG)]
        pid = w.ULONG()
        if not api.GetNamedPipeClientProcessId(connection.fileno(), ctypes.byref(pid)):
            raise PermissionError("Cannot identify native bridge")
        return pid.value
    duplicate = socket.fromfd(connection.fileno(), socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        if sys.platform == "darwin":
            return struct.unpack("i", duplicate.getsockopt(0, 2, 4))[0]  # LOCAL_PEERPID
        return struct.unpack("3i", duplicate.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))[0]
    finally:
        duplicate.close()


def verify_bridge(connection, config):
    parent, executable = process_info(peer_pid(connection))
    if Path(executable).resolve() != Path(config["python"]).resolve():
        raise PermissionError("Only the installed native bridge may report usage")
    _, executable = process_info(parent)
    if sys.platform == "win32":
        if Path(executable).resolve() != Path(config["launcher"]).resolve():
            raise PermissionError("Untrusted native launcher")
        parent, _ = process_info(parent)
        _, executable = process_info(parent)
    if os.path.normcase(os.path.realpath(executable)) not in [os.path.normcase(os.path.realpath(path)) for path in config["browsers"]]:
        raise PermissionError("The native bridge must be launched by the managed browser")


def windows_pipe_client(address):
    from ctypes import wintypes as w
    api = ctypes.WinDLL("kernel32", use_last_error=True)
    api.CreateFileW.argtypes = [w.LPCWSTR, w.DWORD, w.DWORD, ctypes.c_void_p, w.DWORD, w.DWORD, w.HANDLE]
    api.CreateFileW.restype = w.HANDLE
    api.CloseHandle.argtypes = [w.HANDLE]
    api.SetNamedPipeHandleState.argtypes = [w.HANDLE, ctypes.POINTER(w.DWORD), ctypes.c_void_p, ctypes.c_void_p]
    handle = api.CreateFileW(address, 0x12019B, 0, None, 3, 0x40000000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise OSError(ctypes.get_last_error(), "Cannot connect to administrator service")
    mode = w.DWORD(2)
    if not api.SetNamedPipeHandleState(handle, ctypes.byref(mode), None, None):
        api.CloseHandle(handle)
        raise OSError("Cannot configure native pipe")
    return ipc.PipeConnection(handle)


class WindowsListener:
    def __init__(self, address):
        from ctypes import wintypes as w
        self.address, self.first = address, True
        self.api = ctypes.WinDLL("kernel32", use_last_error=True)
        self.api.CreateNamedPipeW.argtypes = [w.LPCWSTR, w.DWORD, w.DWORD, w.DWORD, w.DWORD, w.DWORD, w.DWORD, ctypes.c_void_p]
        self.api.CreateNamedPipeW.restype = w.HANDLE
        self.api.ConnectNamedPipe.argtypes = [w.HANDLE, ctypes.c_void_p]
        self.api.CloseHandle.argtypes = [w.HANDLE]
        # Users can read/write requests, but cannot create another server instance.
        self.descriptor = ctypes.c_void_p()
        adv = ctypes.WinDLL("advapi32", use_last_error=True)
        adv.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [w.LPCWSTR, w.DWORD, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
        if not adv.ConvertStringSecurityDescriptorToSecurityDescriptorW("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;0x12019b;;;AU)", 1, ctypes.byref(self.descriptor), None):
            raise OSError("Cannot protect service pipe")
        class Attributes(ctypes.Structure):
            _fields_ = [("length", w.DWORD), ("descriptor", ctypes.c_void_p), ("inherit", w.BOOL)]
        self.attributes = Attributes(ctypes.sizeof(Attributes), self.descriptor, False)
        self.waiting = self.create()

    def create(self):
        handle = self.api.CreateNamedPipeW(self.address, 3 | 0x40000000 | (0x80000 if self.first else 0), 6 | 8, 10, MAX_MESSAGE, MAX_MESSAGE, 5000, ctypes.byref(self.attributes))
        if handle == ctypes.c_void_p(-1).value:
            raise OSError(ctypes.get_last_error(), "Cannot create protected service pipe")
        self.first = False
        return handle

    def accept(self):
        handle = self.waiting
        import _winapi
        try:
            operation = _winapi.ConnectNamedPipe(handle, overlapped=True)
            _, error = operation.GetOverlappedResult(True)
            if error:
                raise OSError(error, "Cannot accept native bridge")
        except OSError:
            self.api.CloseHandle(handle)
            raise
        self.waiting = self.create()
        return ipc.PipeConnection(handle)


def serve(config):
    store = Store(config["state_path"], Policies(config))
    address = config["address"]
    if sys.platform != "win32":
        path = Path(address)
        if path.exists():
            # This is a fixed administrator-owned directory, never a client path.
            path.unlink()
    listener = WindowsListener(address) if sys.platform == "win32" else ipc.Listener(address, family="AF_UNIX")
    if sys.platform != "win32":
        os.chmod(address, 0o666)  # Peer process identity, not a shared user secret.
    slots = threading.BoundedSemaphore(8)
    def client(connection):
        try:
            verify_bridge(connection, config)
            if not connection.poll(5):
                return
            request = json.loads(connection.recv_bytes(MAX_MESSAGE))
            response = store.handle(request)
            connection.send_bytes(json.dumps(response).encode())
        except (ValueError, OSError, EOFError) as error:
            try:
                connection.send_bytes(json.dumps({"ok": False, "error": str(error)}).encode())
            except OSError:
                pass
        finally:
            connection.close()
            slots.release()
    def accept():
        while True:
            connection = listener.accept()
            if slots.acquire(blocking=False):
                threading.Thread(target=client, args=(connection,), daemon=True).start()
            else:
                connection.close()
    threading.Thread(target=accept, daemon=True).start()
    while True:
        store.tick()
        time.sleep(1)


def read_exact(stream, length):
    output = b""
    while len(output) < length:
        part = stream.read(length - len(output))
        if not part:
            raise EOFError("Incomplete native message")
        output += part
    return output


def native(config, origin):
    if origin != f"chrome-extension://{config['extension_id']}/":
        raise PermissionError("Unapproved extension origin")
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    try:
        length = struct.unpack("=I", read_exact(sys.stdin.buffer, 4))[0]
        if not 0 < length <= MAX_MESSAGE:
            raise ValueError("Native message too large")
        request = json.loads(read_exact(sys.stdin.buffer, length))
        with (windows_pipe_client(config["address"]) if sys.platform == "win32" else ipc.Client(config["address"], family="AF_UNIX")) as connection:
            connection.send_bytes(json.dumps(request).encode())
            if not connection.poll(10):
                raise TimeoutError("Administrator service did not respond")
            response = json.loads(connection.recv_bytes(MAX_MESSAGE))
    except (ValueError, OSError, EOFError) as error:
        response = {"ok": False, "error": str(error)}
    payload = json.dumps(response).encode()
    sys.stdout.buffer.write(struct.pack("=I", len(payload)) + payload)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("serve", "native"))
    parser.add_argument("origin", nargs="?")
    args, _ = parser.parse_known_args()
    configuration = json.loads(Path(__file__).with_name("config.json").read_text())
    if args.mode == "serve":
        serve(configuration)
    else:
        native(configuration, args.origin)
