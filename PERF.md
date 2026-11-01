# Performance evidence

Measured on 2026-11-01 against the working tree including the architecture fixes and password generator. Field data is unavailable: this is a local Chrome extension with no RUM collection or eligible public CrUX URL. These are lab observations, not field INP/LCP claims.

## Evidence

| Signal | Conditions | Before | After |
| --- | --- | --- | --- |
| RTL enable, including final layout | 200 blocks / 1,200 elements; median of 5 timed samples after one warmup | 141.6 ms; range 127.7–165.2 | 28.5 ms; range 27.7–40.1 |
| Layouts within each traced RTL enable | Separate trace; one warmup and one measured enable | 401 in both calls | 1 in both calls |
| Elements changed / reset | Same fixture, all measurements | 1,001 changed; none left marked after reset | Identical |
| Popup DOMContentLoaded | Three warm navigations, diagnostic only | Median 48.5 ms; range 32.1–52.1 | Not targeted or remeasured |
| Popup FCP | Browser paint entries | Only one of three runs reported a value (92 ms); insufficient evidence | Not targeted |
| Initial popup JavaScript | Node `gzipSync`, popup plus shared settings chunk | 297,644 bytes raw / 92,028 bytes gzip | Popup source unchanged |
| Popup CSS | Node `gzipSync` | 27,831 bytes raw / 5,955 bytes gzip | Unchanged |

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

## Reproduce and guard

```sh
pnpm build
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

A separate five-sample browser run passed this budget after the fix (`/tmp/zed-rtl-budget.json`). All 52 tests, lint, production build, packaging checks, and whitespace checks passed.

`src/lib/arabicRtlMode.test.ts` provides the deterministic CI guard: rendered-text reads must finish before writes for both initial application and mutation batches. It also verifies explicit directions and alignment restoration. The manual browser budget checks the actual latency; there is no browser-performance CI infrastructure or field monitor in this repository.

The preparation script writes only ignored `dist/perf/` artifacts and checks its application hook. The fixture asserts unchanged behavior during every sample. A normal `pnpm build` removes these diagnostic files; they are not part of the production source or manifest.

## Experiment ledger

| Idea | Baseline → result | Verdict | Reason |
| --- | --- | --- | --- |
| Batch RTL rendered-text reads before writes | Median 141.6 → 28.5 ms; layouts per enable 401 → 1 | Kept | Timing ranges do not overlap; matching/reset assertions and regression tests pass |

No other optimization was attempted. Popup lazy loading, password RNG changes, and blanket memoization had no measured justification and were left alone.

## Remaining hypotheses and limits

- Playback scans all videos on every subtree mutation (`src/lib/playback.ts`). Verify with a trace on a controlled page with many DOM updates and videos before changing it.
- RTL tests cover 1,200 fixture elements, not arbitrary page sizes. Profile larger real pages, mixed/hidden text, and dynamic text replacement before further changes.
- Popup paint measurements were incomplete, so DOMContentLoaded is only a loading diagnostic. No LCP, field INP, CLS, cold-start, or low-end-device improvement is claimed.
- Field verification remains unavailable until actual user-session data is collected; telemetry was not added for this local extension.
