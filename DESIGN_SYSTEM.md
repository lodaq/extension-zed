# Zed Dark

All extension UI uses `src/design-system/`. The normative source is `docs/design/extension-zed-design-spec.md` §2. Import `tokens.css` globally, `base.css` for controls, and the shared scrollbar stylesheet. Injected UI uses Shadow DOM and the same tokens via the emitted `theme.css` bundle.

Use shared Button, SwitchRow, Tile, Card, StatusPill, IconButton, LetterAvatar, Notice and Dialog components; use semantic primitive classes for rows, helper rows, key chips, group headers, empty states and inputs. Icons come from `src/design-system/Icon.tsx`. Inter is bundled in `public/fonts/Inter.woff2`.

No raw colors, radii or font sizes outside tokens.css. Use `--zed-*` tokens. Accent identifies selected/primary actions; warning identifies destructive/blocked states. Status always includes text or shape. Keep all controls keyboard accessible with visible focus, native disabled semantics and accessible names. Dialogs focus Cancel first, trap focus, close on Escape and restore focus. The popup is 640 × 600; only content scrolls. No remote assets.

Repository no-motion requirement is retained: no transitions or animations, including tooltip and switch changes. The spec duration token and reduced-motion rule are retained verbatim for traceability.
