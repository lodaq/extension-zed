---
name: refactor
description: Make surgical structural improvements while preserving behavior.
---

- Identify a concrete maintenance problem and inspect its callers and tests.
- Choose the smallest fix: extract, rename, inline, consolidate duplication, or remove proven dead code.
- Prefer reducing concepts and code over adding modules, wrappers, classes, or compatibility layers.
- Preserve validation, error handling, cleanup, accessibility, and stored data; keep feature changes separate.
- Test each step with existing tests; run relevant README checks. Do not commit unrelated working changes.
