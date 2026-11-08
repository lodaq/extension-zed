# Performance evidence

## Performance optimization budget guard

The stricter keep/revert review found no new measured bottleneck and does not
claim an LCP speedup from the earlier sequential samples. No additional popup
optimization was attempted. Instead, the existing toolbar benchmark now enforces
the requested **median LCP < 1,000 ms** budget across three openings. It fails
on missing popups, incomplete readiness, or absent LCP entries rather than
silently accepting partial evidence. A buffered observer includes paints before
the debugger attaches and continues observing for one second after readiness.

Run `bun run build && node scripts/benchmark-popup.mjs` locally with Brave
installed. The existing harness opens an isolated browser profile and an
extension tab, then measures three toolbar popups. This warms shared assets;
there is no cache disabling, network emulation, or CPU throttling in this guard.
It is a local guard, not a CI job or a field monitor. The harness retains its
existing machine-specific extension path, extension ID, and browser dependency.

Validation on Chromium 155: LCP samples **84, 52, 52 ms**, median **52 ms**,
range **52–84 ms**. These toolbar measurements use different conditions from
the cold-page measurements below and are not evidence of a further speedup.
Output: `/tmp/zed-lcp-budget.json`.
The failure path was verified with a temporary copy using a zero-ms limit:
it exited with status 1 at the LCP-budget assertion. Script syntax and whitespace
checks passed. Application code was unchanged, so the unit suite and build were
not repeated during this guard-only change. Field monitoring remains unavailable;
no telemetry collection was introduced.

## Performance skill follow-up

Recorded a fresh Chrome DevTools Protocol startup trace of the installed
extension using the same Chromium 155, 400 × 600 viewport, disabled cache,
and 4× CPU slowdown described below. No DevTools MCP trace tool was available;
the local CDP harness recorded the browser's timeline directly.

- Trace LCP: 340 ms; CLS: 0. This single traced navigation is diagnostic,
  not a replacement for the five-sample untraced measurements below.
- Initial requests contain the popup, shared runtime/settings, and notification
  chunks. None of the seven collapsed Misc feature chunks is requested.
- Initial JavaScript: 298,570 bytes raw / 95,892 bytes gzip. Inline CSS:
  39,795 bytes raw / 7,889 bytes gzip. Gzip sizes are bundle comparisons;
  installed extensions read local assets rather than downloading them over HTTP.
- Popup main-thread tasks over 50 ms: 79.2 and 152.9 ms. The largest React
  scheduler function call accounts for 150.0 ms; a subsequent scheduler call
  takes 6.8 ms. This trace does not isolate notification rendering. These include trace
  overhead and CPU emulation; they are not field INP measurements.

No additional production code change is justified by this trace. The notification
chunk loads at startup, but the trace does not establish it as a dominant cost.
Delaying it would add subscription and loading behavior to maintain. CDN settings, HTTP
compression, preconnects, remote font preloads, and speculative navigation do not
address this locally packaged popup. Existing RTL batching is retained.

Local diagnostic artifacts: `/tmp/zed-trace.mjs`,
`/tmp/zed-startup-trace.json`, and `/tmp/zed-startup-summary.json`.

A separate untraced interaction check clicked Extensions → Youtube → Settings
→ Misc twice using trusted CDP mouse input, with 300 ms between clicks, at 4×
CPU slowdown. Event Timing entries with nonzero interaction IDs had durations
of 16–32 ms; no recorded interaction exceeded 32 ms. The observer used a 16 ms
threshold, so shorter events are omitted. The selected tab ended on Misc with
no error boundary. This checks input-to-next-paint latency, not completion of
asynchronous panel loading, and is not field INP. Artifacts:
`/tmp/zed-interactions.mjs` and `/tmp/zed-interactions.json`.

Only this evidence document changed during the performance skill follow-up.
Production code and the previously passing build/tests were not changed or
rerun. No field data or representative real-site content-script trace was
collected in this pass.

## 2026-11-08 popup follow-up

The earlier audit quoted **2,105 ms simulated mobile LCP** from
`artifacts/lighthouse-perfect.report.json` at `http://127.0.0.1:4173/`.
That report's observed LCP was **179 ms**. Its simulation includes mobile
network latency and 4× CPU slowdown; it is not an installed-extension timing.
TBT is a startup blocking metric, not a measurement of INP. `document_idle`
also does not guarantee that content scripts cannot affect a host page's LCP.

Fixed a regression in Misc startup: every lazy section component was rendered
even while collapsed, and the calculated `isRendered` flag was unused. Closed
sections now use the existing shared header until first opened. A per-section
Suspense boundary keeps headers visible while controls load. Once opened,
controls stay mounted on collapse to preserve entered values. The boot script
now executes synchronously in the head, before the body can paint with a stale
theme or without its active-tab attribute. No dependencies were added.

Five fresh `chrome-extension://<id>/index.html` pages with the built extension
loaded in isolated headless Brave/Chromium 155.0.8059.85, a 400 × 600 viewport,
DPR 1, cache disabled, no network throttling, and **4× CPU slowdown** recorded
LCP samples of **316, 292, 156, 200, 252 ms**: median **252 ms**, range
**156–316 ms**. Buffered PerformanceObservers collected LCP and layout shifts
for 1.5 seconds per page without interactions. All seven section headers were
present, no error boundary appeared, and CLS was **0** in all five samples.
These are extension-page lab observations, not toolbar-window timings or field
data. They meet the sub-second goal under these conditions; they do not prove
the same result on every machine or with every saved tab/expanded section.

A separate five-page run without CPU slowdown recorded 144, 220, 96, 168,
144 ms (median 144 ms; range 96–220 ms), also with zero CLS. These sequential
runs do not establish a speedup over the already sub-second installed baseline.
The production build, all 158 unit tests, lint, build-asset checks, and browser
drag/lazy-section checks passed. The browser test waits for the saved closed
state before reopening, because native toggle events are asynchronous.

The measurement harness and raw output are local temporary artifacts:
`/tmp/zed-lcp.mjs` and `/tmp/zed-lcp-cpu4.json`. Run
`CPU=4 node /tmp/zed-lcp.mjs` after `bun run build` to repeat locally.
The harness uses the same isolated-browser/CDP approach as
`scripts/benchmark-popup.mjs`. `scripts/check-popup-reorder.mjs` additionally
checks deferred password controls, preserved state across collapse/reopen,
and saved expanded sections on the next popup opening.

The RTL `innerText` semantics remain unchanged: hidden text can make a
`textContent` shortcut choose a different first letter. The existing batched
reads already avoid repeated read/write layout passes. Further vendor-chunk
splitting was not justified by a measured bottleneck in the installed popup.

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
