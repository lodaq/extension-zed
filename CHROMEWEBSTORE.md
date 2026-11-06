# Chrome Web Store Listing — Extension Zed

> Last Updated: 2026-11-02

## Store Listing

**Extension Name** [REQUIRED]
Extension Zed

**Short Description** [REQUIRED]
Customize website colors, control playback speeds, manage scrollbars, and optimize video viewing directly on the active tab.

**Detailed Description** [REQUIRED]
Extension Zed gives you fine-grained control over your browsing experience, media playback, and page aesthetics.

Key Features:
- Quick Keyboard Shortcut: Press Alt+Z anytime to immediately open or close the popup control panel.
- Playback Speed Controls: Fine-tune audio and video speed in increments from 0.05x up to 16x with automatic persistence across site visits.
- Audio Booster: Amplify quiet page audio and video with safe volume boosting up to 20x.
- Page Colors & Curated Presets: Apply custom background and text colors to any website, or select one-click presets like Dark, High Contrast, Sepia, and Solarized.
- Scrollbar Controls: Hide main or nested scrollbars, or apply a sleek, modern unobtrusive scrollbar theme without layout shifts.
- Video Quality Control: Choose a preferred resolution (Auto through 8K) with higher/lower fallback, applied automatically to new videos on YouTube, Facebook, X, and other sites that expose a player quality menu.
- YouTube Enhancement: Toggle distraction-free Focus Mode, hide progress bars and bottom controls, hide video duration, enable half-screen multitasking layouts, and save timestamp bookmarks.
- Page Inspector & Timestamps: Inspect publication dates and last-modified timestamps on any web page.
- Arabic RTL Mode: Instantly adjust text direction and alignment for Arabic and RTL content.
- Built-in Password Generator: Generate secure passwords with customizable character sets and length.
- Full Data Ownership: Backup, export, or import all your settings with a single click, or reset everything to defaults anytime.

How to Use:
1. Press Alt+Z or click the Extension Zed icon in your browser toolbar to open the control panel.
2. Select your desired speed, color palette, or layout option.
3. Changes apply instantly to your active page and your preferences are automatically remembered.

Privacy & Trust:
Extension Zed operates entirely on your device. We do not track your browsing history, run background analytics, or transmit any data to external servers. Your settings and custom color overrides remain private and stored exclusively in your browser.

Support & Feedback:
For documentation, issue reports, or feature requests, visit the project repository on GitHub.

**Category** [REQUIRED]
Accessibility

**Single Purpose** [REQUIRED]
Customize website colors, control playback speeds, manage scrollbars, and optimize video viewing directly on the active tab.

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
- Screenshot 1: Shows the Misc tab open with color presets, playback speed controller, and custom scrollbar options.
- Screenshot 2: Shows YouTube Focus Mode active on a YouTube watch page with hidden controls and timestamp markers.
- Screenshot 3: Shows Settings tab with theme toggling, data export/import, and privacy disclosure.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Needed to persist user preferences such as playback speed presets, theme mode, and site-specific color customizations locally on the user's browser. |
| `activeTab` | permissions | Needed to access the current active page only when the user invokes an action from the popup, such as applying colors, scrollbar styles, or YouTube modes. |
| `scripting` | permissions | Needed to dynamically apply and reset CSS styling rules, playback rate updates, and element inspection on the active tab upon user request. |
| `content_scripts` (`https://*/*`, `http://*/*`) | host_permissions | Required to persist user-selected playback speeds, optional RTL text direction, and the preferred video quality across page reloads and navigations on visited web pages. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

Extension Zed does not collect, log, or transmit any personally identifiable information, browsing history, user activity, or content. All settings are stored strictly in local browser storage (`chrome.storage.local`).

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
`https://github.com/sebaq/extension-zed/blob/main/PRIVACY.md`

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
Extension Zed Team

**Contact Email** [REQUIRED]
support@extension-zed.dev

**Homepage URL** [RECOMMENDED]
`https://github.com/sebaq/extension-zed`

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-11-02 | Initial release with Misc controls, YouTube focus mode & markers, theme presets, Alt+Z popup toggle, and export/import settings. | Draft |

## Review Notes

### Known Issues / Limitations
- Media playback rate and volume boosting require HTML5 audio/video elements on the page.
- Chrome internal pages (`chrome://`, web store) cannot be scripted due to Chrome security policy; informative feedback is displayed to the user when attempted.
