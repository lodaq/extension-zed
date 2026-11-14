#!/usr/bin/env python3
"""Run by an administrator from a generated bundle, after review."""
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys

HERE = Path(__file__).resolve().parent


def protected(path):
    """Reject symlinks and directories writable by non-root accounts."""
    path = Path(path)
    trusted_groups = {0}
    if sys.platform == "darwin":
        import grp
        trusted_groups.add(grp.getgrnam("admin").gr_gid)
    for ancestor in reversed([path, *path.parents]):
        if not ancestor.exists():
            ancestor.mkdir(mode=0o755)
        info = ancestor.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o002 or (info.st_mode & 0o020 and info.st_gid not in trusted_groups):
            raise RuntimeError(f"Administrator-owned, non-writable path required: {ancestor}")


def install():
    if os.geteuid() != 0:
        raise SystemExit("Run as administrator after reading README.md")
    platform = "macos" if sys.platform == "darwin" else "linux"
    source = HERE / platform
    config = json.loads((source / "config.json").read_text())
    root = Path(config["launcher"]).parent
    state = Path(config["state_path"]).parent
    # Refuse partial/existing installations before replacing any program file.
    for filename in ("zed_limiter.py", "config.json", "zed-native"):
        target = root / filename
        if target.exists() or target.is_symlink():
            raise SystemExit("Existing installation requires administrator review; no files were replaced")
    service = Path("/Library/LaunchDaemons/com.extension_zed.limiter.plist") if platform == "macos" else Path("/etc/systemd/system/extension-zed.service")
    native_manifest = Path("/Library/Google/Chrome/NativeMessagingHosts/com.extension_zed.limiter.json") if platform == "macos" else Path("/etc/opt/chrome/native-messaging-hosts/com.extension_zed.limiter.json")
    if service.exists() or service.is_symlink() or native_manifest.exists() or native_manifest.is_symlink():
        raise SystemExit("Existing service or native host requires administrator review")
    protected(root)
    protected(state)
    python = Path(config["python"]).resolve()
    protected(python.parent)
    info = python.stat()
    if info.st_uid != 0 or info.st_mode & 0o022:
        raise SystemExit("Python must be installed and protected by an administrator")
    # Existing browser policy may override blocks; do not silently replace it.
    if platform == "linux":
        directory = Path(config["policy_path"]).parent
        protected(directory)
        for policy in directory.glob("*.json"):
            if policy.name == "extension-zed.json":
                raise SystemExit("Already installed. Updates need an administrator review; state must be retained.")
            values = json.loads(policy.read_text())
            if {"URLBlocklist", "URLAllowlist", *config["policies"]}.intersection(values):
                raise SystemExit(f"Conflicting existing policy: {policy}")
        native = Path("/etc/opt/chrome/native-messaging-hosts")
    else:
        native = Path("/Library/Google/Chrome/NativeMessagingHosts")
        protected(Path("/Library/Managed Preferences"))
        managed = Path("/Library/Managed Preferences/com.google.Chrome.plist")
        if managed.is_symlink():
            raise SystemExit("Refusing a managed-preference symlink")
        if managed.exists():
            import plistlib
            info = managed.stat()
            values = plistlib.loads(managed.read_bytes())
            if info.st_uid != 0 or info.st_mode & 0o022:
                raise SystemExit("Managed preferences must be root-owned and not user-writable")
            if "URLAllowlist" in values or "URLBlocklist" in values or any(values.get(key) != value for key, value in config["policies"].items()):
                raise SystemExit("Existing Chrome preferences conflict with this bundle; an MDM administrator must merge policies")
    protected(native)
    for filename in ("zed_limiter.py",):
        target = root / filename
        if target.is_symlink():
            raise SystemExit("Refusing an unexpected symlink")
        shutil.copyfile(HERE / filename, target)
        target.chmod(0o644)
    for filename in ("config.json", "zed-native"):
        target = root / filename
        if target.is_symlink():
            raise SystemExit("Refusing an unexpected symlink")
        shutil.copyfile(source / filename, target)
        target.chmod(0o755 if filename == "zed-native" else 0o644)
    manifest = native / "com.extension_zed.limiter.json"
    if manifest.exists() or manifest.is_symlink():
        raise SystemExit("Native host already exists; manual administrator review required")
    shutil.copyfile(source / manifest.name, manifest)
    manifest.chmod(0o644)
    if platform == "linux":
        policy = Path(config["policy_path"])
        policy.write_text(json.dumps(config["policies"]))
        policy.chmod(0o644)
        target = Path("/etc/systemd/system/extension-zed.service")
        protected(target.parent)
        if target.exists() or target.is_symlink():
            raise SystemExit("Service already exists")
        shutil.copyfile(source / target.name, target)
        target.chmod(0o644)
        subprocess.run(["/usr/bin/systemctl", "daemon-reload"], check=True)
        subprocess.run(["/usr/bin/systemctl", "enable", "--now", "extension-zed.service"], check=True)
    else:
        target = Path("/Library/LaunchDaemons/com.extension_zed.limiter.plist")
        protected(target.parent)
        if target.exists() or target.is_symlink():
            raise SystemExit("Service already exists")
        shutil.copyfile(source / target.name, target)
        target.chmod(0o644)
        # Deploy the non-removable profile through MDM before using strict mode.
        subprocess.run(["/bin/launchctl", "bootstrap", "system", str(target)], check=True)
    print("Service installed. Verify mandatory policies and force-installation in chrome://policy before using strict mode.")


if __name__ == "__main__":
    install()
