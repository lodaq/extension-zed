#!/usr/bin/env python3
"""Install only the user-level downloader host; never changes browser policy."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import sys

HOST = "com.extension_zed.downloader"


def browser_root(browser):
    home = Path.home()
    if os.name == "nt":
        return Path(os.environ["LOCALAPPDATA"]) / ("Google/Chrome/User Data" if browser == "chrome" else "BraveSoftware/Brave-Browser/User Data")
    if sys.platform == "darwin":
        return home / "Library/Application Support" / ("Google/Chrome" if browser == "chrome" else "BraveSoftware/Brave-Browser")
    return Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))) / ("google-chrome" if browser == "chrome" else "BraveSoftware/Brave-Browser")


def discover_ids(browser):
    ids = set()
    for profile in browser_root(browser).glob("*"):
        if not profile.is_dir():
            continue
        for filename in ("Preferences", "Secure Preferences"):
            try:
                preferences = json.loads((profile / filename).read_text())
                if not isinstance(preferences, dict) or not isinstance(preferences.get("extensions", {}), dict):
                    continue
                settings = preferences.get("extensions", {}).get("settings", {})
            except (OSError, ValueError):
                continue
            if not isinstance(settings, dict):
                continue
            for extension_id, entry in settings.items():
                if not re.fullmatch(r"[a-p]{32}", extension_id) or not isinstance(entry, dict):
                    continue
                manifest = entry.get("manifest", {})
                if isinstance(entry.get("path"), str) and entry["path"]:
                    extension_path = Path(entry["path"])
                    if not extension_path.is_absolute():
                        extension_path = profile / "Extensions" / extension_path
                    try:
                        manifest = json.loads((extension_path / "manifest.json").read_text())
                    except (OSError, ValueError):
                        pass
                if isinstance(manifest, dict) and manifest.get("name") == "Extension Zed" and isinstance(manifest.get("permissions"), list) and "nativeMessaging" in manifest["permissions"]:
                    ids.add(extension_id)
    return sorted(ids)


def install(extension_id, browser, extension_ids=None):
    ids = extension_ids or [extension_id]
    if not all(isinstance(value, str) and re.fullmatch(r"[a-p]{32}", value) for value in ids):
        raise ValueError("Use the 32-letter extension ID from chrome://extensions or brave://extensions")
    home = Path.home()
    if os.name == "nt":
        root = Path(os.environ["LOCALAPPDATA"]) / "ExtensionZedDownloader"
    elif sys.platform == "darwin":
        root = home / "Library/Application Support/ExtensionZedDownloader"
    else:
        root = home / ".local/share/extension-zed-downloader"
    root.mkdir(parents=True, exist_ok=True)
    source = Path(__file__).resolve().parent
    shutil.copyfile(source / "zed_downloader.py", root / "zed_downloader.py")
    if os.name == "nt":
        # Chrome launches an executable on Windows; a .cmd file is insufficient.
        launcher = root / "zed-downloader.exe"
        if not launcher.exists():
            raise ValueError("Run install-windows.ps1 first to compile the native launcher")
        (root / "python-path.txt").write_text(sys.executable, encoding="utf-8")
        manifest = root / (HOST + "." + browser + ".json")
    else:
        launcher = root / "zed-downloader"
        # Include common user package-manager locations for GUI-launched browsers.
        search_path = os.pathsep.join([str(home / ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", os.environ.get("PATH", "/usr/bin:/bin")])
        launcher.write_text("#!/bin/sh\nexport PATH=" + shlex.quote(search_path) + "\nexec " + shlex.quote(sys.executable)
                            + " -I " + shlex.quote(str(root / "zed_downloader.py")) + "\n")
        launcher.chmod(0o700)
        directory = browser_root(browser) / "NativeMessagingHosts"
        directory.mkdir(parents=True, exist_ok=True)
        manifest = directory / (HOST + ".json")
    manifest.write_text(json.dumps({"name": HOST, "description": "Zed video downloader", "path": str(launcher),
                                   "type": "stdio", "allowed_origins": [f"chrome-extension://{value}/" for value in ids]}, indent=2))
    if os.name == "nt":
        import winreg
        vendor = "Google\\Chrome" if browser == "chrome" else "BraveSoftware\\Brave-Browser"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, "Software\\" + vendor + "\\NativeMessagingHosts\\" + HOST) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest))
    print(f"Installed {manifest}. Open Video downloader in Zed; it connects automatically.")


def setup(extension_id=None, browser=None):
    if extension_id:
        install(extension_id, browser or "chrome")
        return
    targets = [(name, discover_ids(name)) for name in ([browser] if browser else ["chrome", "brave"])]
    if not any(ids for _, ids in targets):
        raise ValueError("Zed was not found in Chrome or Brave. Install/load the extension first, then run this installer again. A custom profile can use the optional extension_id and --browser arguments.")
    for name, ids in targets:
        if ids:
            install(ids[0], name, ids)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extension_id", nargs="?", help="Optional; detect installed Zed automatically when omitted")
    parser.add_argument("--browser", choices=["chrome", "brave"])
    args = parser.parse_args()
    setup(args.extension_id, args.browser)
