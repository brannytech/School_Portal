# Current system audit

This is the preserved **Phase 0 baseline**. Phase 1 has since passed; see [current implementation and acceptance evidence](PHASE_1_REPORT.md). Findings and next-stage labels below describe the pre-implementation baseline, not the current feature state.

Date: 21 October 2026 (Africa/Lagos). Phase 0 only. Sources: checked-out code, executed tests, read-only SQLite inspection and a new fictional browser fixture. Existing documentation is historical context, not proof of implementation.

**Gate: PASS — a reproducible local baseline is documented.** This is an audit gate, not production certification. No Phase 1–9 implementation was performed. The user requested one stage at a time and a clear next-stage report.

## Evidence and scope

- `npm test`: build plus 57 tests passed, no failures/skips/cancellations. The first sandboxed attempt could not spawn the syntax checker; the authorised run outside the sandbox succeeded.
- `npm run verify-math`: 392 preserved-bank assessment/example checks (368 questions), 2,600 current curriculum checks (2,560 items plus 40 examples), 900 log cells and 1,000 antilog cells passed.
- `node --experimental-sqlite scripts/audit-repository.mjs`: 36 tables, three applied migrations, SQLite quick check `ok`, zero foreign-key violations. This command opens the existing database read-only.
- Browser: all three roles, weekly editor, released lesson and 360px layouts inspected with headless installed Chrome/Playwright. Final run: 10 recorded checks passed, no uncaught JavaScript errors. Three initial `/api/me` 401 responses are the expected unauthenticated boot probes; see `public/app.js:boot()`. No post-login HTTP failures recorded.
- Private baseline backup created with the existing backup command. Its fresh-target restoration matched 33 data tables and three uploaded files; authentication sessions/recovery tokens were excluded. Schema migration timestamps are deliberately not compared.
- Detailed evidence: [test report](TEST_REPORT.md), [schema and counts](BASELINE_INVENTORY.json), [file tree](REPOSITORY_TREE.md), [risks](RISK_REGISTER.md), [implementation plan](IMPLEMENTATION_PLAN.md).

The browser connector failed to initialise (`failed to write kernel assets`); the local Playwright package and installed Chrome provided the fallback. Browser checks use a new fictional DATA_DIR and never log in to the existing school database. Screenshot evidence is under the ignored `test-results` directory.

## Entry points and execution model

`package.json` exposes `dev` (watch mode), `start`, `build`, `test`, `verify-math`, backup/restore and production setup/start scripts. `server.mjs` is the HTTP entry point. `store.mjs` opens/migrates persistence during import, then loads a compatibility domain cache and saves it through `database.mjs:relationalStore()`.

`server.mjs:handle()` parses JSON, resolves authentication and academic-session context, then delegates to profile, student directory, weekly content, monitoring and LMS APIs. The `requestTail` promise serialises requests in one process. PostgreSQL configuration does not remove this single-process limitation.

`public/index.html` loads classic scripts in a deliberate order: app → upgrade → profile → students → admin directory → monitoring → weekly student → weekly course. Several scripts wrap/reassign shared functions. `public/weekly-course.js` supplies the final lesson renderer and invokes `boot()`. Changing an earlier renderer alone will not necessarily change the active interface.

## Database map

Full columns, foreign keys, CREATE TABLE definitions and row counts are in `BASELINE_INVENTORY.json` (no account values or student records).

| Area | Tables / persisted fields | Observed behaviour |
|---|---|---|
| School and calendar | schools, academic_sessions, academic_terms, classes, subjects | One school; sessions belong to it, class/subject IDs are globally named |
| Identity and allocation | users, enrolments, teacher_assignments, auth_sessions, recovery_tokens, student_presence | Three allowed roles; historical session enrolment; hashed sessions; account presence |
| Teaching | courses, course_weeks, lessons, question_items, access_rules, lesson_releases | Relational scope keys; content JSON; weekly/day/term release rules |
| Student learning | progress, practice_attempts, assessment_attempts, reflections | Formative evidence, snapshot questions, independent attempts |
| Assignments and files | assignments, files, submissions, submission_versions, marking_history | Private media references, resubmission/marking history |
| Discussions and notices | discussions, discussion_replies, announcements, notifications | Scoped discussion, private notifications |
| Official marks | scores, score_history | Published/draft marks and audited corrections |
| Operational | app_settings, audit_logs, schema_migrations | Compatibility settings, audit history, migration ledger |

`app_settings` also holds JSON collections such as weekly drafts, week versions and profile metadata when present. These are not dedicated indexed revision tables. `loadDatabase()` takes the first school row; persistence assigns users/sessions to `db.school`. This is not a tenant-safe repository.

Applied SQL migrations: `001_relational.sql`, `002_history_and_terms.sql`, `003_student_presence.sql`. The runner wraps unapplied scripts in transactions but has no general down-migration framework. The initial legacy `database.json` remains a retained import source, not active primary storage. No new migration was run for this audit.

## Authentication and authorisation map

1. `store.mjs:hash()/matches()` use scrypt with per-password salts and constant-time comparison.
2. Login in `server.mjs` rate-limits attempts, checks active status, rotates session ID and returns a CSRF token. Cookie: HttpOnly, SameSite=Strict, eight-hour lifetime; Secure is configured for HTTPS deployment.
3. `database.mjs:durableSessions()` stores SHA-256 session-ID digests. Each request rechecks expiry and active account status; suspension/recovery revoke sessions.
4. `context.mjs` supplies session-local academic scope. Student class comes from enrolment in the selected session; teachers require current session allocations; admins manage the single school.
5. `scope()`, `termAccess()`, `lessonAccess()` and `releaseState()` guard course access. Mutation requests require the session CSRF token and validate supplied Origin when present.
6. Profile/registration and delegated student management are handled by `profile-api.mjs`, `student-api.mjs` and `student-access.mjs`; teacher grants are admin-owned and rechecked.
7. `visibleFile()`, upload checks and signed access guard private local/S3 media. This audit's passing privacy tests cover specific routes, not a complete penetration test.

There is no guardian role, verified guardian link or platform administrator role. Tenant separation cannot be inferred from the schools table. A later security review must examine every legacy record-ID mutation as well as newly added routes; existing test coverage is not proof of universal authorisation correctness.

## Authoring, publication and student rendering

`public/weekly-course.js:showWeeklyBuilder()` opens the form-based weekly editor. `builderSubtopic()`, `builderQuestion()`, `readBuilder()` and `setBuilderValues()` bind text fields, questions, video links and assignments. Teachers can add/reorder subtopics with buttons; save is explicit. The observed week-one editor loads five subtopics, 250 non-quiz practice/diagnostic questions and 20 weekly quiz questions. The source lesson bank holds another ten legacy quiz questions per lesson.

`weekly-content.mjs:weeklyContentApi()` handles `weekly-template` GET/POST. Private drafts go to `db.weekDrafts`. Publication runs `prepareWeek()`/`question()`, checks the published timestamp revision, archives the existing week in `db.weekVersions`, replaces only that week and retains stable supplied lesson IDs. Assignments are separately prepared and released. Daily rules override weekly unlock defaults. A legacy JSON `course` publication route also exists in `server.mjs`; it needs the same future validation discipline.

The final `lessonPage()` in `public/weekly-course.js` renders escaped text, objectives, a worked example disclosure, optional video/activity, summary, practice, discussion and weekly closing quiz/reflection. `server.mjs` lesson responses strip question solutions; practice/assessment answers are marked server-side. No structured block document or professional equation rendering is present.

Preservation hazards: `readBuilder()` reconstructs a reduced lesson shape, and `prepareWeek()` reconstructs another whitelist. Unrecognised legacy metadata can be lost on republishing. Draft saving currently bypasses publish-time content validation and has no independent draft revision token. Published timestamp checks do not protect simultaneous draft edits. These are Phase 1 design inputs, not repairs made in Phase 0.

## Mathematics widgets and assessment logic

| Existing tool | Exact source | Current limitation |
|---|---|---|
| Binary switches / decimal conversion | public/app.js:widget(), updateWidgets() | Decimal input; offered target bases 2, 5, 8; not general base 2–16 authoring |
| Indices | Same functions, week 2 | Numeric explorer; incomplete explicit domain/error handling |
| Log / antilog | Same functions, weeks 3–5; public/upgrade.js:tableModal(), drawTable() | Generated tables exist; workshop launcher belongs to an older sidebar and requires reachability review in the final weekly layout |
| Direct/inverse variation graph | public/app.js:updateWidgets(), plot() | Fixed lesson-specific inputs and SVG plotting, not saved teacher graph definitions |
| Formula rearrangement | public/app.js week 7; public/upgrade.js formula route/form | Fixed examples; bounded numerical checking, not symbolic proof |
| Quadratic coefficients, roots, vertex, values | public/app.js week 8 | Numeric fields, fixed viewport; no general graph authoring/zoom/pan tool |
| Point plotting | public/upgrade.js:graphExercise(), pointFeedback() | One fixed coordinate exercise; old sidebar launcher needs reachability review |
| Calculator | core/domain.ts:calculate(); lms-api.mjs calculator; public/upgrade.js modal | Arithmetic, powers, functions; no full memory/factorial/degrees mode |

`widget()` is selected by SS1 Mathematics/term/week, not inserted by a teacher as a block. The weekly renderer shows an experiment text instead of the default widget when `lesson.experiment` is present. The first released binary widget was verified in the browser. Other widgets were inspected in source, not individually exercised in this browser pass. Matrices and geometry are absent.

`core/domain.ts` declares numeric, choice, boolean, short, fill, matching, steps, graph and expression kinds. These labels do not imply dedicated interaction models: most student responses are plain inputs, choices use selects, and `checkAnswer()` treats matching/steps as exact normalised strings and graph as numeric fallback. Essay review, multi-response, matrix entry, interactive matching/ordering and graph grading are not complete.

`calculate()` uses a token parser (no untrusted teacher JavaScript evaluation). `checkAnswer()` uses normalisation, numeric tolerance or five numerical samples for expression equivalence. `gradeAssessment()` gives each item equal weight. `lms-api.mjs` and `weekly-content.mjs` create question snapshots in attempts, strip solutions before submission, preserve retries and derive mastery bands from assessment percentages.

Default thresholds: Developing 50%, Proficient 70%, Mastered 85%; lesson practice completion threshold 60%. `server.mjs` combines practice coverage with reading/reflection signals for lesson completion. Weekly work completion is a distinct measure. No grading or mastery rule was changed.

## Monitoring and official marks

`monitoring.mjs:studentWorkSummary()` counts one activity per released lesson read, valid exercise attempted, weekly quiz, weekly reflection and linked assignment submitted. Retakes do not inflate completion. Practice accuracy uses latest known answers to valid questions. `rememberLearningReleases()` preserves released-week history through relocking. Personal progress derives student identity from the session; staff monitoring is scoped/paginated. Notebook uploads are intentionally excluded from work percentages and displays.

`public/monitoring.js` and `public/weekly-student.js` render staff and student views. The formative assessment history retains separate attempts and bands. It is not a deterministic subtopic recommendation/intervention engine yet.

`core/results.ts:summariseResults()` averages published component percentages, applies configured test/exam/optional-note weights and leaves the total incomplete when required marks are missing. Default weighting is 40/60/0. `lms-api.mjs` supports draft/publication/import/correction. This is not a complete configurable report-card or timed examination system.

## Reusable UI and performance boundaries

Retain `esc()`, `field()`, `area()`, `select()`, `btn()`, `modal()`, shared card/grid/row classes and blue/crimson themes. `public/brand.css` and `style.css` define the visual foundation; weekly-course CSS already handles 360px editor widths. Reuse current session/class/subject filters, authenticated `api()`, upload flow, private storage and release functions.

The current 250-question weekly editor and 50-question mobile lesson are long forms. Passing no-overflow checks does not establish low-end-device performance or good editing ergonomics. The service worker caches the public shell and excludes `/api/`; authorised offline lesson reading is not implemented. No editor/graph libraries are installed. Library compatibility/licensing/security evaluation belongs to Phase 2/3 before selection, and no library recommendation is final in this audit.

## Feature gap matrix

| Feature | Existing implementation | Reuse | Modification needed | New development | Test status |
|---|---|---|---|---|---|
| Lesson editor | Weekly text forms, question rows, manual draft/publish | Yes | Preserve metadata; validate drafts; revision conflicts; less form overload | Block studio, autosave, preview, restore UI | Existing API suite and browser verified; new studio absent |
| Equation support | Escaped text/Unicode and parsed numeric expressions | Yes | Editable mathematical source and safe rendering | Visual equation input, LaTeX validation/rendering, inline maths | Parser tested; professional equation UI absent |
| Graph tools | Lesson-specific SVG plots and fixed point task | Yes | General definitions, viewport/domain rules, reachable controls | Graph authoring, sliders, saved configuration, plotting grading | Existing calculations audited; generic graph UI absent |
| Assessment engine | Snapshot attempts, equal-weight grading, numeric/choice/expression | Yes | Dedicated interaction contracts; history/version references | Advanced kinds and review workflow | Existing 57-test baseline passes; advanced types partial |
| Student monitoring | Released weekly work counts, accuracy, scoped progress | Yes | Evidence-linked weakness calculations, retain official marks separation | Recommendations, interventions, reassessment traces | Existing integration calculations verified |
| Multi-school support | School row, single global domain cache | Limited | Tenant keys, repository scope, role/session/storage model | Provisioning, isolation tests, plans/subscriptions | Not implemented or verified |
| Parent portal | Guardian phone registration field | Limited | Role constraints and disclosure policy | Verified links, revocation, guardian endpoints/UI | Not implemented |
| Academic reporting | Draft/published marks, CSV, weighted totals | Yes | Configurable components and approvals | Report cards, PDF/XLSX exports, coverage reporting | Existing marks calculations verified; full reports absent |
| Operations/offline | Backup/restore, production bootstrap, private storage adapters, shell cache | Yes | Provider recovery, privacy-safe offline design | Operational hardening, device/performance/accessibility certification | Local backup/restore passed; live services/devices unverified |

## Phase closeout

PHASE: 0 — Repository audit and baseline

STATUS: COMPLETE; local audit acceptance gate passed.

IMPLEMENTED: Read-only schema/tree inventory, isolated browser smoke script, fresh-target backup verification, audit/gap matrix, file-level implementation plan, risk register and test report. Existing regression tests were retained and executed; no redundant application tests or feature changes were added.

FILES MODIFIED: `.gitignore` (ignore private snapshots); audit scripts and documents listed in `TEST_REPORT.md`; existing status/verification/decision documents linked or appended.

TESTS EXECUTED: Full build/test suite, maths verification, SQLite integrity/FK inspection, three-role desktop/mobile browser smoke, actual baseline backup/restore comparison.

PASSED: 57 tests, mathematical counts above, 10 final browser checks, 33 table/3 media restore comparisons.

FAILED: No unresolved baseline test failures. One browser harness run selected a lesson before navigation completed; adding an explicit heading wait resolved the harness race. Original failed artifacts were retained.

NOT RUN: Live PostgreSQL/S3/HTTPS, real Android hardware, complete security/accessibility/load audits, official curriculum accreditation or NDPA/NDPC compliance review. These are external/later-phase gates, not prerequisites for documenting this local baseline.

KNOWN LIMITATIONS: See gap matrix and risk register. Production readiness is not claimed.

DATABASE MIGRATIONS: None added. Existing backup restored successfully into a fresh test target.

EXISTING FEATURES VERIFIED: Auth/approval, academic/release isolation, immutable attempt snapshots, weekly publishing/drafts, private uploads/marking, progress calculations, recovery and production bootstrap via existing tests; representative role views via browser.

NEXT PHASE: **1 — Structured lesson content foundation. Not started.** Introduce versioned validated blocks, a lossless legacy adapter and shared student renderer, then prove legacy/history preservation before the visual studio in Phase 2.
