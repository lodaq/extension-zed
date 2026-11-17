# Extension Zed — Design Spec v1.1

Single source of truth for the redesigned popup: the design system, every screen and state, the behavior rules, and an acceptance checklist. Written for an AI coding agent (Codex) implementing it in an existing Chrome (Manifest V3) extension.

**Origin.** Merged from (1) the original popup mockup (`Main.dc.html`, 640 × 600, dark); (2) three states designed on top of it: Scrollbars status, Settings reset confirmation, Restricted page; and (3) the revisions made after reviewing the live extension: the six-tab bar with keyboard-hint chips, the **Saved** tab, the revised **Settings** screen, and the new **Video downloader** feature (Misc, built on yt-dlp). Two explored artboards were **removed by the owner and are out of scope**: an in-popup *Capture result* sheet and a *scrollbar preview* card. Do not build them.

**Companion files.** `extension-zed-design-reference.html` renders every screen at 640 × 600 plus the design system visually; open it in a browser. Where this document and the reference disagree on a number, this document wins.

**Precedence when things conflict.**
1. §2 Design system (visual rules)
2. §4 Screens (layout and content)
3. The extension's existing *behavior*, storage keys and message contracts (behavior wins over the mockup's mock logic; see §8)
4. The extension's existing visuals (all replaced)

**Not production code.** Mockup values are exact; mockup logic is placeholder. Sample data (links, extensions, the "current tab") is fake. Re-implement in the extension's own stack.

---

## 1. Product and constraints

| Item | Value |
|---|---|
| Product | Extension Zed, a local browser toolbox |
| Surface | Browser-action popup, fixed **640 × 600 px** |
| Theme | Dark only. The popup UI itself has no light mode |
| Language | English, LTR chrome (the *Arabic RTL mode* feature affects web pages, not the popup) |
| Network | The extension itself makes **no** network calls: no analytics, no remote fonts, no remote icons. Settings, saved items and captures stay on the device. The only outbound traffic is the user’s own downloads, performed by yt-dlp on their machine (§4.18) |
| Native helper | The Video downloader needs a local **native messaging host** that runs yt-dlp (§4.18). Everything else works without it |
| Font | Inter, **bundled locally** (MV3 extension pages cannot rely on Google Fonts). Weights 400, 500, 600, 700 |
| Icons | Inline SVG, 24-unit viewBox, stroke only (see §2.7). No emoji anywhere in the UI |

Product description (verbatim, used in Settings → About):
> A local browser toolbox for screenshots, video speed and quality, volume boost, YouTube layout, password generation, page inspection and editing, scrollbars, Arabic text, and extension management. Your settings and captures stay on your device.

---

## 2. Design system ("Zed Dark")

### 2.1 Principles

1. **Dense but calm.** A 640 px popup holds many tools; separate them with surface steps and 8 px gaps, not heavy borders or shadows.
2. **One accent.** Mint (`--zed-accent`) means *selected, active, primary action*. Nothing else uses it.
3. **One attention color.** Orange (`--zed-warn`) means *destructive or blocked*. Red and green are not used, so state never depends on hue alone.
4. **Big targets for frequent actions.** Primary actions are 52 px tall. Secondary actions are 44 px. Dense list actions are 32 px.
5. **State is never color-only.** Switches move a knob, pills carry text, selections change fill *and* text color.
6. **Quiet motion.** 140 ms ease on hover, tooltip and switch only; none under `prefers-reduced-motion`.

### 2.2 Tokens

Ship this as the default stylesheet (`tokens.css`), imported by the popup and by any UI the extension injects into pages (use Shadow DOM for injected UI so page CSS cannot leak in).

```css
:root {
  color-scheme: dark;

  /* ── Surfaces (low → high) ── */
  --zed-bg: #0E1218;               /* app background */
  --zed-bg-inset: #0A0D12;         /* inputs, password readout (recessed) */
  --zed-surface: #151A22;          /* cards, rows, tiles, back button */
  --zed-surface-hover: #1A212B;    /* tile hover */
  --zed-surface-raised: #1D2430;   /* secondary buttons, icon wells, key chips */
  --zed-surface-overlay: #222B38;  /* tooltip, toast, dialog */
  --zed-scrim: #06080CB8;          /* behind dialogs, ~72% */

  /* ── Borders ── */
  --zed-border-subtle: #1F2631;    /* cards, rows, tab bar divider */
  --zed-border: #28303D;           /* secondary buttons, back button */
  --zed-border-strong: #2F3846;    /* overlays, hover */
  --zed-border-dashed: #3A4556;    /* "+ Add" affordance */
  --zed-border-control: #6B7686;   /* text input, unchecked box, switch-off ring (3:1+) */

  /* ── Text and icons ── */
  --zed-text: #E8ECF2;
  --zed-text-soft: #C9D1DC;        /* body copy on overlays/banners */
  --zed-text-muted: #9AA4B2;       /* helper text, captions, inactive tabs */
  --zed-icon: #AEB8C6;
  --zed-icon-off: #6B7686;         /* icons of switched-off items */

  /* ── Accent (change only --zed-accent; tints derive) ── */
  --zed-accent: #5CE1C6;
  --zed-on-accent: #0E1218;
  --zed-accent-tint: color-mix(in srgb, var(--zed-accent) 14%, transparent);
  --zed-accent-line: color-mix(in srgb, var(--zed-accent) 40%, transparent);

  /* ── Attention (destructive, blocked) ── */
  --zed-warn: #F08A5D;
  --zed-on-warn: #0E1218;
  --zed-warn-tint: color-mix(in srgb, var(--zed-warn) 12%, transparent);
  --zed-warn-line: color-mix(in srgb, var(--zed-warn) 40%, transparent);

  /* ── Switch ── */
  --zed-switch-off: #2A3240;
  --zed-knob-off: #AEB8C6;

  /* ── Letter-avatar palette (text on it is --zed-on-accent) ── */
  --zed-avatar-1: #7AA2FF;
  --zed-avatar-2: #8FD9B6;
  --zed-avatar-3: #F2B880;
  --zed-avatar-4: #C9A7F0;
  --zed-avatar-5: #F08A5D;
  --zed-avatar-6: #7BD88F;
  --zed-avatar-neutral: #C4C9D4;

  /* ── Type ── */
  --zed-font: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --zed-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --zed-fs-display: 48px;  /* speed readout */
  --zed-fs-value: 40px;    /* amplification readout */
  --zed-fs-title: 18px;
  --zed-fs-lg: 16px;
  --zed-fs-md: 15px;
  --zed-fs-base: 14px;
  --zed-fs-sm: 13px;
  --zed-fs-xs: 12px;
  --zed-fs-2xs: 11px;

  /* ── Spacing (4 px base, with 2/6/10 for tight UI) ── */
  --zed-space-0: 2px;  --zed-space-1: 4px;  --zed-space-2: 6px;  --zed-space-3: 8px;
  --zed-space-4: 10px; --zed-space-5: 12px; --zed-space-6: 16px; --zed-space-7: 20px; --zed-space-8: 24px;

  /* ── Radius ── */
  --zed-radius-chip: 6px;       /* key chips */
  --zed-radius-check: 7px;      /* checkbox box */
  --zed-radius-inline: 8px;     /* 28 px inline buttons */
  --zed-radius-sm: 9px;         /* tabs, back, icon wells, avatars, 36 px icon buttons */
  --zed-radius-md: 10px;        /* inputs, 44 px buttons, shortcut rows, tooltip, toast */
  --zed-radius-lg: 12px;        /* 52 px buttons, rows, banner */
  --zed-radius-card: 14px;      /* cards, tiles */
  --zed-radius-dialog: 16px;
  --zed-radius-pill: 999px;     /* switch track, status pill */

  /* ── Control heights ── */
  --zed-h-inline: 28px;
  --zed-h-control: 36px;
  --zed-h-compact: 44px;
  --zed-h-primary: 52px;
  --zed-h-option: 64px;

  /* ── Layout ── */
  --zed-popup-w: 640px;
  --zed-popup-h: 600px;
  --zed-tabbar-h: 48px;
  --zed-subbar-h: 52px;
  --zed-page-pad: 12px;
  --zed-gap: 8px;

  /* ── Elevation and motion ── */
  --zed-shadow-pop: 0 8px 20px rgba(0, 0, 0, .45);
  --zed-shadow-dialog: 0 16px 40px rgba(0, 0, 0, .5);
  --zed-dur: 140ms;
  --zed-ease: ease;
}

@media (prefers-reduced-motion: reduce) {
  :root { --zed-dur: 0ms; }
}
```

If `--zed-accent` is ever changed, it must keep **≥ 4.5:1 against both `--zed-bg` and `--zed-on-accent`**.

### 2.3 Color usage and measured contrast (WCAG 2.2)

| Pair | Ratio | Use |
|---|---|---|
| `--zed-text` on `--zed-bg` | 15.8 : 1 | Body text |
| `--zed-text` on `--zed-surface` | 14.7 : 1 | Text on cards |
| `--zed-text-muted` on `--zed-bg` / `--zed-surface` / `--zed-surface-raised` | 7.5 / 6.9 / 6.2 : 1 | Helper text, inactive tabs, captions |
| `--zed-accent` on `--zed-bg` / `--zed-surface` | 11.7 / 10.8 : 1 | Accent text, badges |
| `--zed-on-accent` on `--zed-accent` | 11.7 : 1 | Primary button label, checked box, on-state knob |
| Accent on accent-tint (active tab, "Active" pill) | 7.9–8.7 : 1 | Selected tab, status pill |
| `--zed-text-soft` on `--zed-surface-overlay` | 9.3 : 1 | Tooltip, dialog body |
| `--zed-on-warn` on `--zed-warn` | 7.6 : 1 | Destructive button |
| `--zed-text-soft` on warn-tint (over bg) | 10.2 : 1 | Banner body |
| `--zed-warn` on warn-tint | 6.4 : 1 | Banner icon and title accents |
| `--zed-knob-off` on `--zed-switch-off` | 6.4 : 1 | Off-switch knob |
| `--zed-icon-off` on `--zed-surface` | 3.8 : 1 | Icons of switched-off items (non-text, ≥ 3 : 1) |
| `--zed-border-control` on inset / surface / raised | 4.2 / 3.8 / 3.4 : 1 | Form-control boundaries (≥ 3 : 1) |

Decorative hairlines (`--zed-border-subtle` 1.2 : 1, `--zed-border` ~1.5 : 1) are **not** relied on to identify controls; fill, text or icon do that.

**Intentional refinements to the original mockup** (small, accessibility-driven):
- **R1.** Text input border, unchecked box border and off-switch ring use `--zed-border-control` (original used `#28303D` / `#566070`, which fall below 3 : 1).
- **R2.** The text input gets a visible focus style (original had `outline: none`).
- **R3.** A global `:focus-visible` ring is defined (§2.9).
- **R4.** The "Reset settings to defaults" trigger gets an orange border (`--zed-warn`) to flag it as destructive.

### 2.4 Typography

Family: `--zed-font`. Numerals use default proportional figures, except the password readout (mono).

| Role | Size / weight / line-height | Notes |
|---|---|---|
| Display readout | 48 / 600 / 1, letter-spacing −0.02em | Speed value, `min-width: 160px`, centered |
| Value readout | 40 / 600 / 1, letter-spacing −0.02em | Amplification value, accent color |
| Section / page title | 18 / 600 | Sub-bar title, section headings |
| Large option | 16 / 600 | Quality options, capture option labels, password readout (mono, 400) |
| Button / row label | 15 / 600 (button), 15 / 500 (row label) | |
| Base | 14 / 600 (tabs, link title, flag title), 14 / 500 (back button, shortcut name), 14 / 400 (input) | |
| Small | 13 / 600 (tile title, badge), 13 / 400 (helper text, line-height 1.4–1.6) | |
| Caption | 12 / 400 (descriptions, URLs, versions), 12 / 600 (counts, key chips) | |
| Group header | 12 / 600, uppercase, letter-spacing .04em, muted | Shortcuts group names |
| Pill | 11 / 600 | Status pill |

Copy rules: sentence case; typographic punctuation (`’`, `“ ”`, `×`, `–` for ranges like `4–128`, `·` as separator, `…`, `→ ← ↑ ↓` for arrows); no exclamation marks.

### 2.5 Layout, spacing and sizing

- **Shell:** `640 × 600`, `display:flex; flex-direction:column; overflow:hidden; position:relative`.
  - **Tab bar** 48 px, bottom border 1 px `--zed-border-subtle`, padding `0 8px 0 12px`, gap 4.
  - **Sub-bar** 52 px (only on drill-in screens), padding `0 12px`, gap 10: Back button + title.
  - **Content** `flex:1; min-height:0; overflow:auto; padding:0 12px 12px`.
  - **Overlays** (toast, scrim + dialog) are absolutely positioned over the shell.
- **Grid gaps:** 8 px between cards/buttons; 6 px between list rows; 4 px between shortcut rows.
- **Top margin** of the first block in a content area: 12 px on list screens (Links, Shortcuts, Extensions, YouTube) and on the Misc grid; 0 on the drill-in screens (the sub-bar already provides space).
- **Targets:** primary 52, secondary 44, option tiles 64, shortcut row ≥ 40, inputs/tabs/back 36, row actions 32, inline 28 (≥ 24 px minimum per WCAG 2.2 target size).

### 2.6 Elevation and motion

- Tooltip and toast: `--zed-surface-overlay`, 1 px `--zed-border-strong`, `--zed-shadow-pop`.
- Dialog: `--zed-surface-overlay`, 1 px `--zed-border-strong`, `--zed-shadow-dialog`, over `--zed-scrim`.
- Transitions: tooltip opacity/transform and switch knob position, `var(--zed-dur) var(--zed-ease)`. Nothing else animates.

### 2.7 Iconography

All icons: `viewBox="0 0 24 24"`, `fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round`. Decorative icons get `aria-hidden="true"`; icon-only buttons get an `aria-label`. Sizes: tab-bar gear 20, tile glyph 20 (inside a 32 px well), row actions 18, stepper 22, regenerate 20, capture options 26, back chevron 18, banner 20, checkmark 16 with `stroke-width:3`.

| Icon | Elements (24-unit coordinates) |
|---|---|
| Sliders (settings, extension options) | `M4 7h9M17 7h3M4 17h3M11 17h9` · circle (15,7) r2 · circle (9,17) r2 |
| Back chevron | `m15 6-6 6 6 6` |
| Playback speed | `M4 17a8 8 0 1 1 16 0` · `m12 13 3.5-4` |
| Video quality | rect (3,5) 18×14 rx2 · `M10 9.5v5l4.5-2.5z` |
| Password | rect (5,11) 14×9 rx2 · `M8 11V8a4 4 0 0 1 8 0v3` |
| Volume | `M4 10v4h4l5 4V6l-5 4z` · `M16.5 9a4.5 4.5 0 0 1 0 6` |
| Scrollbars | rect (8,3) 8×18 rx4 · rect (10.5,7) 3×6 rx1.5 |
| Modes | rect (3,8) 18×8 rx4 · circle (16,12) r2 |
| Capture (tile) | `M4 8h3l1.5-2h7L17 8h3v11H4z` · circle (12,13) r3.5 |
| Save & close tab | `M7 4h10v16l-5-3.5L7 20z` · `m10 8.5 4 4M14 8.5l-4 4` |
| Video downloader | Download videos from any site yt-dlp supports | `{n}%` while a download runs, `Done` after one finishes (until the screen is opened) |
| Minus / Plus | `M5 12h14` / `M12 5v14M5 12h14` |
| Regenerate / Reload | `M20 11a8 8 0 1 0-2.3 5.7` · `M20 5v6h-6` |
| Check | `m5 12 5 5 9-10` (stroke 3) |
| Open in new tab | `M14 4h6v6` · `M20 4 10 14` · `M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4` |
| Copy | rect (9,9) 11×11 rx2 · `M5 15V6a2 2 0 0 1 2-2h8` |
| Delete / Remove | `M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3` |
| Edit | `M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z` · `m13.5 6.5 4 4` |
| Capture: Selected area | rect (4,4) 16×16 rx2, `stroke-dasharray: 3 3` |
| Capture: Visible area | rect (3,5) 18×14 rx2 · `M3 9h18` |
| Capture: Full page | rect (6,3) 12×18 rx2 · `M9.5 8h5M9.5 12h5M9.5 16h3` |
| Capture: Element | `M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3` · rect (9,9) 6×6 rx1 |
| Info (banner) | circle (12,12) r9 · `M12 11v5M12 8h.01` |
| Folder (move to collection, show in folder) | `M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z` |
| Text lines (selected-text item) | `M5 7h14M5 12h14M5 17h9` |
| Chevron right (disclosure) | `m9 6 6 6-6 6` (rotate 90° when expanded) |
| Download | `M12 4v10M8 10l4 4 4-4M5 19h14` |
| Clipboard (Paste) | rect (5,5) 14×16 rx2 · rect (9,3) 6×4 rx1 |
| Play (thumbnail) | `M8 5v14l11-7z` |
| File (open file) | `M7 3h7l5 5v13H7z` · `M14 3v5h5` |
| Close | `M6 6l12 12M18 6 6 18` |

### 2.8 Components

Reference CSS for primitives follows the table. Class names are suggestions; match the repo's conventions.

| Component | Spec |
|---|---|
| **Tab** | h36, padding `0 18px 0 12px` (room for the hint chip), radius 9, 14/600. Inactive: muted text, transparent. Active: accent text on accent-tint. Hover (suggested): background `--zed-surface`. `aria-current="page"` on the active one. |
| **Gear button** | Same box as a tab (padding `0 18px 0 12px`), sliders icon 20, hint chip "7". Same active/inactive treatment as a tab. While Settings is open, the gear is active and **no tab** is active. |
| **Back button** | h36, padding `0 12px 0 8px`, radius 9, bg `--zed-surface`, 1 px `--zed-border`, 14/500, chevron 18, gap 4. |
| **Tile** (Misc) | 4-column grid, gap 8, rows `1fr`. Padding 10, gap 6, bg `--zed-surface`, 1 px `--zed-border-subtle`, radius 14. Top row: 32 px icon well (bg `--zed-surface-raised`, radius 9, accent glyph 20) + right-aligned badge (13/600 accent). Title below, 13/600, line-height 1.25. Hover: bg `--zed-surface-hover`, border `--zed-border-strong`. **Tooltip** (description) shows on hover and `:focus-visible`: absolute, `top: calc(100% + 6px)`, left/right 0, padding `8px 10px`, radius 10, overlay surface, 12/400/1.4 `--zed-text-soft`, fades and slides 4 px. Disabled: `opacity .45`, no hover, no tooltip. |
| **Primary button** | h52 (44 in dialogs, 36 inline), radius 12 (10 when ≤ 44), bg `--zed-accent`, text `--zed-on-accent`, 15/600 centered. |
| **Secondary button** | Same geometry; bg `--zed-surface-raised`, 1 px `--zed-border`, text `--zed-text`. |
| **Option pill** (segmented single-select) | Selected: bg/border `--zed-accent`, text `--zed-on-accent`. Unselected: secondary-button look. Use `role="radio"` inside a `role="radiogroup"`, or `aria-pressed` buttons. |
| **Destructive button** | bg/border `--zed-warn`, text `--zed-on-warn`. The *trigger* for a destructive flow is a secondary button with a `--zed-warn` border (R4). |
| **Icon button** | 32 × 32 (row actions, icon 18, color `--zed-icon`) or 52 × 52 (stepper/regenerate, raised bg, 1 px border, radius 12). Disabled: `opacity .4`. |
| **Switch row** | `role="switch"` button, `aria-checked`. min-h52, padding `8px 12px`, bg `--zed-surface`, 1 px `--zed-border-subtle`, radius 12. Label 15/500; optional description 12/400 muted, 2 px below. Track 48 × 28, radius pill: on = accent, off = `--zed-switch-off` with 1 px inset ring `--zed-border-control` (R1). Knob 20 px, top 4: left 24 (on, `--zed-on-accent`) / left 4 (off, `--zed-knob-off`). |
| **Checkbox tile** | `role="checkbox"`. h64, padding `0 12px`, gap 10, bg `--zed-surface`, 1 px border (checked: `--zed-accent-line`; unchecked: `--zed-border-subtle`), radius 12. Box 24 × 24, radius 7: checked = accent fill + check icon 16 in `--zed-on-accent`; unchecked = transparent with 1 px `--zed-border-control`. Title 14/600, hint 12/400 muted. |
| **Slider** | Native `<input type="range">`, full width, `accent-color: var(--zed-accent)`, always with an `aria-label`. |
| **Text input** | h36, padding `0 12px`, bg `--zed-bg-inset`, 1 px `--zed-border-control`, radius 10, 14/400, text `--zed-text`, placeholder muted. Focus: border `--zed-accent` + the global ring. |
| **Card** | bg `--zed-surface`, 1 px `--zed-border-subtle`, radius 14, padding 12–16. *Active* card: border `--zed-accent-line`. |
| **Status pill** | h20, padding `0 8px`, radius pill, 11/600. *Active*: accent text on accent-tint, text "Active". *Off*: muted text on `--zed-surface-raised`, text "Off". Always carries text. |
| **Key chip** | min-w24, h24, padding `0 6px`, radius 6, bg `--zed-surface-raised`, 1 px `--zed-border`, 12/600 centered. |
| **Inline dashed button** | h28, padding `0 10px`, radius 8, 1 px dashed, 13/600. *Add*: `--zed-border-dashed` border, `--zed-icon` text, label "+ Add". *Recording*: accent border and accent text, label "Press a shortcut…". |
| **Letter avatar** | Square, radius 9, 700 weight, text `--zed-on-accent`, fill from the avatar palette. 36 px / 15 px type (extensions), 32 px / 14 px type (links). |
| **List row** | flex, gap 2, padding `8px 10px 8px 12px`, bg `--zed-surface`, 1 px `--zed-border-subtle`, radius 12. Name 14–15/600, single-line ellipsis; secondary line 12/400 muted. |
| **Helper row** | Left: 13/400 muted sentence. Right: 12/600 muted count. |
| **Group header** | 12/600 uppercase +.04em muted, margin-top 8. |
| **Empty state** | Centered, padding `24px 12px`, 13/1.5 muted. |
| **Toast** | `role="status"`, absolute, bottom 16, horizontally centered, z-index 30, padding `8px 14px`, radius 10, overlay surface + border + shadow, 13/500, `white-space: nowrap`. Auto-dismiss **1800 ms**; a new toast replaces the current one and restarts the timer. |
| **Notice banner** | flex, gap 12, align-start, padding 12, radius 12, bg `--zed-warn-tint`, 1 px `--zed-warn-line`. Info icon 20 in `--zed-warn`. Title 14/600; body 13/400/1.5 `--zed-text-soft`. |
| **Dialog** | Scrim covers the whole shell (`--zed-scrim`) and centers the dialog. Dialog: width 400, padding 20, gap 12, radius 16, overlay surface, 1 px `--zed-border-strong`, `--zed-shadow-dialog`. Title 18/600; body 14/400/1.5 `--zed-text-soft`; actions row gap 8, margin-top 4, two 44 px buttons `flex:1`. `role="dialog"` (or `alertdialog`), `aria-modal="true"`, `aria-labelledby`. |
| **Tab hint chip** | Absolute, `top:2px; right:2px`, min-w16, h16, padding `0 3px`, radius 5, 11/600, centered. Inactive: `--zed-text-muted` on `--zed-surface-raised`. On the active tab: `--zed-accent` on `--zed-bg-inset`. Shows the keyboard key for that tab (`aria-hidden`; expose the shortcut via `aria-keyshortcuts` on the tab). |
| **Filter chip** | h36, padding `0 12px`, radius 10, bg `--zed-surface-raised`, 1 px `--zed-border`, 14/600, optional count (`<small>` 12/600 muted). `aria-pressed`. Selected: accent fill, `--zed-on-accent` text and count. *Add* variant: transparent, 1 px dashed `--zed-border-dashed`, `--zed-icon`, "+ New". |
| **Menu (popover)** | `role="menu"`, width 232, padding 6, bg overlay, 1 px `--zed-border-strong`, radius 12, `--zed-shadow-pop`, z-index 20. Header 12/600 uppercase muted. Items h36, radius 8, 14/500, `role="menuitemradio"`; current item accent text on accent-tint with a check (16). Last item "New collection…" separated by a 1 px top border, h40, `--zed-icon`. |
| **Saved item row** | See §4.17. |
| **Disclosure row** | Full-width button, min-h52, padding `8px 12px`, bg `--zed-surface`, 1 px subtle border, radius 12. Left: chevron-right 18 muted + label 15/500. Right: hint 12 muted. `aria-expanded`. |
| **Extension card** | `.zed-card`, padding `10px 12px`, gap 12, items centered: avatar 36, name block, then action buttons. |
| **Status pill with dot** | h24, padding `0 10px`, radius pill, 12/600, accent text on accent-tint, 6 px accent dot. Used for the helper "Ready" state. |
| **Format row** | `role="radio"` button, min-h56, padding `8px 12px`, gap 12, bg `--zed-surface`, 1 px subtle border, radius 12. Left: radio 20 (2 px `--zed-border-control` ring; checked = accent ring + 10 px accent dot). Middle: resolution 15/600 + optional tag pill (h20, 11/600, muted on raised), then meta 12 muted. Right: size 14/600. Checked: border `--zed-accent-line`. |
| **Progress bar** | Track h8, radius 4, `--zed-surface-raised`; fill accent. Indeterminate variant: a 35 % fill sliding left → right, 1.1 s ease-in-out infinite; under `prefers-reduced-motion` it becomes a static 50 % opacity bar. |
| **Media card** | `.zed-card`, padding 10, gap 12. Thumbnail 120 × 68, radius 10 (real thumbnail when available; placeholder gradient + play icon otherwise) with duration badge (bottom-right, 11/600 on `#0A0D12CC`). Text: title 14/600 (2-line clamp), source 12 muted, "Change link" inline button. |

**Reference CSS (primitives)**

```css
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--zed-bg); color: var(--zed-text); font-family: var(--zed-font); }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; text-align: left; cursor: pointer; }
button:disabled { cursor: default; }
svg { flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

:focus-visible { outline: 2px solid var(--zed-accent); outline-offset: 2px; }
.zed-scroll :focus-visible { outline-offset: -2px; } /* inside scroll containers so it isn't clipped */

.zed-btn { height: var(--zed-h-primary); border-radius: var(--zed-radius-lg); background: var(--zed-surface-raised);
  border: 1px solid var(--zed-border); font-size: var(--zed-fs-md); font-weight: 600; text-align: center; }
.zed-btn--primary { background: var(--zed-accent); border-color: var(--zed-accent); color: var(--zed-on-accent); }
.zed-btn--danger  { background: var(--zed-warn); border-color: var(--zed-warn); color: var(--zed-on-warn); }
.zed-btn--warn-outline { border-color: var(--zed-warn); }
.zed-btn--compact { height: var(--zed-h-compact); border-radius: var(--zed-radius-md); font-size: var(--zed-fs-base); }

.zed-card { background: var(--zed-surface); border: 1px solid var(--zed-border-subtle); border-radius: var(--zed-radius-card); }
.zed-card--active { border-color: var(--zed-accent-line); }

.zed-pill { height: 20px; padding: 0 8px; border-radius: var(--zed-radius-pill); display: inline-flex; align-items: center;
  font-size: var(--zed-fs-2xs); font-weight: 600; background: var(--zed-surface-raised); color: var(--zed-text-muted); }
.zed-pill--active { background: var(--zed-accent-tint); color: var(--zed-accent); }

.zed-switch { position: relative; flex: none; width: 48px; height: 28px; border-radius: var(--zed-radius-pill);
  background: var(--zed-switch-off); box-shadow: inset 0 0 0 1px var(--zed-border-control); }
.zed-switch::after { content: ""; position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--zed-knob-off); transition: left var(--zed-dur) var(--zed-ease); }
[aria-checked="true"] > .zed-switch { background: var(--zed-accent); box-shadow: none; }
[aria-checked="true"] > .zed-switch::after { left: 24px; background: var(--zed-on-accent); }

.zed-input { height: var(--zed-h-control); padding: 0 12px; background: var(--zed-bg-inset); color: var(--zed-text);
  border: 1px solid var(--zed-border-control); border-radius: var(--zed-radius-md); font: inherit; font-size: var(--zed-fs-base); }
.zed-input::placeholder { color: var(--zed-text-muted); }
.zed-input:focus { border-color: var(--zed-accent); }
```

### 2.9 Accessibility rules (apply everywhere)

- Real `<button>`, `<a href>`, `<input>` with `<label>` or `aria-label`. Never a click handler on a `div`/`span`.
- Toggles are `role="switch"` + `aria-checked`; flag tiles are `role="checkbox"`; icon-only buttons have `aria-label` that names the target (e.g. "Remove shortcut for Faster").
- Visible focus on every interactive element via `:focus-visible` (accent 2 px ring).
- Logical tab order = visual order. Tabs are reachable with `Tab`; do not add global key handlers in the popup (the shortcut recorder listens only while its own button is focused).
- Toast uses `role="status"` (polite). Dialog traps focus, focuses **Cancel** first, closes on `Esc`, restores focus to its trigger.
- Tooltips are supplementary only; every tile also has its title visible.
- Respect `prefers-reduced-motion`.
- Disabled controls use the native `disabled` attribute.

---

## 3. Information architecture and navigation

```
Tab bar:  [Misc] [Extensions] [YouTube] [Links] [Saved] [Shortcuts]            [⚙ Settings]
 hint:      1         A          3         4       5         6                     7

Misc ─ tile grid (9 tiles, 4 columns × 3 rows)
        ├─ Playback speed      (drill-in, sub-bar)
        ├─ Video quality       (drill-in)
        ├─ Password generator  (drill-in)
        ├─ Volume boost        (drill-in)
        ├─ Scrollbars          (drill-in)
        ├─ Modes               (drill-in)
        ├─ Capture screenshot  (drill-in)
        ├─ Save & close tab    (action, no screen)
        └─ Video downloader    (drill-in, needs the native helper)   ← new
Extensions   flat list, no sub-bar
YouTube      flat list, no sub-bar
Links        flat list, no sub-bar
Saved        flat list with collection filter, no sub-bar               ← new
Shortcuts    flat list, no sub-bar
Settings     drill-in (sub-bar), opened by the gear
```

Rules:
- Selecting a tab shows that tab's root and clears any drill-in.
- Drill-in screens show the sub-bar. **Back** returns to the *current tab's* root.
- The gear toggles Settings. Closing Settings (gear again or Back) returns to the tab that was active before.
- When Settings is open, tabs render inactive and the gear renders active.
- Each tab shows a small **hint chip** with its keyboard key (1, A, 3, 4, 5, 6, 7, exactly as in the current extension); the keys are unchanged, only restyled.
- The popup remembers nothing about navigation between openings: it always opens on **Misc**, except that an active or just-finished download reopens on the Video downloader (§4.18).
- The tab bar and sub-bar never scroll; only the content area scrolls.

---

## 4. Screens

Each screen states layout, content (exact copy in quotes), and states.

### 4.1 Misc: tile grid
- Margin-top 12, 4 columns, **9 tiles in 3 rows** (the last row holds one tile).
- Tiles, in order — title · tooltip description · badge:

| Tile | Tooltip | Badge |
|---|---|---|
| Playback speed | Speed up or slow down video | `{n}×` current speed |
| Video quality | Set a preferred resolution | Current preference, e.g. `360p` |
| Password generator | Random, customizable passwords | `{n} chars` |
| Volume boost | Amplify audio up to 2000% | `{n}%` |
| Scrollbars | Restyle or hide scrollbars | *(none)* |
| Modes | Inspect, design and RTL | `{n} on` only when ≥ 1 mode is on |
| Capture screenshot | Selected area, visible area, full page or element | *(none)* |
| Save & close tab | Save this tab’s URL to Links, then close the tab | *(none)* |

- "Save & close tab" does not open a screen: it saves the active tab to Links (deduplicated by URL), closes the tab, and shows a toast: **"Saved to Links · tab closed"** or, if already saved, **"Already in Links · tab closed"**.
- Page-dependent tiles are **disabled** on restricted pages (see 4.16).

### 4.2 Playback speed (sub-bar "Playback speed")
- Card (padding 16, gap 14, centered): stepper row (gap 20) = **−** icon button 52 × 52 · readout `{n}×` (48/600) · **+** icon button 52 × 52. Aria-labels: "Slower", "Faster". Below it a full-width slider, `aria-label="Playback speed"`.
- Range **0.25 – 4**, step **0.25**. Stepper clamps at both ends.
- Below the card, 2-column preset pills (h52): **"1× Normal"** and **"2×"**; the one equal to the current speed is selected.
- Changes apply immediately; the Misc badge updates.

### 4.3 Video quality (sub-bar "Video quality")
- 3 × 2 grid of option pills (h64, 16/600): `144p 240p 360p 480p 720p 1080p`. Single-select.
- Label "If unavailable" (13/500 muted, margin-top 4), then 2-column pills (h52): **"Prefer higher"**, **"Prefer lower"**. Single-select.
- Primary button **"Apply"** (h52, margin-top 4).
- Selection is staged; **Apply** commits it and updates the Misc badge. Toast: "Quality preference applied". (If the existing extension applies on selection, keep that and still show Apply as the explicit confirm.)

### 4.4 Password generator (sub-bar "Password generator")
- Row (gap 8): readout (flex 1, h52, mono 16, bg inset, 1 px border-control, radius 12, single line, `overflow:hidden`) · regenerate icon button 52 × 52 (`aria-label="Generate new password"`) · **"Copy"** primary button (h52, padding `0 20px`).
- Card (padding 12): "Length **{n}**" (14/500, number 600) with "4–128" (12 muted) right-aligned, then slider 4–128, `aria-label="Password length"`.
- 2 × 2 checkbox tiles (h64): **Uppercase** `A–Z`, **Lowercase** `a–z`, **Numbers** `0–9`, **Symbols** `!@#`.
- A new password is generated on open, on **any** control change, and on regenerate. Copy puts it on the clipboard and shows the toast **"Password copied"**.

### 4.5 Volume boost (sub-bar "Volume boost")
- Card (padding 16, gap 10): row with "Amplification" (15/500) and the value `{n}%` (40/600 accent) right-aligned (baseline aligned); slider **100 – 2000**, step **50**, `aria-label="Amplification"`; helper 13/1.5 muted: "Boosts audio and video up to 2000%. High levels may cause distortion or damage speakers."
- Secondary button **"Reset to 100%"** (h52).

### 4.6 Scrollbars (sub-bar "Scrollbars") — *new/extended*
Three cards, gap 8, each: left = title (15/600) + status pill + description (13 muted, lh 1.4); right = one 44 px secondary button (min-width 92, padding `0 16px`, radius 10).

| Card | Description | Action when Off | Action when Active |
|---|---|---|---|
| Custom style | Sleek, unobtrusive modern scrollbars without layout shifting. | **Apply** | **Restore** |
| Main scrollbar | Only the document / viewport scrollbar. | **Hide** | **Restore** |
| All scrollbars | Every scrollable region, including nested areas. | **Hide** | **Restore** |

- *Active* card uses the active-card border and the "Active" pill; *Off* uses the "Off" pill.
- Footer note (12/1.5 muted, margin-top 4): **"Changes apply to the current tab."**
- This replaces the original's paired "Apply/Hide" + "Reset" buttons. The shortcut actions "Reset scrollbars" still restores all three.

### 4.7 Modes (sub-bar "Modes")
- Switch rows (gap 6): **Inspect mode**, **Design mode**, **Arabic RTL mode**. They affect the active page.
- The Misc tile badge shows how many are on.

### 4.8 Capture screenshot (sub-bar "Capture screenshot")
- 2 × 2 grid filling the content area (`grid-auto-rows: minmax(0,1fr)`, gap 8). Each cell is a card-button (radius 14), centered column, gap 10: 52 px icon well (radius 14, raised bg, accent glyph 26) + label 16/600.
- Cells: **Selected area**, **Visible area**, **Full page**, **Element**.
- **No in-popup result screen** (explored and removed). Triggering an option starts the existing capture flow; the popup may close for on-page selection. After a capture, keep the extension's existing output behavior (save/copy) and confirm with a toast (in the popup if it is still open, otherwise a page-level toast built from the same toast spec).

### 4.9 Extensions (tab "Extensions")
- Margin-top 12. Helper row: "Click an extension to turn it on or off." / count `{n} on · {m} off`.
- Scrollable list, gap 6. Row: letter avatar 36 · text block (name 15/600; version 12 muted, margin-top 1) · icon buttons **Options** (sliders), **Reload**, **Remove** (all 32 px, `aria-label`s "Options", "Reload", "Remove") · switch (margin-left 6).
- Clicking the avatar/name area **or** the switch toggles the extension. Off rows: name turns muted and icons use `--zed-icon-off`.
- Sorted by name, case-insensitive. The extension itself shows version text **"v{version} · This extension"** and its **Remove** button is `disabled`.
- Use the real extension icon when available (`chrome.management`), with the letter avatar as fallback.

### 4.10 YouTube (tab "YouTube")
- Margin-top 12. Heading **"YouTube"** (18/600), then switch rows (gap 6): **Focus mode**, **Hide progress bar**, **Hide time & duration**, **Hide controls**, **Half-screen layout**.

### 4.11 Links (tab "Links")
- Margin-top 12, column gap 8, fills height.
- Row: text input (`aria-label="Link URL"`, placeholder "Paste a URL to save") + primary **"Add"** (h36, padding `0 16px`, radius 10). `Enter` in the input adds.
- Helper row: "Click a link to open it." / `{n} saved`.
- Scrollable list (gap 6). Row: link area (letter avatar 32 + title 14/600 ellipsis + URL 12 muted ellipsis; an `<a target="_blank" rel="noopener noreferrer">`) · **Open in a new tab** (anchor, `aria-label="Open {title} in a new tab"`) · **Copy link** · **Remove link** (all 32 px).
- Empty state: **"No saved links yet. Add one above, or use “Save & close tab” in Misc."**
- Toasts: "Link added", "Already saved", "Link copied".

### 4.12 Shortcuts (tab "Shortcuts")
- Margin-top 12. Helper row: "Set, change or clear a shortcut for any action." / `{n} of {total} set`.
- Scrollable grouped list (gap 4). Group header (§2.8) precedes each group. Row: min-h40, padding `4px 6px 4px 12px`, bg `--zed-surface`, 1 px border, radius 10; action name 14/500 ellipsis; then:
  - **Set:** key chips (one per part) + **Edit** icon (`aria-label="Edit shortcut for {name}"`) + **Remove** icon (`aria-label="Remove shortcut for {name}"`).
  - **Unset:** dashed **"+ Add"** (`aria-label="Add shortcut for {name}"`).
  - **Recording:** the row border becomes accent; a dashed accent button with label "Press a shortcut…" receives focus.
- Full action catalog and defaults: §6.

### 4.13 Settings (sub-bar "Settings"; gear active) — *revised*
- **Extension card** (margin-top 12): avatar 36 (accent fill, letter **Z**), name **"Extension Zed"** (15/600) with `v{version}` (12 muted) below it, then three 44 px secondary buttons with `padding: 0 14px`: **Refresh** (reload icon), **Settings** (sliders icon), and an icon-only **About** (info icon, 44 × 44, `aria-label="About"`). These three buttons already exist in the current extension: **keep exactly what each does today**; this design only changes how they look.
- Heading **"Appearance"** (18/600, margin-top 8), switch rows: **Dark theme**; **Black and white** with description "Show all websites in grayscale."
- Heading **"Backup and reset"** (margin-top 8): a 3-column grid (gap 8) of 52 px buttons: **Export**, **Import**, and **Reset to defaults** (secondary with a `--zed-warn` border, R4).
- **Tool order**: a disclosure row (margin-top 8): chevron-right + "Tool order" on the left, hint **"Reorder the Misc tools"** on the right; `aria-expanded`. Collapsed by default. Expanding reveals the *existing* tool-order control; restyle it with the list-row pattern and keep its behavior.
- Heading **"About Extension Zed"** (margin-top 8) + the product paragraph from §1 (13/1.6 muted).
- Sections are separated by the 8 px stack gap plus 8 px above each heading; the content area scrolls if it overflows.
- Export downloads the settings file; Import reads one (validate before applying; toast "Settings imported" or "Couldn’t import that file").

### 4.14 Settings: reset confirmation — *new*
- Opens when **Reset to defaults** is activated. Scrim over the entire shell, dialog centered.
- Title **"Reset settings to defaults?"**; body **"Every option and keyboard shortcut goes back to its default. This can’t be undone."**
- Buttons (44 px, `flex:1`): **"Cancel"** (secondary; focused first) and **"Reset settings"** (destructive).
- `Esc` and **Cancel** close with no change. Confirm resets, closes the dialog, shows toast **"Settings reset"**.
- Saved Links and the active tab/page effects are not described by this design; preserve the existing reset semantics (§8).

### 4.15 Toast
Single global toast (§2.8). Strings used: "Saved to Links · tab closed", "Already in Links · tab closed", "Link added", "Already saved", "Link copied", "Password copied", "Quality preference applied", "Settings reset", "Settings imported", "Couldn’t import that file".

### 4.16 Restricted page — *new*
Shown on the **Misc** tab when the active tab is a page extensions cannot script (non-`http(s)` schemes such as `chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, `devtools://`; the Chrome Web Store; other pages where injection fails).
- Notice banner at the top (margin-top 12): title **"Zed can’t run on this page"**; body **"Browser pages like this one block extensions. Open a regular website to use the page tools. Password generator, Video downloader and Save & close tab still work."**
- Tile grid below it (margin-top 4): **Password generator**, **Save & close tab** and **Video downloader** stay enabled (they do not need page access); Playback speed, Video quality, Volume boost, Scrollbars, Modes and Capture screenshot are `disabled`.
- Extensions, YouTube, Links, Shortcuts and Settings remain fully usable on these pages.
- Detect with the tab URL first, and fall back to catching injection errors; do not show the banner on normal pages.

### 4.17 Saved (tab "Saved") — *new*
Shows items saved from the page’s **Save to Zed** buttons (posts, reels, videos) and from right-click "save selected text", grouped into user-made collections. All data stays on the device; reuse the extension’s existing storage and data model.

Layout (content area, `padding-top: 12px`, stack gap 8):
1. **Header row:** "Saved" (18/600) and the count `{n} items` (12/600 muted) right-aligned.
2. **Intro** (13/1.5 muted): "Save posts, videos and reels with the page’s Save to Zed button. Right-click selected text to save it here. Stored on this device."
3. **Switch row** "Show Save to Zed buttons" / "Show save/remove controls on posts, reels and videos." (controls the buttons injected into pages).
4. **Collection filter chips**, `role="group" aria-label="Collections"`, sticky to the top of the scroll area on `--zed-bg`, overflow scrolls horizontally: **All saved {n}**, one chip per collection with its count, and a dashed **+ New**. Single-select, "All saved" selected by default.
5. **Item list** (gap 8), newest first.

**Saved item row:** padding `10px 6px 10px 12px`, gap 10, bg `--zed-surface`, 1 px subtle border, radius 12.
- *Leading:* URL items get a 36 px letter avatar (host initial, fill from the avatar palette chosen deterministically from the host, e.g. `host.length % 6`; the sample colors are illustrative). Selected-text items get a 36 px raised well with the text-lines icon.
- *Main, URL item:* title = host without `www.` (14/600, ellipsis); second line = path and query without the leading `/` (12 muted, ellipsis). Do not show the raw full URL as the title.
- *Main, text item:* the selected text, clamped to 2 lines (14/500, line-height 1.5) with **`dir="auto"`** so Arabic and other RTL text aligns and flows correctly; second line "Selected text" (12 muted).
- *Collection pill* (status-pill style, neutral) only when the item belongs to a collection.
- *Actions* (three 32 px icon buttons): **Open** (external icon; `aria-label` "Open saved link" for URL items, "Open source" for text items), **Move to collection** (folder icon, `aria-haspopup="menu"`, tinted while its menu is open), **Remove** (trash).

**Move menu** (replaces the per-item `<select>` of the old design): opens under the folder button, header "Move to collection", items **No collection** (items without a collection are shown under All saved only), each collection (current one checked), then **New collection…**. Arrow keys move, `Enter` selects, `Esc` closes and returns focus to the folder button. Choosing an item closes the menu and toasts **"Moved to {collection}"** or **"Removed from {collection}"**.

**Creating a collection** (from **+ New** or the menu’s **New collection…**): the chips row is replaced by an inline form: text input (placeholder "Collection name", label/`aria-label` "New collection name", **required**), a compact primary **Create** (disabled until the trimmed name is non-empty) and a **Cancel** icon button. `Enter` submits, `Esc` cancels. A name that already exists (case-insensitive) shows the inline message **"That collection already exists."** (12/600 `--zed-warn`). Toast **"Collection created"**. When started from an item’s menu, that item is moved into the new collection. Renaming and deleting collections are not designed; keep whatever the current extension does.

**Remove** deletes immediately and toasts **"Removed from Saved"** (there is no undo in this design).

**Empty states** (empty-state component): nothing saved → "Nothing saved yet. Use the Save to Zed button on a post, reel or video, or right-click selected text."; empty collection → "No items in {collection}."

### 4.18 Video downloader (Misc tile "Video downloader") — *new*
The user pastes a link; the extension asks yt-dlp which formats exist; the user picks one and presses **Download**. It works for any site yt-dlp supports.

**Required architecture: native messaging host ("the Zed helper").** A browser extension cannot run yt-dlp. Implement a small native messaging host (in the repo’s existing language if there is one, otherwise Node or Python) that the extension talks to with `chrome.runtime.connectNative` / `sendNativeMessage`, and that runs the user’s installed **yt-dlp** (and **ffmpeg** for merging and MP3 conversion).
- **Manifest:** add the `nativeMessaging` permission (the only permission change this redesign needs). The host manifest restricts `allowed_origins` to this extension’s ID. Provide per-OS install scripts (Windows registry key; macOS and Linux manifest locations) and a bundled local setup page that the **Setup guide** button opens (`chrome.runtime.getURL`, no network).
- **Suggested message contract** (JSON, length-prefixed as native messaging requires): `ping` → `{ ok, ytdlp: { version }, ffmpeg: boolean }`; `formats { url }` → `{ title, uploader, duration, thumbnail, host, video: [...], audio: [...] }` or `{ error }`; `download { url, formatId, mode }` → a stream of `progress { pct, downloaded, total, speed, eta, stage }` then `done { path, size }` or `error`; `cancel`; `reveal { path }`; `open { path }`; `update` → `{ version }`.
- **Safety:** accept only `http` and `https` URLs; start yt-dlp with an argument array, never through a shell; pass `--no-playlist` by default (a playlist link downloads only its video); sanitize output file names; write to `Downloads/Zed` (create it if missing); the helper listens on stdio only and sends nothing anywhere except via yt-dlp to the requested site. Prefer detecting a user-installed yt-dlp/ffmpeg over bundling binaries.
- **Background:** download state lives in the helper/service worker, never in the popup. When the popup opens it asks for the current job and restores **Downloading** or **Done**. One active job at a time; opening the tile during a job shows its progress.

**States** (all use the sub-bar titled "Video downloader"; the Misc tile badge shows `{pct}%` while downloading and `Done` after completion until the screen is opened):

| State | What is shown |
|---|---|
| **Setup (helper not found)** | Notice banner (margin-top 12), title **"Downloader helper not found"**, body **"Video downloads need yt-dlp and the Zed helper installed on this computer. Nothing is sent to any server."** Below: 2-column buttons **Setup guide** (secondary) and **Check again** (primary). *Check again* re-pings the helper; on success toast **"Helper connected"** and go to Ready. If ffmpeg is needed but missing, use the same banner with an accurate message (suggested: "Merging video and audio needs ffmpeg."). |
| **Ready (idle)** | Status row (margin-top 12): **status pill** "Ready" with dot, `yt-dlp {version}` (13 muted, flex 1), inline **Update** button. Label "Video link" (13/500 muted). Row: text input (h44, `aria-label="Video link"`, placeholder **"Paste a link from YouTube, X, Instagram, TikTok…"**) + compact **Paste** button with clipboard icon. Primary **Get formats** (h52). Footnote (13/1.5 muted): **"Works with YouTube and the 1,000+ other sites yt-dlp supports. Download only content you own or have permission to save."** |
| **Validation** | Under the input, 12/600 `--zed-warn`: **"Paste a link first."** (empty) or **"That doesn’t look like a link."** (no host-like text). `Enter` in the input = *Get formats*. |
| **Busy (reading link)** | Same layout; *Get formats* is replaced by a card with "**Reading link…**" and "Asking yt-dlp for available formats", an indeterminate progress bar, and a **Cancel** button (back to Ready). |
| **Error** | Notice banner, title **"Couldn’t read this link"**, body **"yt-dlp reported “{message}”. Check the link, or update yt-dlp and try again."** (`{message}` = yt-dlp’s last error line, trimmed to about 120 characters). The input stays editable and *Get formats* stays available. |
| **Results (Video)** | Content area is a column with margin-top 12 and gap 8: **media card**; a two-chip segmented control **Video** / **Audio only** (`aria-pressed`); a scrolling **format list** (`role="radiogroup"`); a pinned **footer** (top border) with the summary (`1080p · MP4 · 214 MB`, 14/600) and the note **"Video + best audio, merged into one file"** (12 muted) on the left and a primary **Download** button (min-w170, download icon) on the right. |
| **Results (Audio only)** | Same, with audio rows; footer note **"Audio only, no video"**. |
| **Downloading** | Card (padding 16, gap 14): well + title + summary; progress bar; stats row `{pct}% · {done} of {total}` left (percent in 600 weight) and `{speed} · {eta} left` right; stage line **"Downloading…"** / **"Merging video and audio…"** / **"Converting to MP3…"**. Below: secondary **Cancel download** (h52) and the note **"You can close this popup. The download continues in the background."** *Cancel download* stops the job, deletes partial files, returns to Results, toast **"Download cancelled"**. |
| **Done** | Centered card: 52 px accent check well, **"Download complete"** (18/600), file name (14/600, ellipsis), `{summary} · Downloads/Zed` (12 muted). Primary **Show in folder** (folder icon, h52); 2-column secondary **Open file** and **New download** (back to Ready with an empty link). |

**Format rules** (derive from yt-dlp’s JSON, not hard-coded):
- *Video rows:* one per resolution, highest first. Per resolution prefer an MP4/H.264 stream, else the best available. Row = `{height}p`, meta `{container} · {codec} · {fps} fps`, size from `filesize` or `filesize_approx` (prefix `~` when approximate). Selecting a row downloads that video merged with the best audio (needs ffmpeg; without ffmpeg list only single-file formats and say so in the footer note).
- *Audio rows:* best M4A/AAC (`M4A · AAC · {kbps} kbps`), Opus (`WebM · {kbps} kbps`), and **MP3 · Converted · {kbps} kbps** (needs ffmpeg; hide it if ffmpeg is missing).
- *Tags:* **Best quality** on the highest-resolution video; **Most compatible** on the best MP4/H.264 up to 1080p; **Recommended** on the best audio row. Default selection: *Most compatible*, else *Best quality*; audio default *Recommended*. Switching Video / Audio only resets the selection to that mode’s default.
- The media card shows the real title, uploader and host, duration, and thumbnail (placeholder when unavailable). **Change link** returns to Ready with the link kept.

**Input rules:** *Paste* reads the clipboard on user click; if the clipboard is unavailable, just focus the input. *Update* runs the helper’s `update`, toast **"yt-dlp is up to date"** or **"yt-dlp updated to {version}"**. The footnote is always visible on the Ready, Busy and Error states.

---

## 5. Behavior rules (carry these over)

**Links**
- Normalize input: trim, strip a leading `http://` or `https://`, strip one trailing `/`. Empty after normalizing → do nothing.
- Duplicate (same normalized URL) → clear the input, toast "Already saved".
- Title = host with a leading `www.` removed. `href` = the original text if it starts with `http(s)://`, else `https://` + normalized URL. New links go to the **top** of the list.
- Avatar letter = first letter of the title uppercased; color = avatar palette `[title.length % 6]`.
- "Save & close tab" uses the tab’s URL (normalized the same way) and, when available, its page title.

**Shortcut recorder**
- Only active while the recorder button is focused; prevent default and stop propagation for every key while recording.
- `Esc` or losing focus cancels. Pressing only modifiers (`Ctrl`, `Alt`, `Shift`, `Meta`) does nothing yet.
- A combo **must include at least one of Ctrl, Alt, Shift** (Cmd/Meta alone is not enough). Otherwise show the error label **"Add Ctrl, Alt or Shift"**.
- Part order: modifiers in the order Ctrl, Alt, Shift, Cmd, then the key. Key names: arrows as `↑ ↓ ← →`, space as `Space`, letters from `event.code` (`KeyA` → `A`), digits from `Digit1` → `1`, otherwise the uppercased single character or the key name.
- Conflict with another action’s shortcut → error label **"Used by {other action name}"**; do not save.
- Success saves the combo, leaves recording, clears the error. The error label replaces "Press a shortcut…" and clears on the next attempt, `Esc` or blur.
- Count in the helper row = number of actions with a shortcut.

**Password generator**
- Pool = union of the checked classes: `A–Z`, `a–z`, `0–9`, symbols `!@#$%^&*()-_=+`. If nothing is checked, fall back to lowercase.
- Use `crypto.getRandomValues` (the mockup’s `Math.random` is a placeholder). Recommended: include at least one character from every checked class.
- Regenerate on every control change.

**Speed / Volume**
- Speed: 0.25–4 in 0.25 steps; volume: 100–2000 in steps of 50; "Reset" restores 100%.

**Toast**
- 1800 ms, one at a time, new replaces old.

**Persistence and privacy**
- All preferences, links and shortcuts in `chrome.storage.local` (or the existing store). No remote calls.

---

## 6. Shortcut action catalog (28 actions)

Group → action → default shortcut (blank = none). Display order is exactly this.

| Group | Action | Default |
|---|---|---|
| Playback speed | Faster | Alt+Shift+→ |
| Playback speed | Slower | Alt+Shift+← |
| Playback speed | Reset to 1× | |
| Video quality | Prefer higher quality | |
| Video quality | Prefer lower quality | |
| Volume boost | Boost up | Alt+Shift+↑ |
| Volume boost | Boost down | Alt+Shift+↓ |
| Volume boost | Reset to 100% | |
| Password generator | Generate and copy password | Alt+Shift+P |
| Scrollbars | Apply custom style | |
| Scrollbars | Hide main scrollbar | |
| Scrollbars | Hide all scrollbars | |
| Scrollbars | Reset scrollbars | |
| Modes | Toggle inspect mode | Alt+Shift+I |
| Modes | Toggle design mode | Alt+Shift+D |
| Modes | Toggle Arabic RTL mode | Alt+Shift+A |
| Capture screenshot | Selected area | Alt+Shift+S |
| Capture screenshot | Visible area | |
| Capture screenshot | Full page | |
| Capture screenshot | Element | |
| Tabs | Save URL and close tab | Alt+Shift+W |
| YouTube | Focus mode | Alt+Shift+F |
| YouTube | Hide progress bar | |
| YouTube | Hide time & duration | |
| YouTube | Hide controls | |
| YouTube | Half-screen layout | |
| Appearance | Toggle dark theme | |
| Appearance | Toggle black and white | |

Initial state: **11 of 28 set**.

**Chrome caveat.** `chrome.commands` allows at most 4 suggested shortcuts in the manifest and can only be rebound by the user at `chrome://extensions/shortcuts`. Keep whatever mechanism the extension already uses for global shortcuts. If the extension needs more bindings than the manifest allows, handle the rest with a content-script key listener driven by the stored combos. Do not change the architecture just to match the mockup; the design defines the UI only.

---

## 7. Sample data → real data

| Mockup | Replace with |
|---|---|
| Sample links (MDN, Inter, WCAG, Can I use) | Stored links; empty state when none |
| "Current tab" (Chrome extensions overview) | `chrome.tabs.query({active:true, currentWindow:true})` |
| 8 sample extensions | `chrome.management.getAll()`, excluding themes; self row marked "This extension" |
| Mock state (speed 2×, 360p, 20 chars, amp 100, both appearance switches on) | Real persisted values and the extension’s real defaults |
| Letter avatars | Real extension icons, letter avatar as fallback |
| Saved items, collections, counts (Facebook, LinkedIn, Arabic text) | Items and collections from the extension’s storage |
| Downloader title, uploader, formats, sizes, speeds, `yt-dlp 2026.10.28`, "Downloads/Zed" | The helper’s real responses and the real output folder |

---

## 8. Assumptions and open decisions

Decide conservatively, record each decision in the repo notes, and **keep existing behavior where it differs**:

1. **"Dark theme" and "Black and white"** are read as page-level display options (the latter is described as "Show all websites in grayscale."). The popup itself is dark regardless. Preserve whatever the current extension does for these.
2. **Reset semantics** (what "Reset settings to defaults" clears, including whether saved Links are kept) are not specified by the design; preserve current behavior.
3. **Video quality Apply** is specified as staged-then-commit (§4.3); if the existing logic applies instantly, keep that.
4. **Scrollbars** "Hide main" and "Hide all" are shown as independent cards; keep the existing precedence if one implies the other.
5. **Capture output** (clipboard vs. download, file naming) is unchanged.
6. **Restricted-page detection** may need `tabs` or `activeTab`; do not widen manifest permissions unless detection is impossible without it, and list any change.
7. **Export/Import file format** is unchanged.
8. **Tab hint keys** (1, A, 3, 4, 5, 6, 7) are copied from the current extension; "A" on Extensions looks unusual, so confirm with the owner but do not change it silently.
9. **Extension card buttons** (Refresh, Settings, About) and the **Tool order** control keep their current behavior. The hint "Reorder the Misc tools" is a guess at what Tool order does; use accurate copy if it differs.
10. **Saved:** use the existing data model; deleting or renaming collections and undo-on-remove are not designed.
11. **Downloader decisions to record:** playlist links (default `--no-playlist`), single active job, fixed output folder `Downloads/Zed`, how ffmpeg is detected and what happens without it, supported OSes (Windows, macOS, Linux), and whether yt-dlp is user-installed or helper-managed (minimum: show its version and offer Update).
12. **Distribution and policy.** Downloading from sites such as YouTube may conflict with Chrome Web Store policies and with sites’ terms of service. Verify before publishing to the Web Store; consider keeping this feature behind a build flag or shipping it outside the Store. Keep the "Download only content you own or have permission to save" note, and never add DRM circumvention.

---

## 9. Acceptance checklist

**Design system**
- [ ] `tokens.css` exists with every token in §2.2 and is imported by the popup and any injected UI.
- [ ] Old design rules (variables, themes, style docs, lint rules) are removed or replaced; no component uses a raw hex color, raw radius or ad-hoc font size outside the token file.
- [ ] Inter is bundled locally; there is no request to Google Fonts or any CDN.
- [ ] Every component in §2.8 exists once and is reused.

**Screens and states**
- [ ] All screens in §4 render at exactly 640 × 600 with no horizontal scroll; only the content area scrolls vertically.
- [ ] Misc grid (9 tiles), Playback speed, Video quality, Password generator, Volume boost, Scrollbars (status), Modes, Capture screenshot, Extensions, YouTube, Links, **Saved**, Shortcuts, **Settings (revised)**, Reset dialog, Restricted page and every **Video downloader** state (setup, ready, validation, busy, error, results video/audio, downloading, done) match the spec.
- [ ] The tab bar shows six tabs plus the gear, each with its hint chip, and fits within 640 px.
- [ ] Tooltips on tiles appear on hover and keyboard focus; the Restricted-page tile set is correctly disabled.
- [ ] Empty states (no links), error states (shortcut conflict / missing modifier), and the recording state are implemented.

**Behavior**
- [ ] Existing features, storage keys and message contracts still work (regression checked).
- [ ] Link normalization, dedupe, ordering and toasts match §5.
- [ ] Shortcut recorder rules match §5; counts update (`{n} of 28 set`).
- [ ] Toast auto-dismisses at 1800 ms and replaces the previous toast.
- [ ] Saved: filter, create collection (required name, duplicate check), move menu, remove, RTL text rendering (`dir="auto"`) and empty states work.
- [ ] Video downloader: native host installs and pings; formats list comes from yt-dlp; download progress, cancel (partial files removed), background continuation and reopen-restores-progress work; Show in folder and Open file work; only http(s) URLs are accepted and yt-dlp is never run through a shell.

**Accessibility**
- [ ] All controls reachable and operable by keyboard; visible focus ring everywhere.
- [ ] Switches/checkboxes use correct roles; icon-only buttons have labels; dialog traps focus and restores it.
- [ ] Contrast meets §2.3; no state relies on color alone.
- [ ] No animation under `prefers-reduced-motion`.

**Hygiene**
- [ ] No new network access from the extension itself, no analytics, no remote assets. The only manifest change is `nativeMessaging`.
- [ ] Build, lint and tests pass; screenshots of every screen at 640 × 600 attached.
- [ ] A short migration note lists: removed design rules, decisions made from §8, and any manifest or dependency changes.
