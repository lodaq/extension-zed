# Recommendations and roadmap

[FEATURES.md](FEATURES.md) inventories current capabilities. This document separates completed architecture work from remaining recommendations.

## Completed architecture recommendations

| Area | Implemented | Verification |
| --- | --- | --- |
| Playback module | Shared normalization/stepping, persistent application owner, player overrides, no one-shot script or URL polling | Off-grid rates, limits, new media/videos, explicit actions, repeated initialization, cleanup tests |
| Packaging | ES-module background worker and classic playback script with stable manifest filenames | Type check, build, `bun run check:build` |
| Page-action module | Background owns validation, saving, targeting, execution, and errors; popup and background share the interface | Caller parity, failures, invalid inputs, missing tabs, resets, deferred completion tests |
| Failure semantics | Application failures retain saved preferences and report failure; storage failure stops application; popup feedback | Handler tests; browser-specific feedback still needs loaded-extension coverage |
| Settings-transfer module | Validated version-1 merge, recognized-only export, unknown-key filtering, safe reader defaults | Round trips, partial imports/theme preservation, invalid values/versions, no writes on rejection |
| Saved-preference loading | Live storage updates take precedence over startup reads; save completion never overwrites live state; cleanup invalidates pending reads | Deferred read success/failure, save ordering/errors, cleanup, validation and reset tests |
| Injected completion | Async scripts return their storage work; generated CSS rejects malformed colors | Actual-script deferred-storage and CSS tests |
| RTL application | Reuses existing application function; restores recorded alignment | Source review; real DOM coverage recommended |\n| RTL performance | Batches rendered-text reads before style writes, including mutation batches | Fixture median 141.6 → 28.5 ms; layouts per enable 401 → 1; see [PERF.md](PERF.md) |

Depth comes from concentrating behavior behind each module's interface. Locality keeps policy, action coordination, and transfer validation testable in one place. Chrome remains the concrete adapter at the execution seam; no general adapter framework was added.

## Remaining recommendations, in priority order

### 1. Add loaded-extension browser regression coverage — high

Current tests exercise logic and simulated Chrome calls, not real permissions, isolated/main worlds, fullscreen, or audible media. Verify a controlled HTTP(S) page with frames/video, a real YouTube page, and a restricted Chrome page. Cover imports, resets, and console errors. Keep fixtures deterministic and YouTube checks separate.

### 2. Restore YouTube inline styles exactly — high

**Evidence:** `public/scripts/youtubeFocusMode.js` removes layout properties and sibling `display` instead of restoring their previous values and priorities.

**Impact:** reset can leave the page different from its original layout.

**Fix:** record only changed values, restore them on reset/fullscreen transitions, and test pre-existing inline styles, repeated toggles, navigation, and fullscreen.

### 3. Report volume failures and preserve usable audio — high

**Evidence:** `public/scripts/volumeBoost.js` swallows connection exceptions; cleanup does not disconnect audio nodes. Cross-origin media can become silent when routed through Web Audio.

**Fix:** reproduce same-origin, cross-origin, and already-connected media behavior in Chrome; report connection/resume failures and establish reversible routing. Do not create a second media source for an already-routed element. Test that reset leaves audio usable.

### 4. Clarify saved preferences versus applied page state — medium

Most switches display global preferences although application is page-local; playback and RTL have different automatic rules. Label this distinction and add page-state queries only where useful. Per-site/per-tab policies require a separate product decision.

### 5. Extend RTL text-update and real-page coverage — medium

**Evidence:** `public/scripts/arabicRtlMode.js` reads `innerText` across nested elements and observes insertion but not character-data replacement.

**Status:** the measured read/write layout bottleneck is fixed; [PERF.md](PERF.md) records the evidence. Next, profile larger Arabic/mixed-language pages and cover text updates while preserving explicit direction and original styles.

### 6. Extend media identity only when a missed reset is reproduced — lower

Playback uses loading events/source changes. Some players reuse MediaSource URLs across items. Add a site-specific adapter only when evidence warrants it; avoid navigation polling and keep player overrides local to the media item.

## Future features — not implemented

| Group | Ideas | Smallest useful next step |
| --- | --- | --- |
| Reading | Reader mode, width/fonts, grayscale | One reversible reading view |
| YouTube | Timestamp bookmarks, highlights, half-screen, optional fullscreen default | Local timestamp bookmarks with jump-to-time |
| Productivity | Pomodoro; posture, eyes, exercise, custom, azkar/salah reminders | One configurable timer; permissions only when needed |
| Bookmarks/new tab | Curated bookmarks, sync, quotes/ayah/tips | Decide whether replacing the new tab is wanted |
| Capture/share | Post-to-image and screenshot workflows | Local capture/export without accounts |
| Appearance | Scrollbar styling | Preset scrollbar themes |
| Integrations | Notion, Google Tasks/Calendar/Keep, social tools | One concrete save destination and authorization flow |
| Browser tools | Site-data clearing, extension management, ad filtering | Separate permission and recovery design |
| Media download | Native-host/yt-dlp workflow | Explicit native-host installation, separate from ordinary downloads |

Treat the old “all features from ReVanced” idea as inspiration, not an actionable task. Choose individual supported behaviors. Speed, volume, scrollbars, and YouTube visibility already exist.

## Verification of this change

- `bun run test`: 52 tests passed across eight files, including password generation, unbiased random-sample handling, and RTL read/write batching/restoration.
- `bun run lint`, `bun run build`, `bun run check:build`, and `git diff --check`: passed.
- Browser smoke: Chrome listed the unpacked extension and the popup rendered. Reloading during the rebuilt-extension check produced `ERR_BLOCKED_BY_CLIENT`; subsequent action checks did not complete reliably.
- Not verified in a loaded browser: final-build page effects, cross-frame behavior, real media/audio, restricted-page feedback, and YouTube/fullscreen. Use the README manual checklist before treating those as confirmed.
- Password generator browser checks passed for a 38-character numbers-only password, regeneration with uppercase only, copy feedback, no horizontal overflow, and clearing/disabling output when all character types are unchecked. No browser errors were reported.
