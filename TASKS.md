# Extension Zed Tasks

Prioritized backlog for the Chrome extension. Keep this file focused on work that is valid for the current product and remove ideas that are no longer planned.

## Current Product

Current popup tabs: **Misc**, **YouTube**, **Shortcuts**, and **Settings**.

Implemented capabilities:

- Page background and text color controls with reset flows
- Main and all-scrollbar hide/reset controls
- Playback-rate presets, persistence, and shortcuts
- Design mode and inspect mode
- YouTube focus mode, progress-bar controls, and reset behavior
- Shortcut listing from the Chrome manifest
- Persistent dark theme, defaulting to dark
- Success/error toast feedback for page actions
- Settings export/import for all `chrome.storage.local` data

## Priority Order

Work through these groups in order. A task should move to Done only after implementation and verification.

### P0: Reliability And Correctness

| Status | Task |
|---|---|
| [ ] | Fix and verify Design Mode on normal pages, single-page apps, hostile pages, and restricted Chrome pages. |
| [ ] | Add regression checks for every injected action: apply, toggle, reset, and failure feedback. |
| [ ] | Make every injected visual change fully reversible using Zed-owned classes or style elements. |
| [ ] | Handle popup startup/storage failures with clear fallback UI instead of silent failure. |
| [ ] | Verify settings import with malformed, older, and partially populated JSON files. |

### P1: Security And Permissions

| Status | Task |
|---|---|
| [ ] | Audit `activeTab`, host access, persistent content scripts, and `scripting` usage. Remove access that is not required. |
| [ ] | Document the permissions required by each feature before adding new capabilities. |
| [ ] | Add an explicit warning and scope before any feature that clears cookies, storage, cache, or site data. |
| [ ] | Decide whether user-injected scripts are in scope. If yes, design sandboxing and warnings before implementation. |

### P1: Engineering Quality

| Status | Task |
|---|---|
| [ ] | Refactor background action routing into a typed event registry with shared command handling. |
| [ ] | Choose npm or pnpm as the single package manager and keep only its lockfile. |
| [x] | Keep `pnpm lint` passing with zero warnings. |
| [x] | Keep `pnpm build` passing before loading `dist/` into Chrome. |
| [ ] | Add focused unit tests for playback presets, storage helpers, and import/export validation. |
| [ ] | Add a documented manual injection smoke-test checklist. |
| [ ] | Remove or merge the unused legacy `src/index.css`. |
| [ ] | Add a short contributor guide for adding a popup action, injected script, and command. |

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

### Shortcuts

Implemented:

- Manifest command list and current keybindings

| Status | Task |
|---|---|
| [ ] | Group shortcuts by feature and show commands whose keys are not assigned. |
| [ ] | Add a clear link or instruction for `chrome://extensions/shortcuts`. |
| [ ] | Keep the four-default-`suggested_key` limit documented for contributors. |

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
|---|---|
| [ ] | Build a Pomodoro timer using `chrome.alarms`, with optional notifications. |
| [ ] | Add reminders only after defining scheduling, quiet hours, and notification settings. |
| [ ] | Add a lightweight snoozable “remember this” item. |

### Bookmarks And New Tab

| Status | Task |
|---|---|
| [ ] | Decide whether bookmark sync is local-only, Chrome-sync based, or integration based. |
| [ ] | Build a curated bookmark new-tab page after the sync decision. |
| [ ] | Add optional rotating quote, ayah, Vim tip, or remembrance content. |

### Capture And Share

| Status | Task |
|---|---|
| [ ] | Add a context-menu “Save to Zed” action after defining the saved item format. |
| [ ] | Add page/post capture to an image only after choosing supported sites and permissions. |
| [ ] | Add Instagram-friendly capture flows if they fit the extension permission model. |

### Integrations

Treat each integration as a separate permission and authentication project.

| Area | Candidates |
|---|---|
| Knowledge management | Notion, Mesbah Matrix, Savvy |
| Google | Tasks, Calendar, Keep |
| Social/media | YouTube APIs, Instagram, X, Facebook |

### Media

| Status | Task |
|---|---|
| [ ] | Document browser download limitations and store-policy constraints. |
| [ ] | Decide whether yt-dlp belongs in a separate native host project rather than the extension. |

## Product Decisions To Make

- Keep the current four-tab information architecture until a tab has enough related features to justify splitting.
- Prefer reversible page changes and local storage before adding accounts or external services.
- Treat broad ad blocking, extension management, site-data clearing, and ReVanced parity as separate projects, not ordinary backlog items.
- Do not add a new permission without documenting its user-facing reason.

## References

- [README.md](./README.md)
- [Adding a feature](./README.md#request-flow-typical-feature)
- [Chrome extension shortcuts](chrome://extensions/shortcuts)
