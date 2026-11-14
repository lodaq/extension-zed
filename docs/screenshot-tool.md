# Screenshot tool

Status: implemented. The latest design rules in [DESIGN.md](../DESIGN.md) supersede the original rounded, dark-only reference styling.

## Behavior

- Misc contains Selected area, Visible area, Full page, and Element, using the existing shadcn Button style and screenshot pictograms.
- Area selection remembers the last confirmed rectangle across pages and sessions, clamped to the current viewport. Press Enter to reuse it. It supports drag, arrow movement, Shift+arrow resizing, and Enter. Element selection supports pointer picking or parent/child/sibling arrow navigation and Enter.
- Full page uses `Page.captureScreenshot` clips with `captureBeyondViewport: true`, combined in an in-memory canvas. Clips are at most half the original viewport height: desktop Brave repeated pixels in viewport-sized and taller requests. The page is temporarily moved to the document origin so fixed headers are captured at the top instead of the user’s original scroll offset; the original position is restored afterward. Capture does not walk the page or its inner panel in scroll steps.
- When the document is locked and a large inner panel scrolls, the renderer temporarily uses a taller viewport to expose its content. The viewport and original scroll positions are restored before preview. This can trigger responsive reflow; it does not walk the panel in scroll steps.
- A tall selected element may still require scrolling and stitching. Hidden contents of separately scrolling elements are excluded. Picking stops at iframe and shadow hosts.
- Preview is a native modal dialog in a closed Shadow DOM, with the app's theme tokens, square corners, shared scrollbar, and immediate hover/focus states. It is at most 760px wide and `min(640px, 80dvh)` high; the image scrolls inside it.
- Copy is a focused extension-origin frame so actual PNG writing works on HTTP and HTTPS. It uses the shared theme and matching outline-button treatment. Download saves PNG. Edit opens the PNG in miniPaint’s own tab. No history, automatic download, upload, or extra settings.
- Escape cancels selection/capture or dismisses preview. If a native operation is already running, its cleanup still completes and the cancelled preview stays closed.

## Permissions and limits

- activeTab and scripting handle user-requested injection. A private session token authorizes background capture calls.
- Full-page capture needs debugger access. Chrome forbids debugger as an optional permission, so it is declared at install/update. Zed attaches to the requested tab, restores its temporary state, and detaches in finally. DevTools/another debugger can conflict; the UI reports this.
- Clipboard writing needs clipboardWrite. Clipboard reading, offscreen, and downloads permissions are not used.
- Captures are limited to 64 million pixels and 32,767 pixels per side. Copy accepts PNGs up to 24 MiB; larger images remain downloadable.
- Protected pages may reject injection/debugging. Native capture does not force lazy loading or reconstruct content removed by virtualized feeds. Infinite pages use their current rendered dimensions.
- Images remain in memory until preview closes or the page unloads. Session storage contains authorization tokens, not image history.

## Evidence

- Fixed-header regression: native offset clips reproduced a header at the original 2,400px scroll offset. Capture now starts at the document origin. An installed-extension pixel check captured one 48px header only at rows 0–47, retained the footer at rows 3,960–3,999, and restored the original scroll offset. Live plannotator.ai inspection confirmed its fixed navigation and verified origin positioning and exact scroll restoration.

- Earlier Chromium fixtures passed single-image capture, but that did not reproduce the desktop Brave failure. The live Brave popup/background/preview path reproduced the repeated bands; native clips produced the complete 1,914 × 2,594 Gemini capture with one header and the final note and footer. Unit coverage checks offset clips, a partial last strip, pixel scaling, cleanup, and size limits.
- A Gemini-style locked shell captures 2,270px, including its header and the inner panel's bottom marker, then restores its original panel position.
- Installed-extension checks verify actual PNG clipboard contents, preview rendering, both Settings themes, square corners, accessible gear navigation, and About.
- Unit checks cover authorization, permission refusal, native capture failure/detachment, viewport restoration, and image-size limits. Build, lint, and asset validation cover the packaged theme/scrollbar styles.

Sources: [Brave native extractor](https://github.com/brave/brave-core/blob/master/browser/ui/screenshot/devtools_full_page_extractor.cc), [CDP capture API](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot), [Chrome permission restrictions](https://developer.chrome.com/docs/extensions/reference/api/permissions#step_2_declare_optional_permissions_in_the_manifest).

## Edit in miniPaint

Click Edit to open miniPaint’s own website in a new tab and load the original PNG through its exposed `FileOpen.file_open_data_url_handler` function. Zed waits for a new image layer before reporting success. A separate tab preserves any previous editing session. Tab loading and image opening each have a 15-second timeout. PNG data URLs above 48 MiB must use Download and manual opening; there is no compression fallback.

The manifest declares `https://viliusle.github.io/miniPaint/*` host access, and the injected bridge checks both the origin and miniPaint project path. Images remain in memory and are not placed in URLs or stored by Zed. The editor processes them in the browser. Integration follows miniPaint’s [exposed globals](https://github.com/viliusle/miniPaint/blob/master/src/js/main.js) and [image-opening implementation](https://github.com/viliusle/miniPaint/blob/master/src/js/modules/file/open.js). This replaces the unsuccessful Photopea messaging integration.

Live Chromium verification loaded a 1920×1080 PNG and checked the image layer and canvas dimensions. First-load time varied with network conditions in that environment; a few milliseconds cannot be guaranteed for a new external website.
