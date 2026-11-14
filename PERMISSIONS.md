# Extension Zed: Permissions & Security Architecture

This document audits all permissions requested by Extension Zed, maps each permission to specific features, defines least-privilege constraints, and establishes guardrails for future capabilities.

## 1. Manifest Permissions Audit

Extension Zed declares five required permissions and requests `management` only when the user chooses the Extensions tab:

```json
"permissions": ["scripting", "activeTab", "storage", "clipboardWrite", "debugger"],
"optional_permissions": ["management"]
```

### Permission Mapping

| Permission | Justification & Features Using It | Least-Privilege Verification |
|---|---|---|
| `activeTab` | Grants temporary, user-invoked execution access to the active tab when opening the action popup. | Does **not** grant background access to tabs. Access expires on navigation to another origin or when the tab closes; screenshot capture also checks that the intended tab remains active in the focused window. |
| `scripting` | Programmatically executes on-demand content actions (`chrome.scripting.executeScript`) when the user applies design mode, scrollbar toggles, focus mode, element inspector, volume boost, or video quality. | Only used on target tabs matching active user intent. Restricted Chrome internal URLs (`chrome://`, webstore, extensions gallery) are caught and protected with safe user messaging. |
| `storage` | Persists user preferences (`chrome.storage.local`) such as dark theme, playback speed presets, section order, and mode toggles. | Synced locally only on the device; no remote transmission. Includes export/import validation. |
| `clipboardWrite` | Writes a captured PNG only when the user clicks Copy to clipboard in Screenshot preview. | No clipboard reading. A small extension-origin button embedded in the preview supports both HTTP and HTTPS pages. |
| `debugger` | Captures the full rendered page with Page.captureScreenshot; temporary viewport expansion handles locked app shells. | Chrome does not support this as an optional permission. Zed attaches only to the requested tab for full-page capture and detaches in finally, including failures. No network or cookie inspection is performed. The browser may show a debugging indicator while attached. |
| `management` (optional) | Lists and manages installed extensions from the Extensions tab. | Requested only after the user presses **Allow access** in that tab. |

### Screenshot data

Screenshot selection, stitching, preview, and download run on demand in the top frame. The background verifies a per-capture token, checks the active tab and window, and throttles viewport `captureVisibleTab` calls to Chrome's limit. Full page instead combines browser-native image strips without walking the page in scroll steps and restores any temporary viewport expansion. Session storage holds only the authorization token; images remain in memory until the preview closes or the page unloads. No image history, network upload, clipboard-read, offscreen, or downloads permission is added. The required debugger capability is used only for native full-page capture.

Edit sends the original PNG in memory through the background worker and a page-context script in miniPaint’s own tab, using its image-opening function. It does not embed the editor, compress images, or upload to an extension server. miniPaint receives the image when the user clicks Edit. PNG data URLs above 48 MiB are rejected before transfer to stay below Chrome’s message limit; Download remains available.

The clipboard frame, its script, and the shared theme/scrollbar styles are exposed as web-accessible resources. The embedded button accepts a PNG from its parent and writes only on a trusted user click. It cannot read the clipboard or request background captures. Escape also closes the preview when focus is inside the button's frame.

### Host Permissions Audit

- **Explicit `host_permissions` field**: `https://viliusle.github.io/miniPaint/*`, used only to send a screenshot to a newly opened miniPaint tab after clicking Edit.
- The manifest's static content scripts match all HTTP and HTTPS pages. Those match patterns grant access to those sites even though they are declared under `content_scripts`, not `host_permissions`.
- This broad access currently supports automatic playback-rate persistence, optional RTL mode, and saved video-quality preferences across sites. `activeTab` still scopes user-triggered page actions, but it does not limit these static content scripts.
- This broad site access can show a significant Chrome permission warning and needs a clear Store justification. Narrow the patterns or move features to optional host access only if the product is willing to ask users for site access and/or limit automatic behavior.

## 2. Content Scripts Audit

Declared in `manifest.json`:

1. `scripts/playbackRatePersist.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`.
   - Purpose: Discovers `<video>` elements and synchronizes their playback rate with the user's saved rate setting.
   - Security: Runs in isolated world, no remote code execution, no DOM writing outside of video playback rate.

2. `scripts/arabicRtlMode.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`.
   - Purpose: Inspects first letters of text elements and applies RTL direction if Arabic script is detected (when enabled in settings).
   - Security: Runs in isolated world, uses WeakMap / reversible DOM direction attributes, zero eval or remote scripts.

3. `scripts/applyVideoQuality.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`, including frames, in the page's `MAIN` world.
   - Purpose: Applies the saved video quality through YouTube's player API or the website's own player settings menu (for example Facebook, X, and Twitch), including newly started videos.
   - Security: No remote code, eval, or data collection. It only calls player methods, writes YouTube's own quality preference key, and clicks the page's visible quality controls. It never reads or transmits page content beyond player menu labels.

4. `scripts/videoQualityBridge.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`, including frames, in the isolated world.
   - Purpose: Reads the saved video-quality preference from `chrome.storage.local` and passes it to the main-world engine through a DOM attribute and custom event.
   - Security: Only exposes the user's own quality preference to the page's main world; no page data is collected or sent anywhere.

## 3. High-Risk Capabilities Guardrails

### Clearing Cookies, Cache, or Site Data
- **Current status**: Deferred / Out of scope.
- **Requirement**: If ever proposed, the feature must:
  1. Use scoped APIs (e.g. `chrome.browsingData.remove` with explicit origin boundaries).
  2. Require an explicit user confirmation modal displaying the exact scope (current site vs all sites) and data types being cleared.
  3. Never clear browser credentials without explicit dual-confirmation.

### User-Injected Scripts
- **Current status**: Not in scope.
- **Requirement**: Manifest V3 strictly forbids arbitrary remote script execution or `eval()`. Any future custom scripting feature must use declarative rule sets or sandboxed iframes without `unsafe-eval`.
