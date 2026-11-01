# Extension Zed features

This inventory describes implemented capabilities. See [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for remaining work and future ideas.

## Popup

- Misc, YouTube, Shortcuts, and Settings tabs; the last selected tab is saved locally.
- Alt+Q/W/E select Misc/YouTube/Shortcuts while the popup is open.
- Scrollable 400 × 600 layout with saved dark/light appearance; dark is the default.
- Page actions show success/error toasts. Keyboard failures show a per-tab `!` badge and error tooltip; a successful action clears them.
- Saved preferences differ from applied page state. Application failure retains the preference and reports the failure. Storage failure prevents application.

Sources: `src/App.tsx`, `src/background.ts`, `src/lib/withActiveTab.ts`.

## Misc tab

| Feature | Behavior | Persistence/reset |
| --- | --- | --- |
| Password generator | Length 4–128 (default 20); uppercase, lowercase, numbers, and symbols; regenerate and copy | Cryptographic randomness; includes each enabled type. Passwords/options are session-only and excluded from settings backups. Clipboard is changed only on Copy |
| Video speed | 0.1–10× in 0.1× steps; slower/faster, normal, and double-speed controls | One global local preference; applies to new videos and new media sources |
| Player overrides | Website player speed changes remain for the current media item | Do not change saved speed; new media or explicit Zed actions restore saved speed, including repeated same-speed actions |
| Volume boost | Audio/video gain from 100% to 2000%, in steps of 10% | Global preference; activated on the current page and then newly inserted media. Reset changes gain to 100%, not the Web Audio routing |
| Background colors | Color picker overrides backgrounds and suppresses background images | Saved per HTTP(S) origin; applied on command, not automatically after reload; independent reset |
| Text colors | Color picker overrides page text | Saved per origin; independent reset and combined color reset |
| Main scrollbar | Hide/reset the document scrollbar | Page-local injected style |
| All scrollbars | Hide/reset document and nested scrollbars | Separate page-local style; reset both if both were applied |
| Inspect mode | Hover overlay shows element identity, position, dimensions, box model, colors, layout, and typography | Global preference, applied on command; Escape disables active inspect overlays listening for that change |
| Design mode | Toggle temporary document editing | Global preference, applied on command. Off stops editing but does not undo edits; reload restores the website document |
| Arabic RTL mode | Arabic-leading text gets RTL direction/right alignment; observes inserted elements and skips explicit `dir` | Global preference read on HTTP(S) page load. Commands affect the active page; other existing pages read the choice on reload. Disable restores recorded alignment |

Speed normalizes before stepping: `1.36` becomes `1.4`, then Faster selects `1.5`. Popup and keyboard use the same policy. Speed targets videos, not audio-only elements.

The password generator automatically generates a new password when an option changes. Each enabled character type appears at least once; disabling every type clears the output and disables copying. Lengths must be whole numbers from 4–128. It uses `crypto.getRandomValues` with rejection sampling and a cryptographic shuffle, with no network requests or password storage. Sources: `src/components/PasswordGenerator.tsx`, `src/lib/passwordGenerator.ts`.

Sources: `src/components/MiscTab.tsx`, `src/lib/playbackPresets.ts`, `src/lib/playback.ts`, `src/lib/pageActions.ts`, `public/scripts/`.

## YouTube tab

| Feature | Behavior/reset |
| --- | --- |
| Focus mode | Expands the player to the viewport and hides surrounding content. Suspends sizing during fullscreen; toggle off removes Zed's layout changes. Requires a YouTube player |
| Hide progress bar | Hides progress, time, and chapters; toggle off removes its style |
| Hide controls | Hides bottom controls; toggle off removes its style |

Preferences are global but apply on command to the current page, not automatically after reload. Selectors depend on YouTube's DOM. Exact restoration of existing inline layout values remains a limitation.

Sources: `src/components/YoutubeFocusMode.tsx`, `public/scripts/youtube*.js`.

## Keyboard commands

| Command | Default |
| --- | --- |
| Open popup | Alt+Z |
| Slower / Faster | Alt+Comma / Alt+Period |
| Normal speed | Alt+1 |
| Double speed | Unassigned |
| YouTube focus / hide progress | Unassigned |
| Hide main / all scrollbars | Unassigned |
| Design / inspect mode | Unassigned |
| Reset page colors | Unassigned |

The Shortcuts tab reads actual Chrome assignments and displays “Not set” when unassigned. Configure keys at `chrome://extensions/shortcuts`. Other popup hints are fixed suggestions, not live assignments. Chrome permits four default bindings including the popup. Volume, RTL, and hiding controls have no command.

Sources: `public/manifest.json`, `src/components/ShortcutsTab.tsx`, `src/lib/pageActions.ts`.

## Settings transfer

- Export recognized preferences and per-origin colors to a dated version-1 JSON backup.
- Import version-1 JSON by merging recognized values; omitted settings remain unchanged, unknown keys are ignored.
- Reject unsupported versions and invalid recognized modes, booleans, ranges, tabs, origins, or colors before writing. Colors must be empty reset values or six-digit hex colors.
- Import updates preferences, not every page's applied state. Changed speed reaches running playback scripts; use page controls to apply other imported preferences.
- Affected readers safely default malformed stored values. Export reports invalid recognized stored values instead of producing an unusable backup.

Sources: `src/lib/settings.ts`, `src/components/SettingsTab.tsx`, `src/lib/useStoredValue.ts`.

## Permissions and limitations

- Manifest V3; existing `scripting`, `activeTab`, and `storage` permissions. No new permissions or backend.
- Playback and RTL content scripts match HTTP(S) pages and all frames. On-demand actions attempt all frames where appropriate, with main-frame fallback. Inaccessible frames may remain unchanged.
- Chrome internal pages, the Chrome Web Store, and other protected documents generally reject injection.
- Preferences are local; no account or cloud sync. Exported per-origin colors reveal saved website origins, so backups are personal data.
- Closed shadow roots and unusual media pipelines may need site-specific support. Reused MediaSource URLs without normal loading events can hide a media-item change.
- Web Audio amplification can fail for cross-origin or already-connected media and autoplay restrictions. The legacy volume script still swallows some errors. High gain can distort audio.
