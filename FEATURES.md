# Extension Zed features

This inventory describes implemented capabilities. See [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for remaining work and future ideas.

## Popup

- Keyboard shortcut `Alt+Z` immediately toggles the popup control panel from anywhere in Chrome.
- Misc, Extensions, YouTube, and Settings tabs; the last selected tab is saved locally.
- Scrollable 400 × 600 layout with saved dark/light appearance; dark is the default.
- The first HTML frame already contains the tab bar and collapsed Misc section headers at the final 400 × 600 size, so the popup does not show a placeholder or resize while settings load.
- Page actions show success/error toasts. Action failures show a per-tab `!` badge and error tooltip; a successful action clears them.
- Saved preferences differ from applied page state. Application failure retains the preference and reports the failure. Storage failure prevents application.

Sources: `src/App.tsx`, `src/background.ts`, `src/lib/withActiveTab.ts`, `public/manifest.json`.

## Extensions tab

| Control | Behavior |
| --- | --- |
| Extension row | Lists every installed extension alphabetically, with icon, name, and version. Apps and themes are excluded. Clicking the row toggles the extension. Disabled extensions are dimmed. |
| On/off switch | Enables or disables the extension through `chrome.management.setEnabled`. Chrome may show its own confirmation when re-enabling an extension with escalated permissions. |
| Reload | Disables and immediately re-enables the extension. Unpacked extensions re-read their code from disk; store extensions apply an update Chrome has already downloaded. Chrome has no public API to force an update check for another extension. |
| Uninstall | Calls `chrome.management.uninstall`. Chrome always shows its own confirmation dialog when one extension uninstalls another; a dismissed dialog is treated as a cancellation, not an error. |
| Guarded rows | Zed itself, policy-managed extensions (`mayDisable: false`), and disabled extensions that Chrome will not re-enable show disabled controls and, where relevant, a policy label. |

The list refreshes after every action and subscribes to `chrome.management` install/enable/disable/uninstall events while the popup is open. Failures use the same success/error toast pattern as page actions. No update check is faked: the reload control only restarts the extension.

Sources: `src/components/ExtensionsTab.tsx`, `src/lib/extensionManager.ts`, `public/manifest.json`.

## Misc tab

Each section can be expanded or collapsed with its heading using the mouse, Enter, or Space. Sections default to collapsed; their open/closed state is saved locally and included in settings backups. Drag the handle inside the left side of a section’s title row to reorder it; the insertion line shows its destination. Keyboard users can focus a handle and press Up/Down to move that section. The order is saved locally and included in settings backups; invalid saved orders fall back to the default.

| Feature | Behavior | Persistence/reset |
| --- | --- | --- |
| Password generator | Length 4–128 (default 20); uppercase, lowercase, numbers, and symbols; regenerate and copy | Cryptographic randomness; includes each enabled type. Passwords/options are session-only and excluded from settings backups. Clipboard is changed only on Copy |
| Video speed | 0.1–10× in 0.1× steps; slower/faster, normal, and double-speed controls | One global local preference; applies to new videos, metadata reloads, and playback starts; unsupported rates on one video do not block others. Facebook speed uses its native controller to keep player state consistent instead of writing media rates directly |
| Player overrides | Website player speed changes remain until playback starts again or metadata reloads | Do not change saved speed; metadata reloads, playback starts, new media, or explicit Zed actions restore saved speed, including repeated same-speed actions |
| Volume boost | Audio/video gain from 100% to 2000%, in steps of 10% | Global preference; activated on the current page and then newly inserted media. Reset changes gain to 100%, not the Web Audio routing |
| Video quality | Preferred video resolution (Auto, 4320p down to 144p). If preferred resolution is unavailable for the current video, two selectable fallback options: (1) Prefer higher quality, or (2) Prefer lower quality. Concise single-panel controls | Global preference; saved across sessions and applied through player APIs: Facebook and Instagram’s native React player controller, TikTok’s native player, YouTube, Video.js quality levels, Shaka UI, and Hls.js instances exposed as video.hls. Auto restores adaptive selection. No clicks, pointer events, keyboard input, or menu automation. TikTok switches through its native stream reload API, preserving playback position, pause state, speed, and volume; switching may briefly buffer. Unsupported players keep the site’s quality selection and Apply reports that no controllable player is ready. Apply reports the selected quality, including a fallback such as 270p when a Reel does not offer 144p. Facebook, Instagram, and TikTok controller discovery uses private React refs, with a bounded root-tree lookup on Facebook and Instagram when video elements have no direct refs, and may need updating if those sites change them. Apply prefers the playing video over a preloaded next video; TikTok applies only to the active or visible paused video |
| Background colors | Color picker overrides backgrounds and suppresses background images | Saved per HTTP(S) origin; applied on command, not automatically after reload; independent reset |
| Text colors | Color picker overrides page text | Saved per origin; independent reset and combined color reset |
| Main scrollbar | Hide/reset the document scrollbar | Page-local injected style |
| All scrollbars | Hide/reset document and nested scrollbars | Separate page-local style; reset both if both were applied |
| Inspect mode | Hover overlay shows element identity, position, dimensions, box model, colors, layout, and typography | Global preference, applied on command; Escape disables active inspect overlays listening for that change |
| Design mode | Toggle temporary document editing | Global preference, applied on command. Off stops editing but does not undo edits; reload restores the website document |
| Arabic RTL mode | Arabic-leading text gets RTL direction/right alignment; observes inserted elements and skips explicit `dir` | Global preference read on HTTP(S) page load. Disable restores recorded alignment |

Speed normalizes before stepping: `1.36` becomes `1.4`, then Faster selects `1.5`. Speed targets videos, not audio-only elements.

The password generator automatically generates a new password when an option changes. Each enabled character type appears at least once; disabling every type clears the output and disables copying. Lengths must be whole numbers from 4–128. It uses `crypto.getRandomValues` with rejection sampling and a cryptographic shuffle, with no network requests or password storage. Sources: `src/components/PasswordGenerator.tsx`, `src/lib/passwordGenerator.ts`.

Sources: `src/components/MiscTab.tsx`, `src/components/VideoQualitySection.tsx`, `src/lib/videoQuality.ts`, `src/lib/playbackPresets.ts`, `src/lib/playback.ts`, `src/lib/pageActions.ts`, `public/scripts/`.

## YouTube tab

| Feature | Behavior/reset |
| --- | --- |
| Focus mode | Expands the player to the viewport and hides surrounding content. Suspends sizing during fullscreen; toggle off removes Zed's layout changes. Requires a YouTube player |
| Hide progress bar | Hides progress, time, and chapters; toggle off removes its style |
| Hide controls | Hides bottom controls; toggle off removes its style |
| Hide duration | Hides only the duration/time remaining while keeping the progress bar clickable |
| Half-screen layout | Constrains the player to a clean half-screen viewport layout for multitasking |
| Timestamp markers | Bookmark key moments with label and timestamp, jump to any bookmark, export/import markers |

Preferences are global and saved locally.

Sources: `src/components/YoutubeFocusMode.tsx`, `src/components/YoutubeMarkers.tsx`, `public/scripts/youtube*.js`.

## Settings transfer

- Export recognized preferences and per-origin colors to a dated version-1 JSON backup.
- Import version-1 JSON by merging recognized values; omitted settings remain unchanged, unknown keys are ignored.
- Reject unsupported versions and invalid recognized modes, booleans, ranges, tabs, origins, or colors before writing. Colors must be empty reset values or six-digit hex colors.
- Import updates preferences, not every page's applied state. Changed speed and quality reach running media scripts; use page controls to apply other imported preferences.
- Affected readers safely default malformed stored values. Export reports invalid recognized stored values instead of producing an unusable backup.

Sources: `src/lib/settings.ts`, `src/components/SettingsTab.tsx`, `src/lib/useStoredValue.ts`.

## Permissions and limitations

- Manifest V3; required `scripting`, `activeTab`, and `storage` permissions. Optional `management` permission is requested only when the Extensions tab is used. No new host permissions or backend.
- Playback and RTL content scripts match HTTP(S) pages and all frames. The video-quality engine and its settings bridge also match HTTP(S) pages and all frames. On-demand actions attempt all frames where appropriate, with main-frame fallback. Inaccessible frames may remain unchanged.
- Chrome internal pages, the Chrome Web Store, and other protected documents generally reject injection.
- Preferences are local; no account or cloud sync. Exported per-origin colors reveal saved website origins, so backups are personal data.
- Closed shadow roots and unusual media pipelines may need site-specific support. Reused MediaSource URLs without normal loading events can hide a media-item change.
- Web Audio amplification can fail for cross-origin or already-connected media and autoplay restrictions. High gain can distort audio.
