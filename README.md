# Extension Zed

**Tagline:** From A to Z — enhance your browsing experience.

Personal **Chrome extension (Manifest V3)** for quick page tweaks (colors, scrollbars, playback rate, design mode, YouTube layout experiments) and a long-term roadmap toward reading tools, reminders, integrations, and capture workflows.

---

## Cursor / AI reference (read this when editing code)

Use this section as the source of truth for **how the repo is wired** and **how to add features safely**.

### What this project is

- **Popup UI:** Vite + React + TypeScript + shadcn-style UI (Radix tabs, `class-variance-authority`, Tailwind tokens in CSS variables).
- **Extension shell:** `public/manifest.json` — action popup points at built `index.html`, background is `public/background.js` (service worker).
- **Page automation:** The popup does **not** run on web pages. It resolves the active tab, then either:
  - sends `chrome.runtime.sendMessage({ event, tabId })` to the **background**, which runs `chrome.scripting.executeScript` with a file from `public/scripts/`, or
  - in some components, calls `chrome.scripting.executeScript` directly with an **inline `func`** (see `YoutubeFocusMode.tsx`).

### Request flow (typical feature)

1. User acts in popup → component calls `chrome.tabs.query({ active: true, currentWindow: true })` → `activeTabId`.
2. Optional: persist settings with `chrome.storage.local` (keys should stay consistent with injected scripts).
3. `chrome.runtime.sendMessage({ event: "<camelCaseEvent>", tabId })`.
4. `public/background.js` `onMessage` handler matches `data.event` and injects `files: ["scripts/<name>.js"]` (paths are relative to the extension root after build — Vite copies `public/` into `dist/`).

**Adding a new injected behavior**

1. Add `public/scripts/myFeature.js` (plain JS; runs in page context).
2. Add a branch in `public/background.js` for `data.event === "myFeature"` → `executeScript` with that file.
3. Add a React control in `src/components/` that sends `{ event: "myFeature", tabId }`.
4. Export the component from `src/components/index.ts` and mount it in `src/App.tsx` (or a future tab/section).

### Permissions (manifest)

Current: `scripting`, `activeTab`, `storage`; host access `http(s)://*/*`. **Build → load `dist/` → Reload** the extension after changes. New capabilities (e.g. `downloads`, `contextMenus`, `alarms`) require updating `public/manifest.json` and a reason in the store listing if you publish.

**Chrome command shortcut cap:** An extension may define at most **four** default `suggested_key` bindings in `commands` (this includes `_execute_action` for opening the popup). Any extra commands must omit `suggested_key`; users assign keys in `chrome://extensions/shortcuts`.

### Path alias

`@/` → `src/` (see `vite.config.ts`).

### Build & load in Chrome

```bash
npm install
npm run build
```

Load **Unpacked** extension from the `dist/` folder (after build). `npm run dev` is for normal web dev; the extension expects the built bundle plus copied `public/` assets.

### Known issues / tech debt (important for contributors)

| Issue | Detail |
| --- | --- |
| **Legacy CSS** | `src/index.css` is unused by the popup entry (`main.tsx` imports `main.css`). Delete or merge if you want a single style entry. |
| **YouTube progress script** | `youtubeProgressBar.js` relies on YouTube class names; add a popup control that sends `hideYoutubeProgressBar` when you want this wired in the UI. |
| **Scalability** | `background.js` will grow as a long `if/else` chain; consider a small map `event → script path` or a shared registry when you add many features. |

---

## Tech stack

- **Build:** Vite 4, TypeScript, `@vitejs/plugin-react`
- **UI:** React 18, Radix UI primitives, Tailwind 3, `tailwindcss-animate`
- **Extension:** Chrome MV3, `chrome.scripting` + `chrome.storage` + `chrome.tabs`

---

## Repository layout (mental map)

| Area | Role |
| --- | --- |
| `src/App.tsx` | Popup layout; tabs and feature entry points |
| `src/components/` | Popup controls; message sending / `executeScript` |
| `src/components/ui/` | Reusable UI primitives (button, tabs, label) |
| `public/manifest.json` | Extension identity, permissions, popup path, commands (`Alt+Z` opens action) |
| `public/background.js` | Service worker: routes messages → script injection |
| `public/scripts/*.js` | Content-world scripts (no bundler; keep them small and defensive) |

---

## Product vision & summary

**Today:** A toolbox popup to tweak the **active tab** — page colors, scrollbars, video playback rate, design mode, inspect helpers, and experimental YouTube “focus” layout.

**Direction:** Grow into a modular “Zed” suite: reading/article mode, YouTube notes/highlights, reminders (posture, azkar, salah, eyes, custom), integrations (Notion, Google, social), new-tab surfaces, capture/share (tweet/post to image), sync hooks, and optional “clear site data / incognito-like reset” style actions — all behind clear permissions and reversible toggles where possible.

**Design principle (from your notes):** Prefer **reversible changes** (toggle off restores prior state) and a **scalable structure** before the feature list explodes.

---

## Roadmap (organized)

### General / page

- [ ] Hide scrollbar(s) — partial groundwork (`hideMainScrollBar`, `hideAllScrollBars`)
- [ ] Ad blocker
- [ ] Extension manager (disable others except this — needs careful UX + permissions)
- [ ] Show “age” or timestamps in ms (define scope)
- [ ] Dark mode / grayscale / custom page & background colors — related to current color scripts
- [ ] Boost volume / custom `playbackRate` — playback partial
- [ ] One-click clear cookies, `localStorage`, cache, etc. (“fresh incognito” feel)
- [ ] Web notes / “video notebook” / save-anything inbox
- [ ] Hide YouTube duration (always / on demand) — align with missing `youtubeProgressBar.js`

### Reading

- Article reader / reading mode (width, font size, background/text colors)

### YouTube

- [ ] Highlights, markers, bookmarks, notes; Readwise-style highlights
- [ ] Auto half-screen layout
- [ ] Fullscreen-by-default (optional)
- Ideas: browse extension store for patterns; avoid brittle DOM selectors long-term
- add all features from youtube revanced

### Bookmarks & new tab

- [ ] Bookmark sync story (less import/export friction)
- [ ] New tab page with curated bookmarks
- [ ] “Random” tab ideas: quote, ayah, Vim tip, life hack, remembrance

### Integrations (future)

Mesbah Matrix, Savvy, Notion, Google Tasks/Calendar/Keep, Facebook, YouTube, Instagram, X — each needs OAuth/API or official extension patterns; treat as separate modules.

### Reminders

Posture, azkar, generic remembers, salah, exercise, eyes, custom — likely `chrome.alarms` + optional notifications.

### Capture / share

Tweet/post → image (Pikaso-style), Instagram screenshot flows.

### Media

- Download tab: **yt-dlp** via native messaging (`native-host/`); not the same as `chrome.downloads` for arbitrary URLs

### Productivity / misc

- [ ] Custom scrollbar styling tab
- [ ] Keyboard shortcuts / commands (beyond `_execute_action`)
- [ ] Pomodoro mini-app
- [ ] Context menu “save” entry (`tasks.md`)

### UI tabs (target information architecture)

Home, YouTube, Misc, Reading, Productivity, Coding, Scripts, Pomodoro — migrate from the current tab layout when features group cleanly (popup currently has **Misc** + **Youtube**).

---

## Inspiration

- [google-search-result-hotkeys](https://github.com/FarisHijazi/google-search-result-hotkeys) — keyboard UX on top of the open web

---

## Misc notes

**Revertible UI pattern (React-style sketch):**

```html
<button onClick="{inspect}">inspect</button>
<!-- becomes -->
<button onClick="{handleInspect}">
  {isInspected ? "unInspect" : "inspect"}
</button>
```

Apply the same idea in injected scripts: store previous inline styles / removed nodes is hard — prefer CSS classes or a single wrapper you can remove.

---

## Tasks (quick checklist)

- [x] Tailwind entry: `main.tsx` imports `main.css`
- [x] `youtubeProgressBar.js` present for `hideYoutubeProgressBar`
- [x] Color pickers use `chrome.storage.local` + React state
- [ ] Refactor background message routing when there are many events (~8+)
- [ ] Add Pomodoro, keyboard events, scrollbar tab (from original list)
