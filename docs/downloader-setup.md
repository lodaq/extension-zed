# Video downloader

The optional downloader runs the user’s installed yt-dlp through the separate, user-level native host `com.extension_zed.downloader`. It does not use the administrator site-limiter companion. Supported targets: Chrome and Brave on Linux, macOS, and Windows.

Install Python 3.10+, yt-dlp, and optionally ffmpeg yourself. Ensure `yt-dlp --version` and `ffmpeg -version` work in a terminal. The helper bundles no binaries or Python packages. On macOS it also searches `/opt/homebrew/bin` and `/usr/local/bin`; on Unix it searches `~/.local/bin`. Restart the browser after changing PATH on Windows.

Find Zed’s 32-letter ID in `chrome://extensions` or `brave://extensions`, with Developer mode enabled. From this repository run:

```sh
# Linux / macOS, no sudo
python3 downloader/install.py EXTENSION_ID
# Brave
python3 downloader/install.py EXTENSION_ID --browser brave
```

```powershell
# Windows PowerShell, no elevation
.\downloader\install-windows.ps1 -ExtensionId EXTENSION_ID
# Brave
.\downloader\install-windows.ps1 -ExtensionId EXTENSION_ID -Browser brave
```

The Windows installer compiles a small C# stdio launcher with the built-in PowerShell compiler. Use Windows PowerShell 5.1. The host manifest is generated with an absolute launcher path and exactly one allowed origin, your supplied extension ID.

Linux registration: `~/.config/google-chrome/NativeMessagingHosts/` or `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/` (respects `XDG_CONFIG_HOME`). macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` or `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`. Windows: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.extension_zed.downloader` or the corresponding `BraveSoftware\Brave-Browser` key. No system policy, service, scheduled task, or administrator permissions are involved.

In Zed choose Video downloader → Check again. A local setup guide is also bundled in the extension. Update runs `yt-dlp --update`; if that installation does not support self-update, use its package manager instead.

One operation runs at a time. Only HTTP(S) input URLs without embedded credentials are accepted. User yt-dlp config is ignored; `--no-playlist` is always set. Downloads are staged inside `~/Downloads/Zed`, sanitized, and moved to a unique final filename after success. Cancel kills yt-dlp and its subprocesses and removes the staging directory. Existing files are never overwritten. Open and Show in folder operate only on the helper’s last completed file, never on arbitrary paths from a message. Linux Show in folder opens its containing directory.

Without ffmpeg, formats are limited to single-file video and original audio. With ffmpeg, separate video/audio streams can merge and audio can convert to MP3. Sizes are unknown when yt-dlp omits them; approximate sizes are marked `~`. MP3 output size depends on conversion and is shown as unknown. Media thumbnails use a local placeholder to avoid remote image requests from the popup.

Downloads continue while the popup is closed. Closing the browser, reloading/updating the extension, or disconnecting/crashing the helper interrupts an active job; an interrupted job is reported when the popup reopens, not silently resumed. Completed state survives worker suspension in session storage. Browser restart starts a new session. Normal cancellation/disconnect cleans partials; an OS crash may leave `.zed-*` staging folders that you can remove manually.

To uninstall, close the browser, delete the generated host manifest and helper directory (`~/.local/share/extension-zed-downloader`, `~/Library/Application Support/ExtensionZedDownloader`, or `%LOCALAPPDATA%\ExtensionZedDownloader`), and on Windows remove the corresponding HKCU native-host key. Keep `Downloads/Zed` to retain downloaded files.

Validation:

```sh
python3 -m unittest discover -s downloader -p 'test_*.py'
bun run test
bun run lint
bun run build
bun run check:build
bun run test:e2e:downloader
```

Set `VITE_VIDEO_DOWNLOADER=false` when building to hide the UI and disable worker commands. The existing nativeMessaging permission is also used by the site limiter. Before distribution, review Chrome Web Store download restrictions and site terms; a successful local build does not establish publishing eligibility. Download only content you own or have permission to save. No DRM circumvention is implemented.

The downloader browser test uses a mocked native transport in a disposable profile and regenerates all nine state screenshots in `docs/design/screenshots/`. Helper tests mock subprocesses and installation paths. Windows/macOS installers still need validation on their respective systems before distribution.
