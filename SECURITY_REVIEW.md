# Security review — 2026-11-15

Scope: focused review of runtime message dispatch, saved-item writes, settings import, screenshot sessions, manifest permissions, dependency installation, and release checks. This is not a full penetration test or git-history secret scan.

## Threat model

Untrusted inputs include page URLs and selected text, content-script messages, imported JSON, page-world player state, and native messaging requests. Assets include saved content, preferences, screenshot pixels, browser management capabilities, and companion-owned blocking policy. A compromised page/content script must not be treated as the popup or granted arbitrary native actions. Malformed payloads must not trigger storage writes or unbounded text processing.

Existing controls include extension sender checks, popup-only limiter/link/start-capture operations, per-tab screenshot session tokens, settings allowlists and a 512 KB import cap, optional management permission, and native message size limits. Production dependencies have no reported vulnerabilities in Bun's audit at review time.

## Changes

- Validate saved-item operation and field types before reading storage; cap incoming URLs at 16,384 characters and selected text at 65,536 characters. Existing saved data is unchanged. Regression tests cover malformed and oversized messages.
- Update Vitest, ESLint, TypeScript ESLint, PostCSS and Tailwind PostCSS within declared ranges. This removes the reported Vitest mock-registration/traversal and source-map-js advisories.
- Disable dependency lifecycle scripts in documented installation and release CI; no dependency scripts were executed during the update. CI retains the frozen lockfile, audits production dependencies, and also runs on lockfile changes.

## Deferred development dependency advisories

Review again by **2026-11-29**, or before accepting untrusted lint inputs. No forced upgrades or overrides were applied.

| Dependency | Remaining advisories | Reachability and reason for deferral |
| --- | --- | --- |
| brace-expansion 5.0.9 | GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, GHSA-q2hr-2g5m-vwhr | Nested under TypeScript ESLint's minimatch 10.2.6, which pins this version. Lint-time glob processing; absent from the extension runtime. Wait for a compatible upstream update. |
| minimatch 10.2.6 | GHSA-g3hv-75wg-m249 | TypeScript ESLint requires major 10; fixed major 11 is outside that range. Development lint path only. Avoid linting attacker-supplied projects/configuration until upgraded. |
| zod 4.5.4 | GHSA-mrhx-c7xc-m3w5 | React Hooks ESLint plugin pins this version. Development lint validation only; absent from runtime. Wait for upstream rather than overriding its exact dependency. |

The full audit still reports **3 high and 2 moderate** advisories. The production audit is clean; this does not establish that development dependencies are safe for hostile input.

## Verification

Bun 1.4.4: frozen install with scripts disabled, 289 unit tests, lint/token checks, production build, build-asset validation, and production audit passed. All 15 Python companion tests passed. Browser end-to-end tests, a fresh empty-directory installation, administrator installation, OS policy changes, publishing, and a full history secret scan were not performed. The skill's referenced `../../references/security-checklist.md` was unavailable locally; its embedded checklist was used for applicable areas.
