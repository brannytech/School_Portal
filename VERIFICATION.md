# Upgrade verification — 17 October 2026 (Africa/Lagos)

## Latest — Phase 1, 21 October 2026 (Africa/Lagos)

Final `npm test`: **70 passed**, 23 top-level tests; **0 failed/cancelled/skipped**, including build/syntax checks. `npm run verify-math` passed all 2,600 active curriculum instances, 392 preserved-bank checks, 900 log cells and 1,000 antilog cells. Phase 1 browser acceptance: **8 checks passed**; existing three-role/mobile smoke: **10 checks passed**. No uncaught browser errors. Structured lesson/publication-history/assessment backup restoration passed; 34 pre-phase backed-up tables in the existing school database compared unchanged, with zero FK violations. See [Phase 1 report and evidence locations](docs/PHASE_1_REPORT.md). Earlier runs and external limitations are recorded there; physical devices/live providers remain unverified.

## Latest baseline — 21 October 2026 (Africa/Lagos), Phase 0

Full build/regression suite: **57 passed, 0 failed/cancelled/skipped**. Maths: **2,600** current curriculum instances covering **2,560 items and 40 lessons**, **392** preserved-bank checks, **900** log-table cells and **1,000** antilog cells. Read-only SQLite: **36 tables**, **3 migrations**, quick check `ok`, **0 FK violations**.

Headless Chrome/Playwright inspected teacher, student and admin views with isolated fictional data: **10 final checks passed**, including 360px page widths and weekly editor width. No uncaught browser errors; initial `/api/me` 401 probes were recorded separately. Actual private backup restoration matched **33 data tables and 3 media files**, with sessions/recovery tokens excluded.

See [full evidence, reproducible commands and limitations](docs/TEST_REPORT.md). These checks close Phase 0 only. Physical-device, live-service and production-hardening gates remain unverified. Historical entries below are retained for provenance.

## Executed commands

- npm test: strict TypeScript/application build passed; 24 tests passed, zero failed/cancelled/skipped on the final run.
- npm run verify-math: active curriculum: 1,624 assessment/worked-example checks, covering 1,600 assessment items and 24 worked examples; 1,000 antilog-table cells passed. The preserved earlier bank audit also passed 392 checks and 900 log-table cells. Full-prompt uniqueness is asserted within each of the 24 new subtopics.
- Node syntax checks for the updated browser modules passed after final presentation changes.

## Automated coverage

Existing approval, ownership, CSRF, teacher subject/class boundaries, term/week locks, reflection completion, image-format rejection and JPEG metadata tests remain passing. New tests cover relational migration/foreign-key constraints, durable sign-in after process restart, daily scheduled releases, quiz answer withholding, whole-attempt grading and retry immutability, mastery bands, score publication/correction, notifications, independent note maxima and resubmission, discussion moderation and direct hidden/locked question-image access, promotion archives, recovery-token replay, weighted-result calculations, private backup/restore, and clean production bootstrap with no sandbox account route or fictional students.

The backup test stopped its fixture server, dumped relational rows and local images, restored into a fresh database, checked records/media and confirmed authentication sessions were not restored. All automated tests use newly created fictional test directories.

A test-harness port-selection failure selected a port blocked by Fetch. The harness now uses OS-assigned ephemeral ports, and the final full run passed. A shutdown promise issue after the restore test was fixed by recognising an already-stopped child. These were not treated as passed gates before repair.

## Browser checks actually performed

The upgraded sign-in/sandbox flow, student session/term selectors, daily lesson outline, disabled locked days, quiz/mastery screen and creation of a real ten-question quiz attempt were inspected through browser controls. The teacher workspace and daily publication form were inspected without changing existing students’ work or marks. The viewport was set to 360 × 800 for mobile review; the outline fit without document-level horizontal overflow. The original school logo and building remain in use. The desktop layout and final mobile header were also checked for the handoff.

Browser inspection complements the executed API tests; it is not represented as a full Playwright CI suite, a physical camera test or a Lighthouse/audit certification.

## Unverified deployment boundaries

No live PostgreSQL service or S3 credentials were available, so provider migration/upload/playback and hosted HTTPS gates were not executed. Actual Android/iOS capture, PWA installation, complete upload-rotation/order workflows, captions, malware scanning and school operational retention/accessibility review remain outside this verification. See IMPLEMENTATION_STATUS.md and DEPLOYMENT.md.

## Delegated student management

- `npm test`: 35 tests pass, including strict TypeScript/build syntax checks.
- New directory fixture has 125 added learners plus existing students: checked 50-item pages, final-page size, no duplicates between pages, case-insensitive name/email/admission search, class/status filters and empty results.
- Verified that only admins can grant privileges; teachers cannot create staff, cross assigned-class boundaries or move students to unassigned classes.
- Registration requires an initial photo and remains pending until an authorised person approves it. Privilege persistence, immediate revocation and loss of a class assignment are covered.
- Browser checks: admin privilege form, teacher registration fields restricted to STUDENT/assigned classes, searchable directory, combined filters, clear-filter empty state, phone card layout and light/dark contrast.

## Teacher and subject directory pagination

- `npm test`: 40 tests pass, including fixture directories containing 106 teachers, 110 subjects and 102 current-session assignments.
- Tested bounded non-overlapping pages, last-page counts, case-insensitive search, combined class/subject/status filters matching the same assignment, assigned/unassigned filters, session isolation, invalid input rejection and admin-only access.
- Browser checks covered teacher and subject search, unassigned subjects, per-tab filter persistence, empty-state reset, teacher-to-assignment navigation, teacher registration defaults and required-photo switching. Phone width fits without horizontal overflow.

## Student progress monitoring

- Regression suite: 49 passing tests, including a fixture with exactly 12/45 weekly work done and an unlinked assignment explicitly excluded from progress.
- Checked duplicate quiz/assignment attempts, unknown/deleted questions, draft lessons, week/search/page filters, assignment-week validation, staff class/subject isolation, durable last-seen timestamps, CSRF, and attempts to report activity for another student.
- Browser: student sandbox login produced a real last-seen timestamp visible to the assigned teacher; verified learning-week filters, per-student activity graphs and weekly totals.

- Released-week checks: unreleased/draft weeks excluded, latest/previous and arbitrary week comparison, combined released-week totals, idempotent content-read confirmation, correct assignment-week attribution, release-history persistence after locking and restart.

- Browser confirmation: a sandbox student marked Week 1 content read; the assigned teacher saw it in Week 1 only, linked the sample homework to Week 1, and compared it with released Week 8. All-released-week mode and arbitrary comparison selectors were checked. Mobile layout has no horizontal overflow and rendered text passes contrast checks.

### Weekly student learning path and notebooks
- Full npm test: 51 tests passed, including private personal progress, equality with staff totals, current/previous/all week calculations, unknown/locked week rejection, historical note linking ownership, CSRF, note correction/resubmission counts and restart persistence. Focused monitoring suite rerun after aggregate note display update: 11 tests passed.
- Browser verified the student Learn page shows activity counts beside weekly lessons, week-one detail selects the matching week, and the notebook form requires a learning week. Mobile width 326px: document width 311px, no horizontal overflow.
- Notes remain separately counted without inventing a required upload quota.

### Notes removed from progress
Full build and regression suite: 51 tests passed. Confirmed notes and unlinked-note reminders are absent from monitoring responses and student weekly displays; notebook submission, linking and correction workflows still persist. Tests assert weekly completion percentage and denominator remain unchanged after note uploads and resubmissions. Browser checked the mobile student learning path and progress detail without note metrics.

### Weekly content structure, lesson builder and assignment releases
- Full build and integration suite: 57 tests passed. New tests verify draft privacy, single-week replacement, YouTube validation, hidden answer keys, one weekly quiz/reflection, release enforcement, multiple assignments, WAT deadlines, revision conflicts, stable subtopic IDs and ordering/history after restart.
- npm run verify-math passed: 392 example/assessment checks, 368 source questions, 2,600 curriculum instances, 900 log-table cells and 1,000 antilog-table cells. No shipped mathematical answers changed.
- Browser checked a 326px mobile learning path with bold subtopic names and no Day labels; subtopic navigation reaches the final lesson, whose practice precedes the weekly quiz and reflection. Teacher template loaded 5 existing subtopics, 250 practice questions, 20 weekly quiz questions and YouTube fields; Save private draft succeeded without altering published content.
- Optional notebook submission remains excluded from progress.

- Final browser preview verified the direct Weekly quiz & reflection button reaches the closing sections in the order practice → quiz → reflection. Mobile viewport 326px, document width 311px (no horizontal overflow). Assignment editor exposes learning week, work date, WAT deadline, release status, scheduled release and resubmission. Previews saved under preview/weekly-lesson-template.png and preview/weekly-quiz-reflection.png.
