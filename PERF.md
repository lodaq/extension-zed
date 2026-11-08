# Performance evidence

Measured on 2026-11-02 against the working tree including the architecture fixes, password generator, popup startup work, and lazy section loading. Field data is unavailable: this is a local Chrome extension with no RUM collection or eligible public CrUX URL. These are lab observations, not field INP/LCP claims.

## Evidence

| Signal | Conditions | Before | After |
| --- | --- | --- | --- |
| RTL enable, including final layout | 200 blocks / 1,200 elements; median of 5 timed samples after one warmup | 141.6 ms; range 127.7–165.2 | 28.5 ms; range 27.7–40.1 |
| Layouts within each traced RTL enable | Separate trace; one warmup and one measured enable | 401 in both calls | 1 in both calls |
| Elements changed / reset | Same fixture, all measurements | 1,001 changed; none left marked after reset | Identical |
| Popup cold FCP | New popup page, cache disabled, 12 interleaved runs each | Median 264.8 ms; range 166.5–545.6 | Median 68.0 ms; range 52.0–96.0 |
| Popup cold app ready | Same runs; four tabs and six sections in the DOM | Median 251.2 ms; range 159.8–488.2 | Median 79.3 ms; range 66.4–103.9 |
| Popup placeholder frame | Same runs; `…` rendered before settings resolve | Present in 12/12 | Present in 0/12 |
| Toolbar popup first painted frame | CDP auto-attach before page scripts; 6 runs each | 400 × 70 with `…` in 4/6, then resized to 400 × 600 | 400 × 600 with the app in 6/6 |
| Toolbar popup app ready | Same runs | Median 163.1 ms; range 89.0–179.9 | Median 79.3 ms; range 68.1–97.5 |
| Initial popup JavaScript | Node `gzipSync`, popup plus shared settings chunk | 298,321 bytes raw / 91,816 bytes gzip | 274,510 bytes raw / 86,980 bytes gzip (sections lazy loaded) |
| Popup CSS | Node `gzipSync` | 27,831 bytes raw / 5,955 bytes gzip; separate render-blocking request | Inlined into `index.html` at build time; no separate request |

RTL samples, in milliseconds:

- Before: 157.6, 165.2, 130.1, 141.6, 127.7.
- After: 31.7, 40.1, 27.7, 27.9, 28.5.

The RTL median improved by about **80% (5×)**, beyond the observed run-to-run variation. This does not establish the size of the improvement on arbitrary websites or hardware.

## Conditions and cause

- Desktop Chrome 156 on Linux; viewport 955 × 889; device pixel ratio 1. No CPU/network emulation configured. Browser host load was not controlled.
- Same extension fixture URL, DOM, CSS, sample count, reset sequence, and final forced-layout read. Each phase used a fresh isolated browser session and a warmed document. Timed samples were recorded without tracing; separate equivalent traces diagnosed layout work.
- Fixture: `chrome-extension://<extension-id>/perf/rtl.html`, generated locally. Each block has Arabic text plus an explicitly directed Latin paragraph. The marked-element and reset assertions must pass before accepting timings.
- The original RTL scan read `innerText`, then immediately changed direction/alignment for each element. Those changes invalidated layout before the next rendered-text read.
- The fix batches rendered-text reads before applying styles, including across added roots in one MutationObserver delivery. It retains `innerText` semantics, explicit-direction handling, original alignment restoration, and the same elements changed.
- Whole-trace diagnostics also fell from 805 to 5 Layout events and from 2,005 to 5 UpdateLayoutTree events. Those totals include fixture/reset work; the per-enable counts above isolate the operation.

Raw local artifacts (temporary, not committed): `/tmp/zed-rtl-before.json`, `/tmp/zed-rtl-after.json`, `/tmp/zed-rtl-before-trace.json`, `/tmp/zed-rtl-after-trace.json`, and `/tmp/zed-performance-comparison.json`.

## Popup startup

The popup used to render a `…` placeholder while `chrome.storage.local.get` was in flight. Chrome sizes the toolbar popup from its content, so a short placeholder produced a 400 × 70 window that resized to 400 × 600 when settings resolved. The first frame now contains a static 400 × 600 shell (tab bar, keyboard badges, and the six collapsed Misc section headers) in `index.html`, with the theme and active tab applied synchronously from a `localStorage` boot mirror (`zed.boot`). React replaces that shell as soon as it mounts; `chrome.storage.local` remains the source of truth and refreshes the mirror. The built popup CSS is inlined, `boot.js` executes in `<head>` to avoid layout recalc, `main.css` sets fixed 400 × 600 container constraints, and collapsed Misc section bodies are dynamically loaded with `React.lazy()` upon first opening.

Two measurements used an isolated headless Brave 155 profile with the unpacked `dist/` loaded:

- **Cold page load.** Each run opened a new popup page with the network cache disabled and a 400 × 600 viewport. Baseline and changed builds ran alternately, 12 runs each, on a host with a load average around 3–4. Baseline rendered the placeholder in 12/12 runs; the changed build rendered none. FCP fell from a 264.8 ms median to 68.0 ms, and app-ready from 251.2 ms to 79.3 ms. These absolute values are inflated by host load; the relative result is what the interleaved runs support.
- **Toolbar popup first frame.** CDP auto-attach paused each popup before its scripts ran, then sampled the first painted frames. Baseline's first frame was 400 × 70 with `…` in 4 of 6 runs, followed by a resize to 400 × 600; the changed build's first frame was 400 × 600 with the app in 6 of 6 runs. App-ready median fell from 163.1 ms to 79.3 ms.

Reproduction artifacts (temporary, not committed): `/tmp/opencode/popup-baseline.json`, `/tmp/opencode/popup-final-*.json`, `/tmp/opencode/toolbar-trace-base*.json`, and `/tmp/opencode/toolbar-trace-final*.json`.

## Reproduce and guard

```sh
bun run build
node scripts/prepare-performance-fixture.mjs
```

Load the unpacked `dist/` extension in an isolated Chrome profile. Open `chrome-extension://<extension-id>/perf/rtl.html`. In the browser console:

```js
const result = await window.runRtlBenchmark(200, 5);
const median = [...result.timings].sort((a, b) => a - b)[2];
if (median > 50) throw new Error(`RTL fixture budget exceeded: ${median} ms`);
({ median, timings: result.timings, marked: result.marked });
```

The **50 ms median** budget is specific to this desktop fixture and comparable conditions, not a universal browser/device threshold. Repeat before drawing conclusions from a marginal failure. Trace a separate `runRtlBenchmark(200, 1)` call to diagnose regressions without mixing trace overhead into the primary timing comparison.

A separate five-sample browser run passed this budget after the fix (`/tmp/zed-rtl-budget.json`). All 79 tests, lint, production build, packaging checks, and whitespace checks passed.

`src/lib/arabicRtlMode.test.ts` provides the deterministic CI guard: rendered-text reads must finish before writes for both initial application and mutation batches. It also verifies explicit directions and alignment restoration. The manual browser budget checks the actual latency; there is no browser-performance CI infrastructure or field monitor in this repository.

The preparation script writes only ignored `dist/perf/` artifacts and checks its application hook. The fixture asserts unchanged behavior during every sample. A normal `bun run build` removes these diagnostic files; they are not part of the production source or manifest.

## Experiment ledger

| Idea | Baseline → result | Verdict | Reason |
| --- | --- | --- | --- |
| Batch RTL rendered-text reads before writes | Median 141.6 → 28.5 ms; layouts per enable 401 → 1 | Kept | Timing ranges do not overlap; matching/reset assertions and regression tests pass |
| Static 400 × 600 first-frame shell plus synchronous boot mirror | Placeholder frame 12/12 → 0/12; cold FCP median 264.8 → 113.3 ms | Kept | Removes the placeholder resize; app renders from defaults and hydrates afterward |
| Inline built popup CSS into `index.html` | One render-blocking request removed | Kept | No separate CSS request remains in the built popup |
| Defer collapsed Misc section bodies until first opened | Longest React render task ~52 → ~29 ms; initial JS chunk reduced | Kept | Sections still stay mounted after first open, so values and focus are preserved |
| Fixed 400 × 600 dimensions and `<head>` boot execution | Cold FCP 113.3 ms → 68.0 ms; DCL ~65 ms → ~19 ms | Kept | Prevents `ResizeDueToAutoResize` calculation delays and dark theme style invalidation |
| Filter subtree mutation records in `src/lib/playback.ts` | 1,000 `querySelectorAll("video")` calls on 5,000 elements = 33.0 ms (0.033 ms/call); 100 non-video mutation batches: 442.2 ms without observer vs 441.7 ms with observer (Δ -0.5 ms, noise) | Reverted / Left alone | Chromium tag map query is fast enough (<0.04 ms); manual record-filtering loop in JS adds maintenance complexity for zero measurable win |

Popup lazy loading, password RNG changes, and blanket memoization had no measured justification and were left alone. Non-default popup tabs are not lazy-loaded because switching to them would then wait on a chunk fetch.

## Remaining hypotheses and limits

- RTL tests cover 1,200 fixture elements, not arbitrary page sizes. Profile larger real pages, mixed/hidden text, and dynamic text replacement before further changes.
- Popup startup was measured with a 400 × 600 viewport and no network/CPU throttling. It is not a low-end-device or cold-profile claim; the interleaved A/B removes host-load drift but not browser-version differences.
- Field verification remains unavailable until actual user-session data is collected; telemetry was not added for this local extension.
