# Claude Guidelines - Extension Zed

## Non-Negotiable Rules

### Zero Animations & Transitions
- **Never add animations or transitions**: The app must remain as fast and instantaneous as possible.
- Do NOT use CSS transitions (`transition`, `transition-colors`, `transition-transform`, `transition-opacity`, `transition-shadow`, etc.).
- Do NOT use CSS animations (`animate-spin`, `animate-in`, `animate-out`, `@keyframes`, etc.).
- All state changes, tab switches, toggles, dialogs, and popups must render immediately with 0 ms transition and 0 ms animation duration.
- Never introduce motion libraries (Framer Motion, React Spring, Motion One, etc.).
