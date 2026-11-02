# Extension Zed Tasks

Prioritized backlog for the Chrome extension. Keep this file focused on work that is valid for the current product and remove ideas that are no longer planned.

## Current Product

Current popup tabs: **Misc**, **YouTube**, and **Settings**.

Implemented capabilities:

- Page background and text color controls with reset flows
- Main and all-scrollbar hide/reset controls
- Playback-rate presets and persistence
- Design mode and inspect mode
- YouTube focus mode, progress-bar controls, and reset behavior
- Persistent dark theme, defaulting to dark
- Success/error toast feedback for page actions
- Settings export/import for all `chrome.storage.local` data

## Priority Order

Work through these groups in order. A task should move to Done only after implementation and verification.

### P0: Reliability And Correctness

| Status | Task |
|---|---|
| [x] | Fix and verify Design Mode on normal pages, single-page apps, hostile pages, and restricted Chrome pages. |
| [x] | Add regression checks for every injected action: apply, toggle, reset, and failure feedback. |
| [x] | Make every injected visual change fully reversible using Zed-owned classes or style elements. |
| [x] | Handle popup startup/storage failures with clear fallback UI instead of silent failure. |
| [x] | Verify settings import with malformed, older, and partially populated JSON files. |

### P1: Security And Permissions

| Status | Task |
|---|---|
| [x] | Audit `activeTab`, host access, persistent content scripts, and `scripting` usage. Remove access that is not required. |
| [x] | Document the permissions required by each feature before adding new capabilities. |
| [x] | Add an explicit warning and scope before any feature that clears cookies, storage, cache, or site data. |
| [x] | Decide whether user-injected scripts are in scope. If yes, design sandboxing and warnings before implementation. |

### P1: Engineering Quality

| Status | Task |
|---|---|
| [x] | Refactor background action routing into a typed event registry. |
| [x] | Choose npm or pnpm as the single package manager and keep only its lockfile. |
| [x] | Keep `pnpm lint` passing with zero warnings. |
| [x] | Keep `pnpm build` passing before loading `dist/` into Chrome. |
| [x] | Add focused unit tests for playback presets, storage helpers, and import/export validation. |
| [x] | Add a documented manual injection smoke-test checklist. |
| [x] | Remove or merge the unused legacy `src/index.css`. |
| [x] | Add a short contributor guide for adding a popup action and injected script. |

## Current Tabs

### Misc

Implemented:

- Playback speed controls
- Page colors
- Scrollbar controls
- Design mode
- Inspect mode
- Volume boost for page audio and video up to 2000%
- Arabic RTL mode toggle

Good next additions:

| Status | Task |
|---|---|
| [ ] | Add custom scrollbar styling without changing page layout unexpectedly. |
| [ ] | Add saved page-theme presets for dark, grayscale, and custom colors. |
| [x] | Add volume boost for page audio and video with a capped 20× gain and safety warning. |
| [ ] | Define a useful timestamp/age feature before implementation. |

Defer until there is a clear product and permission design:

- Ad blocking
- Clearing cookies, local storage, cache, or other site data
- Disabling or managing other extensions

### YouTube

Implemented:

- Focus mode
- Focus reset behavior
- Hide progress bar/time
- Hide controls

Good next additions:

| Status | Task |
|---|---|
| [ ] | Reduce brittle YouTube selectors and document fallback behavior when YouTube changes. |
| [ ] | Add hide-duration behavior as a deliberate extension of the progress controls. |
| [ ] | Add lightweight markers/bookmarks with local storage and export. |
| [ ] | Add optional half-screen layout after validating it across common YouTube layouts. |

Defer until the basics are stable:

- Broad ReVanced-style feature parity
- Fullscreen-by-default behavior
- Large annotation/highlight systems

### Settings

Implemented:

- Persistent dark theme, defaulting to dark
- JSON export/import of all `chrome.storage.local` settings

| Status | Task |
|---|---|
| [ ] | Add an export schema version migration strategy before changing stored data shapes. |
| [ ] | Show import/export errors for file size, invalid JSON, unsupported versions, and storage failures. |
| [ ] | Add a reset-settings action with confirmation and a documented list of reset keys. |
| [ ] | Add first-run permission and privacy explanation. |

## Planned Product Areas

These are valid future directions, but should not be started until P0/P1 work is stable.

### Reading

| Status | Task |
|---|---|
| [ ] | Build reader mode with width, font, line height, and color controls. |
| [ ] | Add a local reading list only after deciding how pages are captured and restored. |
| [ ] | Add typography presets. |

### Productivity

| Status | Task |
