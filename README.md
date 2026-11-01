# Extension Zed

A personal Chrome Manifest V3 toolbox with a password generator, page colors, scrollbars, video speed, volume boost, inspect/design/Arabic RTL modes, and YouTube layout controls.

- [Implemented features](FEATURES.md)
- [Completed fixes, recommendations, and future features](RECOMMENDATIONS.md)
- [Domain glossary](GLOSSARY.md)
- [Performance measurements and reproduction](PERF.md)

## Build and load

```sh
pnpm install
pnpm test
pnpm lint
pnpm build
pnpm check:build
```

Load `dist/` as an unpacked extension at `chrome://extensions`. After rebuilding, reload the extension and refresh existing web pages to receive new content scripts. `pnpm dev` serves the popup for development; an ordinary browser page does not provide extension APIs.

Stack: React 19, TypeScript 6, Vite 8, Tailwind 4, and Radix UI. Permissions: `scripting`, `activeTab`, and `storage`. Playback and Arabic RTL content scripts match HTTP(S) pages, including frames. No additional permissions were added by the architecture fixes.

## Structure and action flow

- `src/App.tsx` and `src/components/`: popup tabs and controls.
- `src/lib/pageActions.ts`: typed/validated page actions; owns saving, targeting, execution worlds, and failures. Popup and keyboard callers share the same handler.
- `src/background.ts`: Chrome message/command adapters and per-tab failure badges/tooltips.
- `src/lib/playbackPresets.ts` and `src/lib/playback.ts`: shared speed policy and persistent media behavior; player overrides last for the current media item.
- `src/lib/settings.ts`: recognized preferences, runtime validation, and settings transfer. Imports merge and preserve omitted values.
- `public/scripts/`: on-demand page scripts. Return asynchronous work so application can be awaited; preserve original page values when implementing reversible changes.

Vite bundles the popup and ES-module background worker together. A second build (`vite.content.config.ts`) emits playback as a standalone classic script. Do not add generated worker/playback copies to `public/`. Manifest paths remain `background.js` and `scripts/playbackRatePersist.js`. `pnpm check:build` verifies packaged assets, worker imports, injection paths, and classic-script syntax.

To add an action, extend the typed request/runtime validation, keep saving and execution inside the background module, connect its control/command, and test through the action interface. `@/` resolves to `src/`.

Application failure retains saved preferences and reports that they were not applied. Storage failure prevents application. Existing storage keys and version-1 backups are retained.

## Manual verification

1. On HTTP(S) pages with frames/video, check speed, player overrides, new videos/sources, and repeated same-speed Zed actions.
2. Apply/reset text and background colors without losing site inline styles; exercise both independent scrollbar styles.
3. Toggle inspect/design/Arabic RTL; check Escape and mixed Arabic/Latin content.
4. Check amplification/reset with same-origin and cross-origin media and inspect console errors.
5. On YouTube, test focus, visibility controls, repeated toggles, navigation, and fullscreen transitions.
6. On a restricted page, check popup failures and keyboard badges/tooltips. A later successful action on that tab clears failure feedback.
7. Export/import settings, merge only a speed while preserving theme, and reject invalid known settings without partial writes.
8. In Misc, test password length/character options, regenerate, and copy. Disable every character type and check the inline error and disabled copy control.

Chrome allows four default suggested bindings including the popup. Assign other commands at `chrome://extensions/shortcuts`; the Shortcuts tab shows actual assignments. Remaining browser-specific limitations are recorded in the linked documents.
