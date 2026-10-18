# Upgrade verification — 17 October 2026 (Africa/Lagos)

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
