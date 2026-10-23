# Incremental implementation plan

Updated 23 October 2026 (Africa/Lagos). **Phases 0-3 complete within documented scope. Next: Phase 4 - Advanced question authoring (not started).** Execute and report one phase at a time. [Phase 3 acceptance](PHASE_3_REPORT.md) records implemented mathematics/blank authoring, checks and limits; [its plan](PHASE_3_PLAN.md) is retained. Earlier plans below are historical.

## Phase 1 — structured lesson content foundation (completed)

The file-level plan below is retained for provenance. Implementation uses a shared `public/lesson-document.js`, server re-export/helper `lesson-document.mjs` and ES-module renderer imported before existing boot; no change to `public/index.html`, `database.mjs` or `store.mjs` was necessary. No SQL migration was required. Phase 1 stopped before the visual studio.

Objective: establish a safe versioned content contract while keeping all current lessons, question IDs, attempts, release controls and grading rules usable. This stage does not implement the visual studio, new graph authoring, diagnostics, parents or tenancy.

| Exact module / function | Planned change | Evidence required |
|---|---|---|
| New `lesson-document.mjs`: `validateLessonDocument()`, `legacyLessonToDocument()`, `documentForLesson()` | Pure versioned schema, size/depth/type limits; stable block IDs; explicit allowed block properties. Adapter produces supported text/heading/objective/example/summary/activity blocks without deleting source fields. Reject unsupported versions/types instead of silently discarding them. | New `tests/lesson-document.test.mjs`: valid documents, malformed inputs, unsupported versions, XSS payload handling, size/depth limits, repeated IDs and adapter determinism |
| `weekly-content.mjs:prepareWeek()`, `question()`, `weeklyContentApi()` | Preserve original legacy content metadata and optional versioned document. Validate structured documents on draft save and publish; retain permissive incomplete legacy draft editing. Add independent optimistic draft revisions; keep published revision checks. Generate permanent IDs once on save. | Expand `tests/weekly-content.test.mjs`: old/new draft save/reopen, conflicts, rejected input leaves live week/history unchanged, unknown legacy fields survive |
| `server.mjs:handle()` lesson response and legacy `course` POST | Apply shared validation to every publishing ingress; project only student-safe document fields. Never expose embedded question answers through document JSON. Keep term/day/week and file permissions. | API tests for student/staff scope, release locks, hidden keys, both publication paths |
| New `public/lesson-renderer.js`: `renderLessonDocument()` | Pure safe shared renderer for supported Phase 1 blocks. Escape text/attributes and permit only declared safe elements/links. Existing fields remain fallback. No arbitrary teacher HTML/JavaScript or general embeds. | New renderer tests; browser snapshots of old vs adapted lessons; malformed block fails locally without blanking whole page |
| `public/weekly-course.js:lessonPage()`, `readBuilder()`, `loadWeeklyBuilder()` | Render document through shared component, preserve fields not edited by current form; avoid overwriting a document with stale legacy text. Expose no unsupported block UI yet. | Save/reopen and old-lesson render parity; demonstrate original data snapshots remain intact |
| `public/index.html`, `public/weekly-course.css`, `public/sw.js` | Load shared renderer before weekly-course boot; bounded block styles and public shell asset version update if needed. API/private documents remain excluded from shell cache. | 360px rendering and restart/cache smoke |
| `database.mjs:loadDatabase()/relationalStore()`, `store.mjs` | Verify optional document is retained in existing `lessons.content` JSON and snapshots; avoid whole-bank regeneration or eager conversion on startup. | Restart, backup/restore and JSON roundtrip preservation |
| `scripts/check-build.mjs`, `tests/lesson-document.test.mjs`, `tests/weekly-content.test.mjs` | Include new module syntax and meaningful migration/compatibility coverage. | Full test suite and maths verification stay green |

### Storage and rollback decision for Phase 1

Existing lesson JSON can carry an additive `document` with `schemaVersion: 1`, so **no SQL migration is expected for the initial block foundation**. Confirm this against the final implementation before coding. Keep legacy fields verbatim, store explicit original snapshots for any conversion that is persisted, and perform conversion on demand rather than destructive bulk backfill. Unknown legacy properties remain in the source snapshot; unknown structured block types are rejected with a helpful validation error.

Rollback: restore a reviewed backup into an empty directory and switch DATA_DIR with the application stopped. A code rollback must still find intact original legacy fields. A future normalised revisions table requires a separately reviewed forward/down migration and restore coverage; do not invent a schema migration just to match an illustrative JSON example.

### Phase 1 acceptance gate

1. Existing 40 shipped lessons render with their objectives, explanations, examples, activities and summaries; preserve historical custom content too.
2. Old lesson fields and unrecognised metadata survive editor load/save/publish. Stable lesson/question IDs remain stable. Existing attempts and results retain their original snapshots.
3. New supported block documents save, reopen, publish and render; malicious/invalid documents are rejected server-side on all authoring routes.
4. Student responses do not disclose assessment answers or private/unreleased material through new blocks.
5. Stale draft or publish revisions produce a conflict instead of silently overwriting newer work.
6. Full tests, maths audits, SQLite restart/backup roundtrip and desktop/360px renderer checks pass. Record exact counts, modified files and limitations.

## Later phases — scope, files and gates

| Phase | Planned files / integration points | Gate before advancing |
|---|---|---|
| 2 — Teacher Content Studio | New `public/content-studio.js/.css`; shared renderer/schema; weekly draft/publish API; revision storage. Evaluate TipTap/ProseMirror/Lexical for vanilla compatibility and MathLive/KaTeX for editable equations with current official docs/licensing. Add debounced autosave, revision history, restore-as-new-draft, student mobile/tablet/desktop preview. | Teacher creates, saves, reopens, previews and publishes rich text/equations without code; student uses identical renderer; conflict/offline errors tested |
| 3 — Interactive Mathematics | New reusable math/graph domain module and browser graph blocks; reuse `calculate()`, `plot()` concepts, log tables and widget behaviour. Extend schema, renderer and studio insert controls. Evaluate independent local graph renderers before choosing a dependency. | Accurate saved graphs/parameters, independent numerical/domain tests, mobile interactions; advanced capabilities not advertised until verified |
| 4 — Advanced question authoring | `core/domain.ts`, `weekly-content.mjs:question()`, `lms-api.mjs` assessment routes; new typed authoring/response renderers and immutable question revisions. Normalised question versions/attempt references require new transactional migrations and restore coverage. | Every advertised type can be authored, answered and graded/reviewed correctly; immutable historic attempts, no answer leakage |
| 5 — Personalised learning | New evidence/recommendation domain module; existing practice/assessment records and `monitoring.mjs`; intervention API/UI, additive intervention storage/migration if appropriate. | Deterministic recommendations trace to actual question/subtopic evidence; low confidence shown; official marks/mastery semantics preserved |
| 6 — Academic monitoring | `monitoring.mjs`, `core/results.ts`, existing teaching/admin/progress views; new configurable assessment components, approvals, coverage and report/export modules with migrations as required. | All dashboard/export/report totals reconcile to authorised records and school policy; no activity-based teacher rankings |
| 7 — Parent portal | `core/domain.ts` roles, `migrations/001_relational.sql` role constraint replacement through a new migration, new guardian link repository/API/UI. SQLite constraint/table migration and PostgreSQL equivalent need tested rollback. | Verified/revocable child links; guardian cannot access other children or private discussions |
| 8 — Multi-school SaaS | Refactor `database.mjs`, `store.mjs`, `context.mjs`, every API/repository and storage namespace; additive schools/plans/subscriptions/invoices schema and audited Grace-Field backfill. Replace single-school loads/global identifiers before enabling schools. | Two fictional schools isolated through APIs/files/reports; original data reconciled before/after migration and rollback; no hard-coded commercial pricing |
| 9 — Production hardening | `DEPLOYMENT.md`, backup/restore/storage adapters, operational scripts and deployment configuration; staging PostgreSQL/S3 tests, restoration, security/accessibility/performance and actual-device audits. | Critical operational checks pass, external evidence recorded, unresolved risks explicitly accepted; no production claim from local tests alone |

Later file names are integration targets, not permission to implement those phases now. Write a detailed phase-specific file/function/schema/test delta immediately before each phase. Preserve this plan as the overall tracker and update the completed/next stage at every handoff.

## Assumptions to retain

- Existing optional notebook workflow remains excluded from work-completion percentages unless the user explicitly changes it.
- Official grading and mastery thresholds are unchanged; configurable policies are not silently replaced.
- No paid provider, external curriculum accreditation, production deployment or guardian consent policy is assumed.
- Keep blue/crimson school assets, lightweight frontend, current session/enrolment logic and private storage.
- The existing eight-topic bank is verified local content, not proof of complete NERDC curriculum coverage.
