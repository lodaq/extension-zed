---
name: vitest
description: Write and review Vitest tests, mocks, timers, fixtures, and test configuration.
---

- Use Bun 1.4.4 and the installed Vitest version; check CLI help rather than assuming flags.
- Test observable behavior and failure paths; avoid tests that mirror implementation.
- Keep vi.mock and vi.hoisted at module scope; use vi.doMock for runtime dynamic imports.
- Restore spies, stubbed globals/environment, and real timers after tests; use async timer advancement for promises.
- Run bun run test; for order dependence use --sequence.shuffle --sequence.seed <seed>, and --repeats <n> for repetition.
- Do not weaken assertions, update expectations, add dependencies, or change application behavior merely to obtain green tests.
