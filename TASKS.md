# Extension Zed Tasks

Prioritized backlog for the Chrome extension. Keep this file focused on work that is valid for the current product and remove ideas that are no longer planned.

## Current Product

Current popup tabs: **Misc**, **Extensions**, **YouTube**, and **Settings**.

Implemented capabilities:

- Keyboard shortcut (`Alt+Z`) to toggle the extension popup
- Page background and text color controls with reset flows and curated presets (Dark, High Contrast, Sepia, Solarized)
- Main, all-scrollbar, and custom non-layout-shifting scrollbar controls
- Playback-rate presets, fine-stepping, and automatic site persistence
- Design mode, inspect mode, and Arabic RTL mode
- Page timestamp and publication age inspector
- Video quality selector with fallback options (prefer higher / prefer lower quality)
- Installed extensions management tab with search, status toggles, reload, and uninstall flows
- YouTube focus mode, progress-bar controls, duration hiding, half-screen layout, and timestamp bookmarks/markers
- Persistent dark theme, defaulting to dark
- Success/error toast feedback for page actions
- Settings schema versioning (v1), file size & JSON validation, export/import, and factory reset flow
- Full Chrome Web Store metadata and permissions documentation (`CHROMEWEBSTORE.md`)

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
| [x] | Use Bun as the single package manager and keep only its lockfile. |
| [x] | Keep `bun run lint` passing with zero warnings. |
| [x] | Keep `bun run build` passing before loading `dist/` into Chrome. |
| [x] | Add focused unit tests for playback presets, storage helpers, and import/export validation. |
| [x] | Add a documented manual injection smoke-test checklist. |
| [x] | Remove or merge the unused legacy `src/index.css`. |
| [x] | Add a short contributor guide for adding a popup action and injected script. |

## Current Tabs

### Misc

Implemented:

- Playback speed controls
- Volume boost for page audio and video up to 2000%
- Preferred video quality collapsible with automatic resolution matching and selectable fallback options:
  1. Prefer higher quality
  2. Prefer lower quality
- Page colors
- Scrollbar controls
- Design mode
- Inspect mode
- Arabic RTL mode toggle

Completed additions:

| Status | Task |
|---|---|
| [x] | Add custom scrollbar styling without changing page layout unexpectedly. |
| [x] | Add saved page-theme presets for dark, grayscale, and custom colors. |
| [x] | Add volume boost for page audio and video with a capped 20× gain and safety warning. |
| [x] | Define a useful timestamp/age feature before implementation. |

Defer until there is a clear product and permission design:

- Ad blocking
- Clearing cookies, local storage, cache, or other site data

### Extensions

Implemented:

- Extension search and filtering
- Enable/disable toggles with instant rollback on failure
- Reload unpacked/installed extensions
- Uninstall confirmation flow
- Self-extension detection with direct navigation to Settings

### YouTube

Implemented:

- Focus mode
- Focus reset behavior
- Hide progress bar/time
- Hide controls
- Hide duration
- Half-screen layout
- Timestamp bookmarks/markers

Good next additions:

| Status | Task |
|---|---|
| [ ] | Reduce brittle YouTube selectors and document fallback behavior when YouTube changes. |
| [ ] | Add YouTube enhancer features. |

Defer until the basics are stable:

- Broad ReVanced-style feature parity
- Fullscreen-by-default behavior
- Large annotation/highlight systems

### Settings

Implemented:

- Persistent dark theme, defaulting to dark
- JSON export/import of all `chrome.storage.local` settings

Completed additions:

| Status | Task |
|---|---|
| [x] | Add an export schema version migration strategy before changing stored data shapes. |
| [x] | Show import/export errors for file size, invalid JSON, unsupported versions, and storage failures. |
| [x] | Add a reset-settings action with confirmation and a documented list of reset keys. |
| [x] | Add first-run permission and privacy explanation. |

## Planned Product Areas

These are valid future directions, but should not be started until P0/P1 work is stable.

### Productivity

| Status | Task |
