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

## Update 17 Oct 2026 — lessons and layout
Measured in this session after the changes:
- `npm test` → 26 tests, 26 pass (adds `tests/curriculum.test.mjs`).
- `npm run verify-math` → 2,600 curriculum items/examples independently audited (2,560 assessment items, 40 lessons) plus 1,000 antilog cells; legacy bank audit unchanged (392/368/900).
- Added lessons 4 and 5 to each of the 8 topics (new generators with auditable operations); mastery sets now sample all five lessons. Existing databases gain the new lessons through curriculum migration v4 (appends only; teacher-edited content is untouched).
- Layout: mobile hero text no longer overlaps the artwork, consistent section spacing, visible focus outlines, reduced-motion support.
- Not done: explanations for the new lessons are authored but short; no external curriculum review; live Postgres/S3 still unverified.
