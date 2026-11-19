# Extension Zed

A Chrome/Brave Manifest V3 toolbox for screenshots, media controls, page tools, saved content, and extension management. Open it from the toolbar or **Alt+Z**.

## Build and install

Requires Bun 1.4.4:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run build
```

Open `chrome://extensions` or `brave://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`. Keep that folder in place. After rebuilding, reload the extension and refresh existing web pages.

## Features

- **Media:** playback speed from 0.1×–10×, volume boost from 100%–2000%, and preferred video quality from Auto/144p–8K with higher/lower fallback. Support depends on the site's player; unsupported players retain their own settings.
- **Screenshots:** selected area, visible area, full page, or element; preview, copy PNG, download, or explicitly send the image to miniPaint for editing. Full-page capture uses temporary debugger access, native image strips, and guaranteed viewport/scroll restoration. It does not scroll through the page. Image-size limits apply; DevTools can conflict with capture.
- **Page tools:** inspect element details, temporarily edit page content, adjust Arabic-leading text to RTL, apply grayscale, and restyle/hide scrollbars. Reloading restores website content edited in design mode.
- **YouTube:** focus/half-screen layouts and independent progress, player duration, thumbnail timestamp, all-timestamp, and control hiding. All-timestamp hiding covers the player, thumbnails, comments/descriptions, chapters, and transcripts. Saved YouTube styles are reapplied before first paint on every page load.
- **Passwords:** cryptographic generation, 4–128 characters, selectable character groups, and explicit copy. Generated passwords are not saved or backed up.
- **Video downloader:** choose the save folder, yt-dlp video quality and audio formats, rename the file before downloading, and merge or convert to MP3 when ffmpeg is installed. Requires the one-time [native helper setup](docs/downloader-setup.md).
- **Extensions:** optional management access; list, enable/disable, reload, open settings, and uninstall other extensions. Browser policy restrictions are respected.
- **Links/Saved:** save tabs and media links, collect selected text through the context menu, toggle in-page save buttons, organize saved items into collections, and open/copy/remove saved items. New saves appear in All saved; the in-page picker lets you move them to a collection. Create collections in Saved. Opening a link from Links removes it after the new tab opens.
- **Shortcuts/settings:** configurable keyboard shortcuts, keyboard hint modes (always, F shortcut, or off), tool order, remembered popup views/scroll, theme, validated JSON preference export/merge-import, and reset.
- **Site limiter:** timed domain/subdomain blocks and daily foreground-usage limits, with no early-unblock control. Browser-only rules require Zed to remain enabled. Optional system protection requires the separate [administrator companion](companion/README.md).

## Development

```sh
bun run test
bun run lint
bun run build
bun run check:build
python3 -m unittest discover -s companion -p 'test_*.py'
bun run test:e2e
bun run test:e2e:video-quality
bun run test:e2e:downloader
python3 -m unittest discover -s downloader
```

Browser tests use isolated temporary profiles, the built extension, and the pinned Chrome DevTools MCP runner through `npx` (Node.js/npm required). Set `CHROME_PATH` to your Chrome/Chromium executable. Test profiles are removed automatically. Build/test checks do not install the companion or change OS policy.

`src/` contains the popup, worker, content modules, and unit tests. `public/` contains the manifest, injected scripts, and packaged assets. `companion/` contains the optional system blocker and its installers. UI rules are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

Before release, run `bun audit --production` and review `bun audit` for development-tool advisories. Upgrade compatible dependencies deliberately; do not force major updates merely to clear an audit.

## Privacy and access

Preferences and saved text/URLs remain in local browser storage; there is no account, cloud sync, or telemetry. Backups can include saved links. Screenshots stay in memory until closed; clicking **Edit** explicitly transfers the image to miniPaint's tab. The optional companion receives foreground URLs locally and retains hostnames, rule deadlines, and daily counters, not page content or URL paths.

HTTP(S) site access supports automatic playback, quality, RTL, shortcuts, and save buttons. `activeTab`/`scripting` run requested page actions; `storage` persists local data; `clipboardWrite` copies on request; `debugger` captures full pages; `tabs` coordinates navigation; `contextMenus` saves selections/links; `alarms`/`idle` count usage and expire rules; `declarativeNetRequest` blocks limited sites; `nativeMessaging` connects the local companion. `management` is optional and requested from Extensions. Protected browser pages block page actions.

## Packaging and publishing

```sh
bun run package:store
```

This creates `artifacts/extension-zed-v<version>.zip` without uploading it. Keep package.json and public/manifest.json versions equal. Complete the initial store submission manually, including accurate feature/privacy disclosures, verified contact details, and store-sized screenshots.

For subsequent updates, `.github/workflows/chrome-web-store.yml` tests and packages changes on `main`. It submits a newer version only when CWS credentials are configured. Copy `.env.cws.example` to ignored `.env.local`, fill the five CWS values, then use:

```sh
bun scripts/upload-cws-secrets.mjs --dry-run
bun scripts/upload-cws-secrets.mjs
bun run cws:status -- --env-file .env.local
```

Secret upload requires authenticated `gh`; check the target repository first. Never commit `.env.local`. Publishing and administrator installation require explicit authorization; neither is part of a normal local build.
