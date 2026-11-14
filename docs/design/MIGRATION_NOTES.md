# Zed Dark migration notes

## Status and source

The full Design Spec v1.0 is now present in `docs/design/extension-zed-design-spec.md` (611 lines). The earlier source blocker is resolved. The HTML remains a visual reference; its mock application code is not reused. Implementation and fixture verification are complete on `redesign/zed-design-system`.

## Stack, tooling, and build

- React 19, TypeScript 6, Vite 8, Tailwind 4 with PostCSS/autoprefixer. Package manager: Bun 1.4.4 (`bun.lock`).
- `src/main.tsx` mounts `src/App.tsx`; `index.html` and `public/boot.js` supply an early popup shell/cache. The current popup is 480 × 600 in code; README still claims 400 × 600.
- `vite.config.ts` builds popup and module background worker, inlines the popup CSS, and emits `theme.css` and `scrollbar.css` for isolated surfaces. `vite.content.config.ts` separately builds `src/content/playback.ts` as `scripts/playbackRatePersist.js`.
- `bun run build`: TypeScript and both Vite builds. `bun run lint`: ESLint, TypeScript rules, React hooks and refresh rules, zero warnings. Public scripts are excluded from ESLint. No token/style guard is currently wired in.
- `bun run test`: Vitest unit tests, including settings, password generation, playback, injected scripts, screenshots, extension manager, and background behavior.
- `bun run test:e2e`, `bun run test:e2e:video-quality`: Chromium extension scripts. Existing e2e harness invokes `npx -y chrome-devtools-mcp@latest`; do not invoke unchanged under this task's no-network constraint. Other checks include `check:build`, popup reorder, and popup benchmarks.
- TokenEconomizer is installed. `te --host codex microskills` reports no facts have cleared its injection gate.

## Manifest

`public/manifest.json` is Manifest V3. `action.default_popup` is `index.html`; background worker is `background.js`, module type. No explicit CSP is declared; Chrome MV3 defaults apply. Toolbar command is Alt+Z (`_execute_action`).

Required permissions: `scripting`, `activeTab`, `storage`, `clipboardWrite`, `debugger`. Optional permission: `management`. Host permission: `https://viliusle.github.io/miniPaint/*`. HTTP(S) content scripts provide playback persistence, Arabic RTL, video quality and bridge, and grayscale. Web-accessible resources expose screenshot clipboard HTML/JS, theme CSS and scrollbar CSS to HTTP(S) pages.

The permission lists are unchanged. Final manifest changes are recorded below.

## Existing design sources

- `DESIGN.md`: mandatory shadcn controls, square corners, light/dark semantic tokens, popup dimensions, scrollbar rules, overlay constraints, no motion, and UI review instructions. Conflicts with the requested replacement system; replace only when its normative source is available.
- `AGENTS.md`: no animations/transitions; design guidance points to DESIGN.md. `CLAUDE.md`: no animations/transitions. User-supplied repository instructions additionally require minimal code, Ponytail ultra, and existing token-saving tooling.
- `README.md`: popup dimension, theme and UI descriptions; links DESIGN.md. `CONTRIBUTING.md`: reversible host-page changes and UI/manual checks. `components.json`: shadcn new-york configuration. No Storybook or stylelint files found in the repository file inventory.
- `src/theme.css`: light/dark OKLCH colors, shadows, font stacks (Lato, Merriweather, Roboto Mono), radius. No local font files found in repository inventory.
- `src/main.css`: Tailwind imports, shared theme/scrollbar imports, document sizing, base type, selection and global square-corner/no-motion guards.
- `src/scrollbar.css`: extension scrollbar colors, width and hover state.
- `tailwind.config.js`: semantic color/font/shadow mappings, radius calculations, empty motion definitions, installed `tailwindcss-animate` plugin. `postcss.config.js` configures CSS processing.
- `src/components/ui/`: Button variants, Tabs, Switch, Label, ScrollArea, Radix Toast and toast state. Installed Radix SVG icon set; screenshot buttons have their own inline SVG paths.
- `src/lib/popupLayout.ts`: shared panel, heading, description, spacing and control classes. Components also contain direct Tailwind size/color classes, arbitrary font sizes and warning palettes.
- `index.html`: independent boot-shell styles, raw colors/type/sizing and gear emoji; `public/boot.js` applies cached appearance. Both must migrate with the React shell to avoid a first-frame mismatch.
- `src/content/screenshot.ts`, `public/scripts/inspectMode.js`, and `public/screenshot-clipboard.html`: embedded styles in addition to shared stylesheets.
- Supplied `docs/design/extension-zed-design-reference.html`: reference artifact, not production UI. Contains embedded Inter WOFF2 data that may allow local font bundling without network access once its intended use is confirmed by the full spec.

## Feature and screen mapping

Screen mapping: Misc §4.1, Playback §4.2, Video quality §4.3, Password §4.4, Volume §4.5, Scrollbars §4.6, Modes §4.7, Capture §4.8, Extensions §4.9, YouTube §4.10, Links §4.11, Shortcuts §4.12, Settings §4.13, Reset §4.14, Toast §4.15, Restricted §4.16. The table records the pre-migration implementation.

| Requested screen | Current implementation / behavior |
| --- | --- |
| Shell / Misc grid | App.tsx: Misc, Extensions, Youtube, Settings. MiscTab.tsx: collapsible sections with saved expansion/order and pointer/keyboard reorder. No grid or drill-in navigation. |
| Playback speed | ChangePlaybackRate.tsx, lib/playback.ts and playbackPresets.ts: 0.1–10 in 0.1 steps; persistent media application. |
| Video quality | VideoQualitySection.tsx and lib/videoQuality.ts: preferred quality, auto, higher/lower fallback; existing engine and bridge. |
| Password generator | PasswordGenerator.tsx and lib/passwordGenerator.ts: 4–128 characters, uppercase/lowercase/numbers/symbols, secure unbiased randomness, guaranteed selected groups, copy/regenerate. |
| Volume boost | VolumeBooster.tsx: amplification slider, 10-step input; existing request validation accepts integers 100–2000. |
| Scrollbars | ScrollbarsSection.tsx: custom apply/reset, main hide/reset, all hide/reset. Commands, not queried status cards. |
| Modes | ModesSection.tsx: inspect, document design mode, Arabic RTL. |
| Capture screenshot | ScreenshotSection.tsx: selected area, visible area, full page, element. Existing screenshot:start contract closes popup on success; inline error on failure. |
| Save & close tab | No implementation found in popup/action registry. |
| Extensions | ExtensionsTab.tsx / lib/extensionManager.ts: optional management access, real extension list, enable/disable, options, reload, uninstall and browser extensions link; policy/error/empty states. |
| YouTube | YoutubeTab.tsx / YoutubeFocusMode.tsx: focus, hide progress, hide time/duration, hide controls, half-screen layout. |
| Links | No popup tab, storage contract or feature implementation found. |
| Shortcuts | No recorder/catalog/storage implementation found. Only existing manifest Alt+Z popup command. |
| Settings | SettingsTab.tsx: dark/light theme, grayscale websites, JSON import/export, reset, About and privacy/permissions disclosure. |
| Settings reset dialog | Current two-click confirmation expires after four seconds; no dialog. |
| Restricted-page state | Existing page-action error handling in lib/withActiveTab.ts and background; no dedicated screen in App.tsx. |

### Existing features without a confirmed spec design

The current features needing layouts beyond the primary spec screens are: Misc reorder/expansion, settings import/export, About, privacy/permissions disclosure, extension options/reload/uninstall, grayscale websites, and screenshot result preview/editor controls. They retain their behavior and use shared Zed Dark buttons, rows, typography and notices. Tool reordering moves into a collapsible Settings section; saved custom orders still apply. Expansion keys remain intact for compatibility, while grid/drill-in navigation replaces collapsible panels.

## Injected surfaces

- `public/scripts/inspectMode.js`: open Shadow DOM; linked theme and scrollbar CSS, highlight box and computed-style panel; embedded monospace type and raw shadow color. Host page style values displayed as inspection data must not be confused with extension UI colors by a future token guard.
- `public/scripts/designMode.js`: toggles the browser's `document.designMode`; no separate extension control surface. Preserve page editing behavior.
- `src/content/screenshot.ts`: closed Shadow DOM for area/element selection and native dialog preview; receives theme CSS and scrollbar CSS, with embedded layout/control styles and some raw values. Existing preview includes status and actions; a clipboard iframe uses extension-origin `public/screenshot-clipboard.html` and its own shared styles. Preserve existing behavior while distinguishing this preview from the explicitly rejected new “Capture result” sheet.
- Popup notifications use Radix Toast. Other scripts (scrollbars, YouTube layouts, grayscale, RTL) intentionally alter website presentation; a token guard must distinguish website effects from extension-owned UI and measured screenshot coordinates.

## Decisions

1. §8.1: popup is dark regardless of the stored darkTheme value. Preserve that key and switch rather than inventing a page-level darkening feature; grayscale retains its website effect.
2. §8.2: preserve reset/import/export schema version 1 and the existing reset key list for existing features. New savedLinks and keyboardShortcuts are additive storage keys. Reset shortcut bindings to their defaults; saved Links survive reset. Existing page effects are unchanged until their existing application path runs.
3. §8.3: quality applies immediately on selection, retaining Apply. Existing Auto and higher-than-1080p resolutions remain available using the same option components.
4. §8.4: read scrollbar state from existing style IDs on the current document. Preserve independent command precedence and all-frame action application.
5. §8.5: screenshot selection, native full-page capture, preview, clipboard/download and editor behavior remain. No new Capture result sheet or scrollbar preview.
6. §8.6: restricted detection uses activeTab URL access; no new permission. Catch page-action failures as fallback.
7. §8.7: existing settings JSON format and validation remain. New Links/shortcut keys are local additive storage; no migration of existing keys.
8. Existing speed range 0.1–10/step 0.1, volume step 10, password symbol pool and all-unchecked validation win over mock behavior under the stated precedence. Password randomness/selected-group guarantees remain.
9. The explicit source-of-truth precedence replaces the prior no-motion design rule with §2 motion: only tooltip opacity/transform and switch knob transitions, and zero duration under reduced motion. AGENTS.md/CLAUDE.md now point to the single system.
10. No existing global shortcut mechanism besides Alt+Z exists. Add an HTTP(S) top-frame content-script key listener using local bindings, as §6 permits; browser-reserved shortcuts and restricted pages remain browser limitations. Page-modifying shortcuts use existing activeTab grants: open the popup on the current tab first; navigation revokes the grant. No broad host permission is added.

## Completed phases

- Phase 0: audited the old stack, features, style sources and isolated surfaces. Resolved the initially incorrect attachment when the complete specification arrived.
- Phase 1: `src/design-system/tokens.css` contains §2.2 verbatim, with one additional zero-radius token for selection geometry. Shared CSS primitives, React components and exact SVG paths replace the palette and controls. Inter is extracted from the supplied reference and bundled locally. `src/theme.css` now only maps legacy semantic names to Zed tokens; Vite emits the same palette for isolated UI. `check:tokens` is part of lint.
- Phase 2: shell, grid/drill-ins, all screen routes, links, shortcut catalog/recorder/execution, status cards, restricted banner and native reset dialog. Real extension APIs and existing feature services remain. Navigation deliberately opens Misc every time as §3 requires; old saved navigation/expansion keys are not deleted. Password options retain their previous popup-session lifetime and regenerate on entry.
- Phase 3: fixed focus wrapping/restoration, checkbox roles, labels, link validation and rendered-data handling. Captured all screens plus empty/populated links, recording/errors/conflict, toast and reset states. Added behavior assertions and unit regressions.

## Removed or replaced design rules

- `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, and README design guidance now point to DESIGN_SYSTEM.md.
- `src/theme.css`: removed the light/dark OKLCH palette, old font choices and shadows; compatibility aliases resolve exclusively to Zed tokens.
- `src/main.css`: replaced 480px sizing and the square-corner/global zero-motion guards. `src/scrollbar.css` uses the shared token palette.
- `tailwind.config.js`: removed animation plugin use and mapped type sizes to tokens. Removed the unused tailwindcss-animate dependency and updated bun.lock offline.
- `index.html`/`public/boot.js`: removed the independent boot palette, old layout and emoji gear. Production popup CSS is still inlined by Vite.
- `src/components/ui/` and popup components: token-based controls, type and geometry. Injected inspector, screenshot dialog and clipboard frame use the same tokens and bundled font.

## Additions, permissions and constraints

- No new dependencies, required permissions, optional permissions, host permissions, external calls or analytics.
- Manifest adds a top-frame HTTP(S) shortcut listener and exposes `fonts/Inter.woff2` alongside the existing isolated UI assets. Inter is local; the reference application logic is not copied.
- Existing screenshot previews/editor actions remain; no new Capture result sheet or scrollbar preview card.
- Higher quality resolutions and Auto remain under “More resolutions”; settings About/privacy details remain below the specified blocks. These use the same primitives.
- The token guard covers extension CSS/TS/TSX and injected inspector/clipboard UI. It excludes design reference documents, tests, generated output, and deliberate website transformations such as custom website scrollbars. Those transformations are feature behavior, not extension chrome.
- “Dark theme” preserves the setting key, but the popup remains dark under the new visual precedence; no unrequested website darkening feature is introduced.
- Chrome internal URLs saved by Save & close retain their scheme. Imported destinations are validated to reject executable schemes. Browser restrictions can prevent opening an internal URL from a link.

## Verification and reproduction

Run from the repository root:

```sh
bun run build
bun run lint
bun run check:tokens
bun run test
bun run check:build
bun run screenshots
```

Screenshots are in `docs/design/screenshots/`. The screenshot script uses the built popup, a local HTTP server, stubbed Chrome APIs from `docs/design/fixture.js`, and an installed headless Chromium via the DevTools protocol. Set `CHROME_PATH` to another installed Chromium executable if necessary. It downloads nothing, and its test data is excluded from the extension build.

Assertions cover 640 × 600 dimensions, horizontal and document scroll containment on every screen, native dialog Cancel focus/Tab wrapping/Escape/focus restoration, six restricted tiles, shortcut recording/conflict copy, saving and displaying a link, and toast expiration. Reduced-motion media is enabled for deterministic captures. The spec palette supplies the documented contrast pairs.

Build, lint (including token guard), packaged-asset checks, and 205 unit tests pass. Tests cover existing feature contracts plus normalization, safe stored destinations, shortcut catalog/defaults, recorder rules and dispatcher behavior.

Not verified against live websites in an installed browser: player-specific behavior, OS/browser-reserved shortcut conflicts, and actual management permission prompts. Existing network-fetching e2e harnesses were not run; the new offline fixture replaces them for visual verification. The shared preview resize did not produce a reliable CSS viewport, so saved acceptance images use the offline Chromium harness at device scale 1.
