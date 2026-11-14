# Chrome Web Store Listing — Extension Zed

> Last Updated: 2026-11-14

## Store Listing

**Extension Name** [REQUIRED]
Extension Zed

**Short Description** [REQUIRED]
Control playback speeds, amplify audio, manage scrollbars, and optimize video viewing directly on the active tab.

**Detailed Description** [REQUIRED]
Extension Zed gives you fine-grained control over your browsing experience, media playback, and page layout.

Key Features:
- Quick Keyboard Shortcut: Press Alt+Z anytime to immediately open or close the popup control panel.
- Playback Speed Controls: Fine-tune audio and video speed in increments from 0.05x up to 16x with automatic persistence across site visits.
- Audio Booster: Amplify quiet page audio and video with safe volume boosting up to 20x.
- Scrollbar Controls: Hide main or nested scrollbars, or apply a sleek, modern unobtrusive scrollbar theme without layout shifts.
- Video Quality Control: Choose a preferred resolution (Auto through 8K) with higher/lower fallback, applied automatically to new videos on YouTube, Facebook, X, and other sites that expose a player quality menu.
- YouTube Enhancement: Toggle distraction-free Focus Mode, hide progress bars and bottom controls, hide video duration, and enable half-screen multitasking layouts.
- Arabic RTL Mode: Instantly adjust text direction and alignment for Arabic and RTL content.
- Built-in Password Generator: Generate secure passwords with customizable character sets and length.
- Full Data Ownership: Backup, export, or import all your settings with a single click, or reset everything to defaults anytime.

How to Use:
1. Press Alt+Z or click the Extension Zed icon in your browser toolbar to open the control panel.
2. Select your desired speed, audio boost, or layout option.
3. Changes apply instantly to your active page and your preferences are automatically remembered.

Privacy & Trust:
Extension Zed operates entirely on your device. We do not track your browsing history, run background analytics, or transmit any data to external servers. Your settings remain private and stored exclusively in your browser.

Support & Feedback:
For documentation, issue reports, or feature requests, visit the project repository on GitHub.

**Category** [REQUIRED]
Accessibility

**Single Purpose** [REQUIRED]
Control playback speeds, amplify audio, manage scrollbars, and optimize video viewing directly on the active tab.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `public/images/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | `screenshot-misc-tab.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `screenshot-youtube-tab.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `screenshot-settings-tab.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `promo-tile-small.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | `promo-tile-marquee.png` |

### Screenshot Notes
- Screenshot 1: Shows the Misc tab open with playback speed controller, volume booster, and custom scrollbar options.
- Screenshot 2: Shows YouTube Focus Mode active on a YouTube watch page with hidden controls and layout options.
- Screenshot 3: Refresh to show the Settings tab with Extension Zed refresh, browser settings, and errors controls alongside theme toggling, data export/import, and privacy disclosure.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Needed to persist user preferences (playback speed presets, theme mode, scrollbar settings) and user-saved items (selected text, bookmarked links/reels) locally in browser storage. |
| `activeTab` | permissions | Needed to access the current active page only when the user invokes an action from the popup, such as applying scrollbar styles, volume boost, or YouTube modes. |
| `scripting` | permissions | Needed to dynamically apply and reset CSS styling rules, playback rate updates, and element inspection on the active tab upon user request. |
| `clipboardWrite` | permissions | Needed to copy captured screenshots or saved item URLs to the clipboard upon explicit user action. |
| `debugger` | permissions | Needed for Page.captureScreenshot to capture high-fidelity full-page screenshots without scrolling distortion. |
| `tabs` | permissions | Needed to query active tab URL and navigation state for tab actions, link shortcuts, and contextual saving. |
| `contextMenus` | permissions | Needed to provide "Save text to Zed" and "Save link to Zed" context menu options on right-click. |
| `management` | optional_permissions | Requested only when the user opens the Extensions tab; needed to list installed extensions and let the user enable, disable, reload, or uninstall them. |
| `content_scripts` / `host_permissions` (`https://*/*`, `http://*/*`) | host_permissions | Required to persist user-selected playback speeds, optional RTL text direction, preferred video quality, keyboard shortcuts, and in-page save indicators across page reloads and navigations on visited web pages. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

Extension Zed does not collect, log, or transmit any personally identifiable information, browsing history, user activity, or content to external servers. All user preferences, custom shortcuts, and saved items (selected text snippets and media links saved by the user) are stored strictly on the user's device in local browser storage (`chrome.storage.local`).

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
`https://github.com/lodaq/extension-zed/blob/main/PRIVACY.md`

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
Extension Zed Team

**Contact Email** [REQUIRED]
support@extension-zed.dev

**Homepage URL** [RECOMMENDED]
`https://github.com/lodaq/extension-zed`

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| Unreleased | 2026-11-14 | Show saved reels, posts, and videos in Links, including existing saves. Hide Extension Zed from extension lists; move its refresh and browser settings controls into Settings and add an errors shortcut. Handle invalidated shortcut handlers, deferred startup, and stylesheet callbacks; stop stale Save-to-Zed scripts after extension reloads. | Draft |
| 2.0.0 | 2026-11-08 | First Chrome Web Store submission, including the Extensions manager and updated popup navigation. | Draft |
| 1.0.0 | 2026-11-02 | Initial release with Misc controls, YouTube focus mode & markers, Alt+Z popup toggle, and export/import settings. | Draft |

## Publishing

### First release

1. Register a developer account in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Google requires a one-time registration fee and two-step verification.
2. Run `bun install`, `bun run test`, `bun run lint`, and `bun run package:store`. The ZIP is written to `artifacts/extension-zed-v2.0.0.zip`, with `manifest.json` at its root.
3. In the dashboard, choose **Add new item** and upload that ZIP.
4. Complete the Store Listing, Privacy, and Distribution sections. Add store screenshots and verify the single-purpose, permission, and data-use disclosures.
5. Submit the item for review. Google reviews it before it becomes available in the Store.

Review the uploaded manifest before the first submission. The Store listing draft in this file still needs final screenshots and a verified support contact before submission.

### Later updates

The GitHub Actions workflow runs tests, lint, and packaging on `main`. Once CWS publishing is configured, it compares the manifest version with the published Store version and submits only a newer version.

The first submission must be uploaded and submitted from the dashboard. After the item exists in the dashboard, enable the Chrome Web Store API, create OAuth credentials and a refresh token for the publishing Google account, then copy `.env.cws.example` to the ignored `.env.local` and fill in the five values. Check the target repository before uploading secrets:

```sh
bun scripts/upload-cws-secrets.mjs --dry-run
bun scripts/upload-cws-secrets.mjs
bun run cws:status -- --env-file .env.local
```

The second command requires `gh auth login`. Never commit `.env.local` or paste its secret values into chat. The workflow skips its publish step until the CWS client ID is configured.

## Review Notes

### Known Issues / Limitations
- Media playback rate and volume boosting require HTML5 audio/video elements on the page.
- Chrome internal pages (`chrome://`, web store) cannot be scripted due to Chrome security policy; informative feedback is displayed to the user when attempted.

### Administrator site limiter integration (unreleased)

Site limiter adds timed website blocks and daily foreground usage limits. Browser-only rules are labeled separately. Administrator protection additionally requires a signed, force-installed browser component plus an independently installed system companion; an ordinary store/unpacked installation alone does not supply this protection. Deployment and OS acceptance tests are documented in `companion/README.md` and are not yet complete on Windows/macOS. Refresh Misc screenshots before release.

Additional permission justifications:

- **alarms:** automatically expire timed website blocks and update daily allowance counters.
- **idle:** stop counting foreground website usage when the computer is idle.
- **declarativeNetRequest:** prevent navigation to websites with active blocks, including across browser restarts.
- **nativeMessaging:** communicate locally with the separately administrator-installed site limiter to store protected rules and daily foreground usage counters. No data is transmitted to a remote service. Ordinary installations cannot silently activate administrator protection.

Privacy disclosure: the companion receives foreground URLs only over local native messaging and retains only the current hostname, configured website domains, rule deadlines and daily usage counters. Paths, search terms, page titles and content are not retained. Settings export/reset does not include or remove administrator-owned rules. Update any published privacy policy and Chrome Web Store data-use disclosures before releasing this capability.
