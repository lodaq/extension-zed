# Video downloader

The optional downloader runs the user’s installed yt-dlp through the separate, user-level native host `com.extension_zed.downloader`. It does not use the administrator site-limiter companion. Supported targets: Chrome and Brave on Linux, macOS, and Windows.

Install Extension Zed in Chrome or Brave, then open **Misc → Video downloader → Setup commands**. Copy the command for your OS and run it in your terminal as your normal user. It installs missing Python 3.10+, yt-dlp, and FFmpeg packages, then registers the bundled helper. Setup uses apt, pacman, Homebrew on macOS, or WinGet on Windows. Install Homebrew or WinGet first if your OS requires it. [Setup commands](../public/downloader-setup.html)

The installer discovers Zed in the standard Chrome and Brave profile locations and registers only detected Zed extension IDs. It reads Preferences and Secure Preferences without modifying them. No ID copying or browser selection is needed. For a custom profile, append the extension ID and `--browser brave` (or `--browser chrome`) to the copied Linux or macOS command. In PowerShell, append the ID followed by `'--browser' 'brave'` (or `'--browser' 'chrome'`). On Windows, the installer compiles a small C# stdio launcher with Windows PowerShell. Host manifests use absolute launcher paths and explicit allowed origins without wildcards.


Linux registration: `~/.config/google-chrome/NativeMessagingHosts/` or `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/` (respects `XDG_CONFIG_HOME`). macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` or `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`. Windows: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.extension_zed.downloader` or the corresponding `BraveSoftware\Brave-Browser` key. No system policy, service, scheduled task, or administrator permissions are involved.

Open Video downloader in Zed; it checks the helper automatically. If the screen was already open during installation, choose Check again. A local setup guide is also bundled in the extension. Update runs `yt-dlp --update`; if that installation does not support self-update, use its package manager instead.

One operation runs at a time. Only HTTP(S) input URLs without embedded credentials are accepted. User yt-dlp config is ignored; `--no-playlist` is always set. Choose the save folder in the downloader before starting; it defaults to `~/Downloads/Zed`, accepts absolute paths or paths starting with `~`, and is created when needed. Downloads are staged inside that folder, sanitized, and moved to the requested file name after success. A short suffix is added when that name already exists, so existing files are never overwritten. Cancel kills yt-dlp and its subprocesses and removes the staging directory. Open and Show in folder operate only on the helper’s last completed file, never on arbitrary paths from a message. Linux Show in folder opens its containing directory.

Without ffmpeg, formats are limited to single-file video and original audio. With ffmpeg, separate video/audio streams can merge and audio can convert to MP3. Sizes are unknown when yt-dlp omits them; approximate sizes are marked `~`. MP3 output size depends on conversion and is shown as unknown. Media thumbnails use a local placeholder to avoid remote image requests from the popup.

Downloads continue while the popup is closed. Closing the browser, reloading/updating the extension, or disconnecting/crashing the helper interrupts an active job; an interrupted job is reported when the popup reopens, not silently resumed. Completed state survives worker suspension in session storage. Browser restart starts a new session. Normal cancellation/disconnect cleans partials; an OS crash may leave `.zed-*` staging folders that you can remove manually.

To uninstall, close the browser, delete the generated host manifest and helper directory (`~/.local/share/extension-zed-downloader`, `~/Library/Application Support/ExtensionZedDownloader`, or `%LOCALAPPDATA%\ExtensionZedDownloader`), and on Windows remove the corresponding HKCU native-host key. Keep your chosen download folder to retain downloaded files.

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

The downloader browser test uses a mocked native transport in a disposable profile. Helper tests mock subprocesses and installation paths. Windows/macOS installers still need validation on their respective systems before distribution.
