# Agent Guidelines - Extension Zed

All UI uses the Zed Dark design system in `src/design-system/`; see DESIGN_SYSTEM.md. No raw colors, radii or font sizes outside tokens.css.

## Project skills

Skills live in `.agents/skills/`. Read the relevant `SKILL.md` before using a skill; load its references only as needed.

- `modern-web-guidance`: Search and retrieve current guidance before implementing HTML, CSS, or client-side JavaScript changes, following its workflow.
- `chrome-extensions`: Manifest V3 APIs, permissions, service workers, messaging, and Chrome Web Store publishing.
- `chrome-extension-best-practices`: Extension performance, reliability, and code quality.
- `chrome-extension-ui`: Popup, options, side panel, and content script UI; use this project's Zed Dark tokens and components.
- `vercel-react-best-practices`: React rendering and performance; apply rules relevant to this Vite SPA.
- `accessibility`: Keyboard navigation, focus, semantics, and accessibility audits.
- `security-and-hardening`: Untrusted page content, message validation, storage, and external integrations.
- `performance-optimization`: Profiling and targeted performance improvements.
- `playwright-chrome-extension-testing`: Browser tests for unpacked Manifest V3 extensions.

Apply skills when their scope matches the task. Installing these skills does not authorize unrelated code changes or publishing. Keep the design system requirements above when adapting UI guidance.
