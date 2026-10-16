# PROGRESS

## Phase 0 — Audit and baseline (this session, Node v22.22.0)

Measured by running the commands in this session, on the `main` clone of brannytech/School_Portal:

- `npm test` → 11 tests, 11 pass, 0 fail.
- `npm run verify-math` → 392 assessment/example checks, 368 questions, 900 log-table cells.

Existing implementation: dependency-free Node server (`server.mjs`), JSON-file store (`store.mjs`), vanilla JS SPA (`public/`), generated content (`content.mjs`, `enrichment.mjs`).

Known gaps are listed in CODEX_MASTER_PROMPT_ADDENDUM.md §37 (templated explanations, JSON persistence, in-memory sessions, missing KaTeX / question types / notifications etc.).

## Next: Phase 1 (production foundation)
Next.js + TypeScript + Prisma/Postgres + Auth.js + R2 per addendum Part Z, with parity tests against the 11 baseline tests, `scripts/import-legacy.ts`, and Playwright role smoke tests.

## Status / blockers
- Pushing to GitHub from this session is refused (Claude GitHub App not installed for this repo); work stays local until access is granted.
