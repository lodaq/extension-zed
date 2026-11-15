---
name: github-actions-hardening
description: Review GitHub Actions workflows for injection, privilege, supply-chain, and secret risks.
---

- Map triggers and token scopes first; fork pull_request normally has a read-only token and no secrets.
- Flag privileged triggers executing fork code; never execute untrusted artifacts in a privileged job.
- Trace expressions into shell/scripts; pass untrusted values through quoted environment variables instead of interpolation.
- Require least-privilege permissions; inspect checkout credential persistence, secrets, outputs, caches, and runner isolation.
- Pin third-party actions to verified full commit SHAs; recommend the same for first-party actions, retaining version comments.
- Report severity, exact location, exploit conditions, and concrete corrected YAML for high/critical findings.
- Present fixes before applying unless the user already authorized them; never publish or change credentials as part of a review.
