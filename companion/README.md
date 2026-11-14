# Administrator companion (not yet production validated)

This companion keeps timed website blocks and daily foreground-usage counters outside the browser profile. It targets **managed Google Chrome on Linux, Windows and macOS**. Other browsers, portable browsers, VPNs, anonymizing websites, arbitrary local programs and booting another OS are outside this browser-management boundary. A device administrator must restrict those paths separately if the goal is preventing access across the entire device.

Do not describe the feature as tamper-proof. The code and installers are prepared, but Windows/macOS installation and managed-browser end-to-end enforcement have not been tested here. Do not deploy to an end user until the acceptance checks below pass on that OS. No system service, policies or account restrictions are installed by building the extension.

## Required deployment

- The everyday account must be a **standard account**, without administrator credentials or permission to edit the system clock, service, Python installation, browser binaries, installation directory or policy files. A separate administrator retains recovery access.
- Install a stable, **signed, force-installed** copy of Zed. An unpacked developer copy is deliberately rejected for system protection. This repository currently has no public Chrome Web Store release: distribute a signed CRX and HTTPS update manifest through your managed environment, or publish a release separately. This implementation does not publish anything. Windows/macOS off-store force installation may require enterprise enrollment/domain management; verify your deployment supports it.
- Use one managed Chrome profile. Remove pre-existing extra profiles before applying the policy that prevents adding profiles; this policy does not remove existing ones. Guest and incognito are disabled by the bundle. Multiple independent profiles/devices do not share an authenticated foreground sensor.
- Apply all mandatory policy settings. The bundle force-installs Zed, disables developer mode, developer tools and remote debugging, rejects user-level native hosts, and allows only Zed's native host. These restrictions affect the managed Chrome installation, not just the popup. This is an administrator-managed browser configuration, not an ordinary consumer extension install.
- Install administrator-owned Python 3.13+ for all users. The service uses only Python's standard library. Do not use a Python runtime, library path or browser executable writable by the standard account. Linux defaults to `/usr/bin/python3`; macOS and Windows defaults are examples and must match a protected installed runtime.
- Existing Chrome policies must be reviewed for conflicts, especially `URLAllowlist` (which can override blocks), `URLBlocklist`, cloud-policy precedence and extension management. The installers refuse obvious local policy conflicts; they cannot audit every MDM/cloud setting.

## Generate an install bundle

From the repository root, with the actual deployed extension ID:

```sh
python3 companion/install.py --extension-id YOUR_32_CHARACTER_EXTENSION_ID --output artifacts/zed-companion --update-url https://YOUR_DEPLOYMENT/updates.xml
```

For a published Chrome Web Store release, omit `--update-url`. For custom Python locations, use `--python-linux`, `--python-macos`, and/or `--python-windows` with absolute administrator-controlled executable paths. Generation only writes the output bundle. It does not install, elevate or modify this computer's settings.

The bundle contains the service source, native host launcher, exact-origin native host manifests, systemd/launchd definitions, a Windows SYSTEM scheduled task installer, and mandatory browser policies.

### Linux

Review the generated files. As administrator, run `python3 install-unix.py` from the bundle. It creates root-owned program/configuration files, a private state file, a protected Unix socket directory, machine Chrome policies and an automatically restarted root systemd service. Clients can connect to the socket but cannot delete it or modify its directory. Usage requests are checked against kernel peer credentials and the administrator-configured browser process lineage.

The default browser executable is `/opt/google/chrome/chrome`. If your managed Chrome uses another administrator-controlled path, adjust `linux/config.json` **before installation**. The installer rejects symlinks or group/world-writable installation paths. It requires a systemd-based distribution; other service managers need an administrator-reviewed service definition.

### Windows

Review the generated files. In elevated **Windows PowerShell 5.1**, run `install-windows.ps1` from the bundle. It uses an administrator-installed all-users Python, builds the small C# native launcher with the system .NET compiler, registers the native host under HKLM, and starts a SYSTEM task at boot with restart enabled. Program files are read/execute-only for ordinary users. The state and task are restricted to SYSTEM/Administrators.

IPC is a local named pipe with remote clients rejected. Authenticated users may send/receive messages but cannot create alternate pipe-server instances. The service verifies the peer process, installed launcher, and browser ancestor. A pre-existing conflicting pipe causes startup to fail instead of attaching to an untrusted server. Test both native messaging and service restart after installation.

### macOS

Deploy `macos/extension-zed.mobileconfig` using MDM as a **non-removable system configuration profile**. Installing an ordinary removable profile or setting recommended defaults is insufficient. Then, as administrator, run `python3 install-unix.py` from the bundle. It installs a root LaunchDaemon, native host and protected state. The daemon maintains URLBlocklist in machine managed preferences; the administrator must verify that these dynamic values are accepted, mandatory, and not overwritten by their MDM agent.

If an existing managed preference file conflicts with this bundle or already owns URL blocking, the installer stops. A matching mandatory configuration is preserved; an MDM administrator must delegate ownership of the dynamic URLBlocklist and verify that MDM refreshes do not replace it. macOS support remains unvalidated until real MDM and browser acceptance checks pass. Do not treat generation of the `.mobileconfig` as proof that restrictions are applied.

## Rule and counter behavior

The service is authoritative. Its client protocol has only `status`, `add`, and `report`. There is no remove, reset, replace, shorten, pause or unblock operation. A second rule for an already-controlled domain is rejected. Changing a new-rule protection checkbox cannot change an existing rule. Extension settings import/reset cannot change the service's state. Protected and browser-only rules are labeled separately.

Timed rules use absolute deadlines and are removed automatically after expiry. The service writes mandatory machine `URLBlocklist` policies; these remain in force independently of the extension process. Domains include subdomains. Rule inputs accept public domain names, reject policy metacharacters, credentials, IP addresses and local hostnames. Browser policy refresh and OS scheduling can delay expiry/cutoff; no exact millisecond guarantee is made. The extension also mirrors the service's blocks into persistent network rules and moves already-open blocked pages to the blocked notice.

For daily rules, the mandatory extension reports the foreground tab when focus, navigation or idle state changes and at approximately 30-second intervals. Only the current focused tab counts; a 60-second computer-idle threshold applies. The service computes elapsed time using its own clock and stores the counter; it does not accept client-supplied usage totals, reset dates or deadlines. It records the current hostname, not page paths, query strings, titles, content, or a browsing-history log.

**Fail-closed daily behavior:** a missing report for more than 75 seconds, or a service restart, locks daily sites until midnight UTC. Closing Chrome, sleeping the device or delayed browser alarms can trigger this. A later heartbeat cannot clear that day's lock. Midnight UTC resets the daily quota (a fixed timezone prevents users changing the OS timezone to reset allowances early), provided reporting is healthy; when reporting remains absent, the new day's sites remain locked. This deliberately favors enforcement over preserving unused minutes during outages. A time rollback never releases a block or resets the counter. Administrator intervention is still possible and is not exposed in the user interface.

The native host does not run with administrator rights. It reads one size-bounded JSON message over Chrome's native messaging framing and relays it over OS IPC. There is no listening HTTP API, shared secret in extension storage, shell command from a website, downloaded code or unprivileged path that can replace the rule database. User-level native hosts are disabled by policy. The service verifies process ancestry using kernel process metadata; this is a browser-management boundary, not protection against compromised browsers, kernel exploits, arbitrary process injection, or another administrator. Strong resistance to arbitrary local programs also requires OS application control and a device/network policy.

## Acceptance checks before enabling for a real user

1. Verify all policies are **mandatory**, have status OK, and come from the intended machine/MDM source in `chrome://policy`. Confirm no `URLAllowlist`, cloud policy or another extension overrides the restrictions.
2. Verify Zed shows `Installed by enterprise policy`, with no usable disable/remove controls. Confirm developer mode, extension developer tools, remote debugging, guest, incognito and new profiles are unavailable. In the popup, system protection must report the companion connection; a failed connection must not create a browser-only substitute.
3. From the standard account, attempt to change state/program files, stop/delete/reconfigure the task/service, edit policy/registry/profile values, and invoke IPC directly from an unrelated process. Each must fail. Test that manually launching the native launcher also fails its browser-ancestry check.
4. Create a short timed block on a safe test domain. Verify the apex and a subdomain block, including already-open tabs. Restart Chrome and the OS; verify the block persists and later expires automatically. Force a browser/worker exit, test after browser restart, and verify the policy persists even with the extension process absent.
5. Create a short daily rule. Compare foreground/background windows, another tab, idle time and focus changes. Exhaust it, reset/import extension settings and reconnect/restart the bridge; none may restore access that day. Stop reporting for 75 seconds and confirm it stays blocked after reconnect. Test midnight UTC, OS timezone changes, clock rollback, service crash/restart, and disk/policy write failures.
6. Test all allowed launch modes and existing profiles. Restrict alternate browsers, proxies, VPNs and device/network escape routes administratively if you need a device-wide guarantee. Repeat the acceptance checks independently on Windows, macOS and Linux.

Administrator removal/recovery is intentionally an administrator task. There is no standard-user uninstall or early-unblock helper. Keep the root-owned state and existing policy until the administrator has reviewed active rules; installers refuse automatic replacement of an existing installation.

## Local verification

```sh
python3 -m unittest discover -s companion -p 'test_*.py'
bun run test
bun run lint
bun run build
```

Unit tests use temporary files and in-memory policy publishers; they never install services or alter actual browser/OS policy.
