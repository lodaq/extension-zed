# Extension Zed — tasks & backlog

Living checklist derived from [README.md](./README.md), product vision, and follow-up ideas.  
**Tabs** below map to popup information architecture: **current** tabs first, then **target** tabs when you split the UI.

_(Consolidated with former `tasks.md` — context menu item preserved under [Capture & share](#capture--share).)_

---

## How to use

- Check items off as you ship them (`[x]` / `[ ]`).
- Prefer **reversible** page changes and **clear permissions** for new capabilities.
- Large items → link PRs or issues in parentheses when useful.

---

## Current popup tabs (today)

Tabs: **Misc**, **YouTube**, **Shortcuts**, **Download** (Alt+Q / W / E / L).

### Misc tab — page & video toolbox

| Status | Task |
|--------|------|
| [x] | Page background / text color pickers + storage + reset flows |
| [x] | Hide main scrollbar + hide all scrollbars + per-mode reset |
| [x] | Playback rate presets + shortcuts + active-speed UI |
| [ ] | **Design mode:** fix toggle — currently not working reliably (verify MAIN-world injection, storage race, hostile pages) |
| [x] | Inspect mode toggle (hover highlight) |
| [x] | Popup layout: sections, spacing, shortcut chips |
| [ ] | **Scrollbar polish:** custom scrollbar *styling* tab (not only hide) |
| [ ] | **Volume / audio:** boost tab volume or per-tab gain (needs API research) |
| [ ] | **Page themes:** one-click dark / grayscale / saved theme presets |
| [ ] | **“Fresh tab”:** clear cookies, `localStorage`, cache for current origin (permissions + UX) |
| [ ] | **Timestamps / age:** show relative time or ms somewhere (define: status bar vs injected badge) |
| [ ] | **Web notes / inbox:** quick capture from page → local list or export |
| [ ] | **Ad blocker** (heavy; scope: cosmetic vs network — decide before building) |
| [ ] | **Extension manager:** disable other extensions except Zed (permissions + warnings) |

### YouTube tab

| Status | Task |
|--------|------|
| [x] | Focus mode script |
| [x] | Reset layout script |
| [x] | Hide progress bar / time (`hideYoutubeProgressBar` + popup control) |
| [ ] | Hide duration always vs on-demand (align all progress UI tweaks) |
| [ ] | Highlights, markers, bookmarks, notes (Readwise-style export optional) |
| [ ] | Auto half-screen / side-by-side layout |
| [ ] | Optional fullscreen-by-default |
| [ ] | Survey **ReVanced**-style features; pick a small subset that survives DOM changes |
| [ ] | Reduce reliance on brittle selectors; document break-glass when YouTube updates |

### Shortcuts tab

| Status | Task |
|--------|------|
| [x] | List Chrome commands + keybindings from manifest |
| [ ] | Surface “not set” bindings with link hint to `chrome://extensions/shortcuts` |
| [ ] | Group shortcuts by tab / feature in the list |
| [ ] | Document **4 suggested_key limit** for new contributors |

## Target popup tabs (information architecture)

Use these buckets when the feature set outgrows **Misc / YouTube / Shortcuts** — future splits may still use these buckets.

### Home (future tab)

| Status | Task |
|--------|------|
| [ ] | At-a-glance: last used actions, pinned toggles |
| [ ] | Optional quote / ayah / tip of the day (from bookmarks & new-tab ideas) |

### Reading (future tab)

| Status | Task |
|--------|------|
| [ ] | Article / reader mode (column width, font size, colors) |
| [ ] | Save article to reading list (local or sync) |
| [ ] | Typography presets (serif/sans, line height) |

### Productivity (future tab)

| Status | Task |
|--------|------|
| [ ] | **Pomodoro** mini-app (`chrome.alarms` + optional notifications) |
| [ ] | **Reminders:** posture, azkar, salah, eyes, exercise, custom |
| [ ] | Lightweight “remember this” with snooze |

### Coding / dev (future tab)

| Status | Task |
|--------|------|
| [ ] | Page design mode + inspect shortcuts grouped here if audience is devs |
| [ ] | Optional: JSON viewer / quick console helpers (scope tightly) |

### Scripts (future tab)

| Status | Task |
|--------|------|
| [ ] | User-defined or preset injected snippets (dangerous — sandbox + warnings) |
| [ ] | Registry UI for `background.js` events → scripts (see tech debt) |

### Pomodoro (future tab)

| Status | Task |
|--------|------|
| [ ] | Standalone tab OR merge under **Productivity** (pick one IA) |
| [ ] | Sound optional; respect focus / DND |

---

## Bookmarks & new tab

| Status | Task |
|--------|------|
| [ ] | Bookmark sync story (less import/export friction) |
| [ ] | New tab page: curated bookmarks |
| [ ] | Random card: quote, ayah, Vim tip, life hack, remembrance |

---

## Integrations (modules — later)

Treat each as a **separate permission story** (OAuth, official APIs, or safe patterns).

| Area | Ideas |
|------|--------|
| Notes / PKM | Notion, Mesbah Matrix, Savvy |
| Google | Tasks, Calendar, Keep |
| Social | YouTube (beyond scripts), Instagram, X, Facebook |

---

## Capture & share

| Status | Task |
|--------|------|
| [ ] | Tweet/post → shareable image (Pikaso-style) |
| [ ] | Instagram-friendly screenshot flows |
| [ ] | Context menu **“Save to Zed…”** / save entry (`chrome.contextMenus` + permission) |
| [ ] | **Chrome context menu:** add a **Save** action (from legacy `tasks.md`; align label + target with extension policy) |

---

## Media

| Status | Task |
|--------|------|
| [ ] | In-extension downloads policy (store rules) |
| [ ] | Document external tools (e.g. `yt-dlp`) vs in-browser limits |
| [x] | Align with [Download tab](#download-tab): yt-dlp native host |

---

## Engineering & quality

| Status | Task |
|--------|------|
| [x] | Tailwind entry: `main.tsx` → `main.css` |
| [x] | `youtubeProgressBar.js` wired via `hideYoutubeProgressBar` |
| [ ] | **Refactor `background.js`:** map `event → script path` or registry (~8+ events now) |
| [ ] | Merge or delete legacy `src/index.css` (unused entry) |
| [ ] | Tests for playback presets / storage keys (where valuable) |
| [ ] | CONTRIBUTING snippet: add script + manifest command + popup row |
| [ ] | **Design mode:** root-cause + regression check on representative sites (see Misc tab) |

---

## Cross-cutting UX

| Status | Task |
|--------|------|
| [ ] | Reversible injected changes: prefer removable `<style id>` or class hooks |
| [ ] | Settings backup / export `chrome.storage.local` |
| [ ] | Onboarding: first-run permissions explanation |

---

## Reference

- **README roadmap:** [README.md § Roadmap](./README.md#roadmap-organized)
- **Adding a feature:** [README.md § Request flow](./README.md#request-flow-typical-feature)
- **Chrome commands cap:** max **four** default `suggested_key` (includes popup open)



## other tasks and ideas (yet to organize )

- settings page