---
name: code-simplification
description: Simplify existing code for clarity without changing behavior.
---

- Scope to recently changed code unless the user requests broader cleanup.
- Read callers and tests before editing; preserve outputs, side effects, ordering, validation, error handling, and stored data.
- Prefer guard clauses, descriptive names, existing helpers, and deleting proven redundancy. Avoid speculative abstractions and cosmetic churn.
- Make one focused change at a time; run relevant existing tests unchanged, then lint and build as appropriate.
- Report the concrete reduction and verification; skip changes that merely move complexity.
