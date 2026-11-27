# Extension Zed

- All UI uses `src/design-system/`; follow DESIGN_SYSTEM.md. No raw colors, radii, or font sizes outside tokens.css.
- Keep Manifest V3 behavior, validate messages and imported settings, and retain error handling and cleanup for page modifications.
- Preserve keyboard navigation, accessible names, visible focus, dialog focus restoration, and existing stored data.
- Use Bun 1.4.4. Run the relevant checks listed in README.md; browser tests require a built `dist/`.
- Do not publish releases, install the administrator companion, or change browser/OS policy without an explicit request.

## Project skills

- Use [ce-simplify-code](.agents/skills/ce-simplify-code/SKILL.md) when existing code needs clarity improvements without behavior changes.
- Use [refactor](.agents/skills/refactor/SKILL.md) for surgical structural improvements: extract, rename, or break down code while preserving behavior.
- Use [code-review-and-quality](.agents/skills/code-review-and-quality/SKILL.md) before every merge; review correctness, readability, architecture, security, and performance.
- Use [vitest](.agents/skills/vitest/SKILL.md) when writing or reviewing tests, mocks, timers, fixtures, or coverage; verify CLI options against the installed version.
- Use [github-actions-hardening](.agents/skills/github-actions-hardening/SKILL.md) when writing or reviewing GitHub Actions workflows; present proposed security fixes for review before applying them.
