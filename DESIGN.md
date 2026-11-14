# Extension Zed design system

These rules apply to every extension surface: popup tabs, settings, errors, notifications, inspectors, capture selection, and screenshot preview. Website content and third-party extension artwork retain their own design.

## Components and shape

- Use the installed shadcn/ui components in `src/components/ui` for controls. Reuse Button variants, Tabs, Switch, Label, and ScrollArea before adding components or dependencies.
- All extension-owned elements have square corners: `border-radius: 0`. Use `rounded-none`; no rounded buttons, panels, inputs, switches, thumbnails, dialogs, or scrollbar thumbs. Keep `--radius` at zero and preserve the global radius guard.
- Use native browser surfaces only where the execution context requires them: injected selection/preview uses a native dialog and DOM controls inside a closed Shadow DOM; the clipboard button lives in a small extension-origin frame. Those surfaces must use the same theme tokens, square corners, control sizing, and focus/hover states as shadcn controls. Do not add a second component framework for them.

## Theme, type, and spacing

- `src/theme.css` is the source of light/dark theme tokens. Import it in extension documents and pass it into isolated injected UI. Colors come from semantic tokens (`background`, `card`, `foreground`, `muted`, `accent`, `border`, `input`, `primary`, `ring`), never separate control palettes.
- Use the application sans-serif font for labels and controls. Reserve monospace for passwords, code, and numeric inspection data. Section headings use `popupSectionTitle`; descriptions use `popupDescription` from `src/lib/popupLayout.ts`.
- The popup is 480px wide and 600px high, with no outer padding. Settings is a separate button at the far right of navigation. Use the existing compact spacing inside panels: panel padding 12px, section gaps 12px, control gaps 8px. Standard controls are 36px high and small controls 32px. Icon-only controls need a clear accessible name and a visible focus ring.
- Use Radix icons already installed in the app. Preserve screenshot pictograms without a separate font or color scheme.

## Interaction and scrolling

- Hover, focus, selected, disabled, loading, and error states must remain clear. Use existing shadcn variants and semantic tokens. All changes are immediate: zero CSS animations and transitions, including imported component defaults.
- `src/scrollbar.css` is the only scrollbar stylesheet for extension UI. Use it for every scrollable document and Shadow DOM surface. Keep track, thumb, width, and hover definitions there; use its theme variables. Never alter website scrollbars merely to style an extension overlay.
- Keep preview bounded to 760px width and `min(640px, 80dvh)` height. Its image scrolls inside the panel; action buttons remain visible. Preserve keyboard navigation, Escape dismissal, screen-reader labels, and status announcements.

## Review

Before finishing UI work, check both themes, computed square corners, keyboard focus, hover/disabled states, scroll containment, and the shared scrollbar. Run the repository's relevant checks and inspect the UI in Chromium. Update these rules when the user changes the system.
