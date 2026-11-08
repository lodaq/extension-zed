# Extension Zed: Contributor Guide & Manual Smoke-Test Checklist

## 1. Contributor Guide

Follow these steps when adding a new action or injected script.

### Step 1: Define the Action & Execution Strategy
1. In `src/lib/actionRegistry.ts`:
   - Add your action event name to `PageAction`.
   - Add its execution strategy to `ACTION_REGISTRY` (e.g. `{ type: "script", file: "scripts/myScript.js", allFrames: true }` or `{ type: "flagged_mode", ... }`).
   - If it accepts a value or toggles a mode, update `validateActionRequest()`, `MODE_KEYS`, or `BOOLEAN_KEYS`.

### Step 2: Implement the Injected Script (if applicable)
1. Add the script file under `public/scripts/myScript.js`.
2. **Reversibility Rule**: Never mutate inline `style` properties on existing host elements. Use:
   - A Zed-owned `<style id="zed-my-feature">` element, and/or
   - A Zed-owned attribute / class (e.g. `[data-zed-my-feature]`).
3. Ensure the script cleans up completely when toggled off or reset.

### Step 3: Add the UI Action
1. In your popup component (e.g. `src/components/MiscSection.tsx`), invoke the action via `sendPageAction`:
   ```ts
   import { sendPageAction } from "@/lib/withActiveTab"

   await sendPageAction("myAction", "My feature applied")
   ```

### Step 4: Verification & Quality Gates
1. Run tests: `bun run test`
2. Run linter: `bun run lint`
3. Verify build: `bun run build && bun run check:build`

---

## 2. Manual Injection Smoke-Test Checklist

Before cutting a release or loading `dist/` into Chrome, execute this manual checklist:

### 1. Standard Web Pages (`https://en.wikipedia.org` or similar)
- [ ] **Popup Launch**: Click extension icon; popup opens with dark theme and active tab.
- [ ] **Page Colors**: Pick background & text colors. Page styling updates immediately without breaking layout.
- [ ] **Color Reset**: Click Reset; all custom page colors clear and original page appearance restores.
- [ ] **Scrollbars**: Toggle "Hide Main Scrollbar" and "Hide All Scrollbars"; scrollbars vanish. Toggle off; scrollbars return.
- [ ] **Design Mode**: Toggle Design Mode on; text can be edited directly. Toggle off; editing ends.
- [ ] **Inspect Mode**: Toggle Inspect Mode on; hover over elements to see highlight box and computed styles. Toggle off; overlay cleanly removes.

### 2. Video & Audio Pages (`https://www.youtube.com`)
- [ ] **Playback Controls**: Adjust speed slider. Video playback rate responds.
- [ ] **YouTube Focus Mode**: Toggle focus mode; player fills viewport, related videos & comments hide. Toggle off; page layout and scrollbar restore without leftover inline styles.
- [ ] **YouTube Progress Bar & Controls**: Toggle hide progress bar and hide controls. Styles apply and revert cleanly.
- [ ] **Volume Booster**: Increase volume slider up to 2000%; audio volume boosts smoothly without distortion or unhandled audio errors.

### 3. Single Page Applications (SPAs) & Navigation
- [ ] Navigate between pages without a full reload. Content scripts persist or re-apply cleanly without duplicate style tags.

### 4. Restricted Pages Guardrail
- [ ] Open `chrome://extensions` or Chrome Web Store.
- [ ] Trigger an action from popup.
- [ ] **Expected result**: Clear warning toast ("This page is protected by Chrome and cannot be modified") without unhandled exceptions or blank screens.
