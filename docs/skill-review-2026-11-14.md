# Sequential project skill review — 2026-11-14

Reviewed the current working tree, including pre-existing application edits. This was a review, not a remediation pass. No application code or dependencies were changed.

## Findings

1. **P1 — Dependency audit needs triage.** `bun audit` exits 1 with 14 advisories: 5 high, 8 moderate, 1 low. Affected tooling includes Vite 8.2.2, @vitest/mocker 5.0.0, brace-expansion, minimatch, source-map-js, and Zod. These are development/build dependencies; the audit alone does not establish shipped-extension exploitability. Update affected tooling and lockfile, then rerun checks. Confirm individual advisory conditions before assigning runtime risk. Sources: [Vite advisory](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [Vitest advisory](https://github.com/advisories/GHSA-qxg6-89mg-rqv8).

2. **P2 — Browser tests and performance guard target the old UI.** `scripts/test-extension-e2e.mjs:225` expects `Youtube`, no Shortcuts tab, ARIA tab roles, and accordion password controls. Current navigation uses buttons and `YouTube`, and includes Shortcuts. Result: 17/22 checks pass, five fail. `scripts/benchmark-popup.mjs:119` requires four `[role="tab"]` elements and six `details`; that condition can never hold for the current UI. Its readiness assertion fails before LCP measurement. Update selectors and behavioral assertions without weakening the timing budget. Browser installation, worker responsiveness, storage, and playback checks passed.

3. **P2 — Opening a tool drops focus to the document body.** `src/App.tsx:132` replaces the tile list with the detail view without moving focus. A browser probe focused and activated Password generator, waited for rendering, and observed `document.activeElement.tagName === "BODY"`. Move focus to an appropriate heading/control on entry and return it to the tile on Back. A Lighthouse snapshot of the password view scored Accessibility 100, demonstrating that automated scoring does not catch this workflow problem. This probe used DOM focus and activation; full trusted keyboard and screen-reader coverage remains outstanding.

4. **P2 — Store documentation omits current permissions and saved-content behavior.** Compare `public/manifest.json` with `CHROMEWEBSTORE.md:66`. The permission table omits `debugger`, `tabs`, `clipboardWrite`, and `contextMenus`. The privacy text says no content is stored while the Saved feature retains selected text and source URLs locally. Document these accurately before a store submission. No store publication was attempted.

5. **P2 — Saved-item content is omitted from settings exports.** `src/lib/settings.ts:171` exports only keys in `validators`; `savedItems` is handled specially by `readSetting` but is absent from that allowlist. Saved links export, but selected text/media saved under `savedItems` does not. A user treating Export as a full backup loses this content when restoring on another profile. Either include validated saved items with import/export tests or clearly state that Export covers preferences and links only.

6. **P3 — Successful context-menu saves have no visible confirmation.** `src/background.ts:96` calls `showResult` with success; `showResult` clears the badge and restores its existing title. It does not show a success badge/toast. Confirm saves in the originating page or with a visible badge; retain actionable failure feedback.

## Skill passes, in execution order

1. **modern-web-guidance:** Searched keyboard accessibility and retrieved `accessibility` and `html`; checked native semantics and focus changes. Finding 3. No modernization scan or UI rewrite.
2. **chrome-extensions:** Reviewed manifest, worker registration, message handling, screenshot sender/session validation, context menus, and store documentation. Findings 4 and 6. Manifest V3, action declaration, and packaged assets are present. In-memory promise queues are transient coordination, not lost durable preferences; no blanket replacement was recommended.
3. **chrome-extension-best-practices:** Reviewed lifecycle, storage operations, validation, and tests. Top-level listener registration and durable preference storage are present; all 239 unit tests pass. Finding 5. Broad HTTP(S) access supports persistent page features and is not flagged merely for being broad.
4. **chrome-extension-ui:** Reviewed popup navigation, accessible button names, dialogs, and feedback. Findings 3 and 6. Zed Dark remains the local design authority.
5. **vercel-react-best-practices:** Reviewed App, ExtensionsTab, and useStoredValue effects/subscriptions. Each useStoredValue instance makes a separate storage read and subscription; App mounts many instances. This is a profiling candidate, not a measured performance defect. No SWR dependency or speculative memoization was added. Next.js/SSR rules do not apply to this Vite popup.
6. **accessibility:** Inspected the rendered accessibility tree, ran the focus probe, and ran Lighthouse snapshot mode on the password view: Accessibility 100. Finding 3 remains. No conformance claim; other views, zoom, forced colors, and screen-reader testing were not exhaustively covered. SEO and agent-discovery audits were irrelevant to this packaged extension and were not treated as product defects.
7. **security-and-hardening:** Reviewed boundaries from page scripts to worker messages, screenshot tokens, imported settings, and password randomness. Screenshot messages check sender/session; password generation uses crypto.getRandomValues with rejection sampling. Native dependency audit produced finding 1. No claim of a complete penetration test.
8. **performance-optimization:** Production build passes. Popup JS: 316.53 kB raw / 99.65 kB gzip. Existing toolbar benchmark fails on obsolete readiness selectors (finding 2), so no fresh LCP result or optimization claim. No runtime optimization made without evidence.
9. **playwright-chrome-extension-testing:** Applied the built-extension/headless/service-worker checklist to the existing Chrome DevTools MCP suite rather than installing a second test framework. Built dist loads in headless Chromium; suite result 17/22 (finding 2). The test script hardcodes this machine's Chromium path, which also limits portability.

## Checks

- `bun run test`: 27 files, 239 tests pass.
- `bun run lint`: pass, including design-token check.
- `bun run build`: pass.
- `bun run check:build`: pass.
- `bun audit`: fail, 14 advisories.
- `node scripts/benchmark-popup.mjs`: fail, stale readiness assertion.
- `bun run test:e2e`: fail, 17/22 pass.
- Focused Lighthouse accessibility snapshot: 100 on Password generator view.

## Sharing project skills

Commit `.agents/skills/` and `AGENTS.md` together so the same guidance follows the repository. These are copies, not absolute symlinks. The catalog README now uses upstream source URLs instead of the local home-directory source path. Preserve applicable upstream attribution/license terms. Some imported skills contain references outside their own directory that are absent from standalone copies; consult upstream when a reference is missing.

Do not include unrelated application edits in a skills-only commit. No commit or push was performed.
