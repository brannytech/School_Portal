# Phase 1 — Structured lesson content foundation

21 October 2026 (Africa/Lagos).

**PHASE: 1. STATUS: COMPLETE. Acceptance gate: PASS. Next: Phase 2 — Teacher Content Studio (not started).**

## Before and after

Before this phase, weekly teaching content was stored in legacy text fields and rendered by a fixed template. Drafts were private but had no independent concurrency token. The weekly editor/server reconstructed restricted shapes and could lose unrecognised metadata or hidden lesson-quiz items. The advanced course publication route did not archive its replaced weeks or check a content revision.

The application now accepts a versioned `document` alongside legacy lesson fields. A shared schema validates documents on both draft and publication paths. A shared browser renderer displays supported blocks and adapts existing lessons without writing converted documents back to storage. Draft and publication conflicts fail with HTTP 409. Existing field metadata and hidden quiz items survive the weekly form; replaced publications retain full snapshots.

This phase establishes the content/preservation foundation. It does not provide the visual block authoring interface, a visual equation editor, autosave, a history/restore UI or graph authoring.

## Implemented

1. `schemaVersion: 1`, stable block IDs and bounded declarative blocks: headings, paragraphs, objectives, summaries, worked examples, equation source, tables, hints, warnings, real-life explanations, experiment instructions, validated YouTube IDs, existing topic widgets and separators.
2. Server and browser share the same validator/legacy adapter. Unsupported versions, types, properties, repeated IDs, invalid table shapes, nested text payloads and over-limit content are rejected. HTML remains escaped text; there is no raw HTML, arbitrary embed or code block execution.
3. The active student view uses `renderLessonContent()`; legacy content, examples, summaries and current widgets remain visible. Invalid stored structured content gets a local error message rather than taking down the entire lesson.
4. Optional documents live in existing lesson JSON; no SQL migration or eager bank conversion. Original legacy fields remain available. Unknown metadata is preserved by ID when omitted by an older/reduced form; it is excluded from student projections. Old assessment question snapshots and official marks are unchanged.
5. Draft saves allocate missing permanent lesson/question IDs once and return a draft revision token. Published content has a separate revision fingerprint; stale or missing tokens cannot overwrite existing content. Hashes ignore incidental database object/question-bank ordering, while document block order remains significant.
6. Both weekly and advanced full-course publication validate documents and preserve previous published snapshots in the existing `weekVersions` store. Full-course reads return `X-Content-Revision`; the current JSON editor sends it back on save. This is a deliberate API contract change: stale third-party/old clients must reload and supply revisions.
7. The weekly form retains unknown fields, hidden legacy quiz questions and question proof/hint/objective/stage metadata. Structured lesson text is read-only in the legacy form, preventing stale fallback fields from replacing the document. Lesson details and practice questions remain editable. Loading the published version can discard blocks introduced only in an abandoned draft.
8. New public ES modules load before application boot through the existing final weekly script. Service worker shell cache v12 includes them; private API responses remain excluded. No frontend framework or dependency was added.

## Files modified

| File | Change |
|---|---|
| `public/lesson-document.js` (new) | Shared schema, adapter, safe student projection |
| `lesson-document.mjs` (new) | Server exports, revision hashing, preservation merge, weekly shape checks and stable IDs |
| `public/lesson-renderer.js` (new) | Shared safe block renderer and fallback |
| `weekly-content.mjs` | Draft/publish validation, revision checks, metadata-preserving normalisation, snapshots |
| `server.mjs` | Student-safe lesson response; validated/conflict-checked/archived legacy publication |
| `public/weekly-course.js` | Shared renderer, metadata/hidden-question preservation, draft revision submission, read-only structured fallback fields, module boot |
| `public/app.js` | Read course revision header and include it from advanced editor |
| `public/weekly-course.css` | Block/table/equation mobile styling |
| `public/sw.js` | Public module cache entries, cache v12 |
| `scripts/check-build.mjs` | New schema/renderer syntax checks |
| `tests/lesson-document.test.mjs` (new) | Forty-lesson parity, schema safety, projection, merge and ID invariants |
| `tests/lesson-content.test.mjs` (new) | Real HTTP/SQLite validation/conflicts, restart, snapshots and recovery |
| `tests/platform.test.mjs`, `tests/weekly-content.test.mjs` | Existing workflows updated for explicit revision contract |
| `scripts/verify-lesson-browser.mjs` (new) | Actual UI save/reopen/publish, privacy/rendering and cache acceptance |
| Existing progress/status/verification/decision/user guide and `docs/*` | Current phase, architecture, API contract, rollback and limitations |

`database.mjs`, `store.mjs`, SQL migration files, curriculum source and grading modules required no changes. `public/index.html` required no edit: the shared modules load via dynamic import before the existing `boot()` call.

## Tests executed and actual results

- Final `npm test`: **70 passed**, 23 top-level tests; **0 failed/cancelled/skipped**. Includes strict TypeScript/build syntax checks. Baseline was 57 tests.
- `npm run verify-math`: **2,600** active curriculum instances, **2,560** assessment items, **40** lessons, **392** preserved-bank checks, **900** log cells, **1,000** antilog cells passed.
- `scripts/verify-lesson-browser.mjs`: **8 acceptance checks passed**, no uncaught JavaScript errors. Teacher edited a legacy lesson, saved/reopened/published through UI; metadata/hidden questions remained; a structured draft survived browser refresh/publication; student table/example/equation-source rendering and HTML escaping passed; 360px and 768px widths fit; service worker cached modules without API responses.
- Existing `scripts/audit-browser.mjs` rerun: **10 role/mobile checks passed**, including admin/teacher/student dashboards, teacher editor and binary widget. The only HTTP errors were the expected initial unauthenticated `/api/me` probes.
- New integration tests verified actual backup/restoration of structured lessons, week history and submitted assessment results into an empty SQLite target. Foreign keys remain valid after restoration.
- Read-only comparison of existing `data/school.sqlite` against the private pre-phase backup: **34 backed-up tables exactly unchanged**, **0 FK violations**. No live-school lesson/assessment migration or mutation was made to demonstrate the feature.
- `git diff --check` passed (only line-ending conversion warnings on this Windows checkout).

Intermediate findings: a new test initially compared quiz array ordering across restart, exposing the repository's existing SQL question sorting. It was corrected to compare stable canonical content, which still detects any item/answer/metadata change. The legacy course validator initially required an old-style worked example even for a valid structured document; that implementation gap was fixed before the gate passed. Failed intermediate runs are not counted as successful checks.

Browser evidence: `test-results/phase-1-browser-1792584135553/report.json`; screenshots `structured-desktop.png`, `structured-360.png`, `structured-768.png` in that directory. Three-role rerun: `test-results/phase-0-browser-1792584167246/report.json`. All fixtures and backups remain private/ignored.

## Acceptance gate

| Criterion | Result |
|---|---|
| Existing forty lessons preserve teaching content and bank records | PASS: all-lesson adapter/render tests, mathematical checks, browser legacy workflow |
| Legacy metadata/IDs and old attempts survive save/publish | PASS: UI metadata checks and HTTP snapshot tests |
| Supported structured documents save/reopen/publish/render | PASS: real HTTP/SQLite and browser refresh/publication |
| Invalid documents and private/answer-key fields cannot bypass new paths | PASS: shared validation, strict projection, scope/CSRF/release tests |
| Stale draft/publication conflicts cannot silently overwrite | PASS: separate tokens; missing/stale cases and stale draft after course publication |
| Build/regression/maths/restart/restore/mobile checks | PASS for local scope; external/physical-device gates remain open |

## Known limitations

- Equations retain editable mathematical source but render as escaped source text. The Phase 1 checks are size/command/brace safety checks, not a complete LaTeX parser. Professional rendering and visual input belong to Phase 2; the future rendering library must apply its own safe parser/options.
- Structured blocks can be supplied through validated APIs/advanced JSON. Teachers do not yet have a visual Insert menu or block manipulation interface. The current weekly form deliberately cannot edit structured text fields.
- Supported block types are limited to this foundation. Rich inline marks/links, assessment blocks, media ownership blocks, general graphs, matrix/geometry tools, autosave and history restoration are not advertised as complete.
- Legacy question order can change when SQL reloads bank rows; item identities/content and immutable attempts are preserved. Revision fingerprints account for that existing behaviour. Block order remains preserved.
- Old published snapshots use the existing JSON `weekVersions` setting; they have no dedicated indexed revision table or history UI yet.
- Single-process operation, live PostgreSQL/S3/HTTPS, actual Android, full accessibility/performance/security certification and official curriculum/legal review remain later gates.

## Database migrations and next phase

No SQL migration. Additive optional document and revision metadata use existing JSON storage. Pre-phase backup: `.snapshots/phase-1-before-2026-10-21/`. Rollback instructions are in [database migrations](DATABASE_MIGRATIONS.md).

**NEXT PHASE: 2 — Teacher Content Studio. Not started.** Build the teacher-facing rich-text/block editor, visual and source equation editing, student-view previews, autosave and version-history/restore-as-draft controls using this tested foundation. Evaluate editor/math dependencies before selecting them. Stop at this handoff; do not implement Phases 2–9 in Phase 1.
