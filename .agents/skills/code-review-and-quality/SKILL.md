---
name: code-review-and-quality
description: Review changes before merge across correctness, readability, architecture, security, and performance.
---

- Read intent, tests, changed code, and connected callers; distinguish regressions from pre-existing defects.
- Check edge cases, races, errors, trust boundaries, cleanup, stored data, and unnecessary complexity.
- Confirm tests catch a regression by temporarily mutating a relevant condition; always restore the original from a copy.
- Check dependencies and lockfile when changed; prefer existing canonical helpers and fewer moving parts.
- Report only substantiated findings, highest impact first, with file/line, consequence, and concrete remedy.
- Label Critical/Required/Optional/Nit; approve when no blockers remain and state verification limits.
- Review only unless changes are requested; do not invent findings or delete uncertain code.
