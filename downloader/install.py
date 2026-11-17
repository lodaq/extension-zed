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


def install(extension_id, browser):
    if not re.fullmatch(r"[a-p]{32}", extension_id):
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
        manifest = root / (HOST + ".json")
    else:
        launcher = root / "zed-downloader"
        # Include common user package-manager locations for GUI-launched browsers.
        search_path = os.pathsep.join([str(home / ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", os.environ.get("PATH", "/usr/bin:/bin")])
        launcher.write_text("#!/bin/sh\nexport PATH=" + shlex.quote(search_path) + "\nexec " + shlex.quote(sys.executable)
                            + " -I " + shlex.quote(str(root / "zed_downloader.py")) + "\n")
        launcher.chmod(0o700)
        if sys.platform == "darwin":
            vendor = "Google/Chrome" if browser == "chrome" else "BraveSoftware/Brave-Browser"
            directory = home / "Library/Application Support" / vendor / "NativeMessagingHosts"
        else:
            vendor = "google-chrome" if browser == "chrome" else "BraveSoftware/Brave-Browser"
            directory = Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))) / vendor / "NativeMessagingHosts"
        directory.mkdir(parents=True, exist_ok=True)
        manifest = directory / (HOST + ".json")
    manifest.write_text(json.dumps({"name": HOST, "description": "Zed video downloader", "path": str(launcher),
                                   "type": "stdio", "allowed_origins": [f"chrome-extension://{extension_id}/"]}, indent=2))
    if os.name == "nt":
        import winreg
        vendor = "Google\\Chrome" if browser == "chrome" else "BraveSoftware\\Brave-Browser"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, "Software\\" + vendor + "\\NativeMessagingHosts\\" + HOST) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest))
    print(f"Installed {manifest}. In Zed, open Video downloader and choose Check again.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extension_id")
    parser.add_argument("--browser", choices=["chrome", "brave"], default="chrome")
    args = parser.parse_args()
    install(args.extension_id, args.browser)
