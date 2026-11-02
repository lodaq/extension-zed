# Extension Zed: Permissions & Security Architecture

This document audits all permissions requested by Extension Zed, maps each permission to specific features, defines least-privilege constraints, and establishes guardrails for future capabilities.

## 1. Manifest Permissions Audit

Extension Zed declares only 3 permissions in `manifest.json`:

```json
"permissions": ["scripting", "activeTab", "storage"]
```

### Permission Mapping

| Permission | Justification & Features Using It | Least-Privilege Verification |
|---|---|---|
| `activeTab` | Grants temporary, user-invoked execution access to the active tab when opening the action popup. | Does **not** grant background access to tabs. Access expires as soon as navigation occurs or the user switches tabs. |
| `scripting` | Programmatically executes on-demand content actions (`chrome.scripting.executeScript`) when the user applies design mode, page colors, scrollbar toggles, focus mode, element inspector, or volume boost. | Only used on target tabs matching active user intent. Restricted Chrome internal URLs (`chrome://`, webstore, extensions gallery) are caught and protected with safe user messaging. |
| `storage` | Persists user preferences (`chrome.storage.local`) such as dark theme, playback speed presets, custom page colors, section order, and mode toggles. | Synced locally only on the device; no remote transmission. Includes export/import validation. |

### Host Permissions Audit

- **Requested Host Permissions**: **None**.
- Broad host access patterns such as `<all_urls>` or `*://*/*` in `permissions` / `host_permissions` are **prohibited**.
- The extension relies strictly on `activeTab` for ad-hoc user interactions, avoiding broad host access and extensive Chrome Web Store review delays.

## 2. Content Scripts Audit

Declared in `manifest.json`:

1. `scripts/playbackRatePersist.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`.
   - Purpose: Discovers `<video>` elements and synchronizes their playback rate with the user's saved rate setting.
   - Security: Runs in isolated world, no remote code execution, no DOM writing outside of video playback rate.

2. `scripts/arabicRtlMode.js`:
   - Runs at `document_idle` on `http://*/*` and `https://*/*`.
   - Purpose: Inspects first letters of text elements and applies RTL direction if Arabic script is detected (when enabled in settings).
   - Security: Runs in isolated world, uses WeakMap / reversible DOM direction attributes, zero eval or remote scripts.

## 3. High-Risk Capabilities Guardrails

### Clearing Cookies, Cache, or Site Data
- **Current status**: Deferred / Out of scope.
- **Requirement**: If ever proposed, the feature must:
  1. Use scoped APIs (e.g. `chrome.browsingData.remove` with explicit origin boundaries).
  2. Require an explicit user confirmation modal displaying the exact scope (current site vs all sites) and data types being cleared.
  3. Never clear browser credentials without explicit dual-confirmation.

### User-Injected Scripts
- **Current status**: Not in scope.
- **Requirement**: Manifest V3 strictly forbids arbitrary remote script execution or `eval()`. Any future custom scripting feature must use declarative rule sets or sandboxed iframes without `unsafe-eval`.
