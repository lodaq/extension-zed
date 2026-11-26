# Zed

Dark and light palettes live in `tokens.css`; the `dark` class selects dark mode. All extension UI uses `src/design-system/`. The implementation in `src/design-system/` defines the tokens and controls. Import `tokens.css` globally, `base.css` for controls, and the shared scrollbar stylesheet. Injected UI uses Shadow DOM and the same tokens via the emitted `theme.css` bundle.

Use shared Button, SwitchRow, Tile, Card, StatusPill, IconButton, LetterAvatar, Notice, Dialog and TimelineTrimmer components; use semantic primitive classes for rows, helper rows, key chips, group headers, empty states and inputs. Icons come from `src/design-system/Icon.tsx`. Inter is bundled in `public/fonts/Inter.woff2`.

No raw colors, radii or font sizes outside tokens.css. Use `--zed-*` tokens. Accent identifies selected/primary actions; warning identifies destructive/blocked states. Status always includes text or shape. Keep all controls keyboard accessible with visible focus, native disabled semantics and accessible names. Dialogs focus Cancel first, trap focus, close on Escape and restore focus. The popup has a minimum width of 200px and is at most 640 × 600 and narrows to fit smaller browser windows without scaling text or controls; tiles reflow and navigation scrolls horizontally when needed. Only content scrolls vertically. No remote assets.

Feature descriptions appear inside the opened feature view; tiles do not show hover or focus tooltips.

Motion is limited: only switch knob position transitions over `--zed-dur`. Reduced motion sets that duration to zero. No other motion is used.

Standard action buttons use the shared Button component: `--zed-h-compact` height, `--zed-space-6` horizontal padding, `--zed-space-3` icon/action gaps, and no outer margin. Icon actions use the same height and square width with zero padding. Use `zed-actions` for action groups; avoid local button sizing overrides.
