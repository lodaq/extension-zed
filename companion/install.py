#!/usr/bin/env python3
"""Generate an admin-reviewable install bundle. Does not install or elevate itself."""
import argparse
import json
from pathlib import Path
import plistlib
import re
import shutil
import sys
import uuid

HERE = Path(__file__).resolve().parent
HOST = "com.extension_zed.limiter"


def bundle(destination, extension_id, python, update_url):
    if not re.fullmatch("[a-p]{32}", extension_id):
        raise ValueError("Use the extension's stable 32-character ID")
    if not update_url.startswith("https://") or any(char in update_url for char in "\r\n"):
        raise ValueError("The update manifest URL must use HTTPS")
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(HERE / "zed_limiter.py", destination / "zed_limiter.py")
    shutil.copyfile(HERE / "native-launcher.cs", destination / "native-launcher.cs")
    policies = {
        "ExtensionInstallForcelist": [f"{extension_id};{update_url}"],
        "ExtensionDeveloperModeSettings": 1,
        "DeveloperToolsAvailability": 2,
        "RemoteDebuggingAllowed": False,
        "IncognitoModeAvailability": 1,
        "BrowserGuestModeEnabled": False,
        "BrowserAddPersonEnabled": False,
        "NativeMessagingUserLevelHosts": False,
        "NativeMessagingBlocklist": ["*"],
        "NativeMessagingAllowlist": [HOST],
    }
    for platform in ("linux", "macos", "windows"):
        folder = destination / platform
        folder.mkdir()
        root = {"linux": "/usr/local/lib/extension-zed", "macos": "/Library/Application Support/ExtensionZed", "windows": r"C:\Program Files\ExtensionZed"}[platform]
        state = {"linux": "/var/lib/extension-zed", "macos": "/Library/Application Support/ExtensionZed/state", "windows": r"C:\ProgramData\ExtensionZed"}[platform]
        python_path = python.get(platform, {"linux": "/usr/bin/python3", "macos": "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3", "windows": r"C:\Program Files\Python313\python.exe"}[platform])
        config = {
            "extension_id": extension_id, "python": python_path, "policies": policies,
            "state_path": state + (r"\state.json" if platform == "windows" else "/state.json"),
            "address": r"\\.\pipe\ExtensionZedLimiter" if platform == "windows" else state + "/limiter.sock",
            "policy_path": "/etc/opt/chrome/policies/managed/extension-zed.json",
            "launcher": root + (r"\zed-native.exe" if platform == "windows" else "/zed-native"),
            "browsers": {"linux": ["/opt/google/chrome/chrome"], "macos": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"], "windows": [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]}[platform],
        }
        (folder / "config.json").write_text(json.dumps(config, indent=2) + "\n")
        native = {"name": HOST, "description": "Extension Zed administrator limiter", "path": config["launcher"], "type": "stdio", "allowed_origins": [f"chrome-extension://{extension_id}/"]}
        (folder / f"{HOST}.json").write_text(json.dumps(native, indent=2) + "\n")
        (folder / "policies.json").write_text(json.dumps(policies, indent=2) + "\n")
        if platform != "windows":
            # JSON quoting is not shell quoting. The launcher uses fixed, quoted paths.
            import shlex
            launcher = f"#!/bin/sh\nexec {shlex.quote(python_path)} -I {shlex.quote(root + '/zed_limiter.py')} native \"$@\"\n"
            (folder / "zed-native").write_text(launcher)
        if platform == "linux":
            unit = f"""[Unit]
Description=Extension Zed administrator limiter
After=local-fs.target
[Service]
Type=simple
User=root
ExecStart="{python_path}" -I "{root}/zed_limiter.py" serve
Restart=always
RestartSec=2
UMask=0022
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/extension-zed /etc/opt/chrome/policies/managed
[Install]
WantedBy=multi-user.target
"""
            (folder / "extension-zed.service").write_text(unit)
        if platform == "macos":
            daemon = {"Label": "com.extension_zed.limiter", "ProgramArguments": [python_path, "-I", root + "/zed_limiter.py", "serve"], "RunAtLoad": True, "KeepAlive": True, "UserName": "root", "Umask": 18, "ThrottleInterval": 2, "StandardErrorPath": state + "/service.log"}
            (folder / "com.extension_zed.limiter.plist").write_bytes(plistlib.dumps(daemon))
            profile = {"PayloadType": "Configuration", "PayloadVersion": 1, "PayloadIdentifier": "com.extension_zed.managed", "PayloadUUID": str(uuid.uuid4()), "PayloadDisplayName": "Extension Zed mandatory browser controls", "PayloadRemovalDisallowed": True, "PayloadScope": "System", "PayloadContent": [{"PayloadType": "com.google.Chrome", "PayloadVersion": 1, "PayloadIdentifier": "com.extension_zed.chrome", "PayloadUUID": str(uuid.uuid4()), **policies}]}
            (folder / "extension-zed.mobileconfig").write_bytes(plistlib.dumps(profile))
    shutil.copyfile(HERE / "install-unix.py", destination / "install-unix.py")
    shutil.copyfile(HERE / "install-windows.ps1", destination / "install-windows.ps1")
    shutil.copyfile(HERE / "README.md", destination / "README.md")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--update-url", default="https://clients2.google.com/service/update2/crx")
    parser.add_argument("--python-linux")
    parser.add_argument("--python-macos")
    parser.add_argument("--python-windows")
    args = parser.parse_args()
    bundle(args.output, args.extension_id, {name: value for name, value in {"linux": args.python_linux, "macos": args.python_macos, "windows": args.python_windows}.items() if value}, args.update_url)
    print(f"Bundle generated at {args.output.resolve()}. Review README.md before administrator installation.")
