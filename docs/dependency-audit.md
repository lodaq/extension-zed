# Dependency audit — 2026-11-14

`bun audit --production` reports no vulnerabilities in the 28 production dependency packages after removing unused Radix tabs/label packages. No new production dependencies were added.

The compatibility-preserving `bun audit fix` updated Vite 8.2.2 → 8.2.4, resolving six advisories. The proposed Zod update could not be retained because its upstream consumer pins 4.5.4. Dependency scripts were disabled. The unit, lint, build and browser checks were rerun after these lockfile changes. No major overrides or forced upgrades were applied.

Eight advisories remain in development-only dependencies pinned by upstream packages:

| Package | Reachability and disposition |
| --- | --- |
| `@vitest/mocker@5.0.0` | Two moderate advisories affect the mock registration server. This project runs Vitest in `run` mode, not an exposed mock/dev server. Vitest pins this resolution; update the test stack together. |
| `brace-expansion@5.0.9` | Two high and one moderate denial-of-service advisories affect crafted glob expressions. Reached through lint tooling with developer-controlled patterns, not webpage input. Minimatch pins the vulnerable version. |
| `minimatch@10.2.6` | One moderate glob-expansion denial-of-service advisory. Linter/type tooling uses trusted project patterns. Upstream ESLint/TypeScript tooling pins this version; the suggested fix crosses a major dependency version. |
| `source-map-js@1.2.1` | One high denial-of-service advisory involving crafted indexed source maps. PostCSS/Tailwind consume trusted build inputs; browser content cannot supply source maps to the build. Both upstream packages pin this version. |
| `zod@4.5.4` | One high memory-exhaustion advisory for oversized constrained collections. The remaining copy is pinned by the React Hooks ESLint plugin and processes lint configuration/tool data, not webpage content. |

These paths are not shipped in the browser bundle as runtime validation or network services. Do not expose development/test services publicly or treat untrusted build inputs as safe. Recheck upstream compatible releases by **2026-12-14**, or sooner if build/test tooling starts accepting untrusted input. A clean production audit is not a claim that the full development tree has zero advisories.
