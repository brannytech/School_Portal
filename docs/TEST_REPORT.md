# Phase 0 baseline test report

Current result after Phase 1: **70 tests passed**, maths verification passed, 8 new browser acceptance checks and 10 existing role/mobile checks passed. See [Phase 1 evidence](PHASE_1_REPORT.md) for current commands, screenshots, restore checks and limitations. The original Phase 0 report follows unchanged for provenance.

Executed 21 October 2026 (Africa/Lagos), Node v22.11.0, installed dependencies from the current lockfile. No application feature code changed.

| Check | Actual result |
|---|---|
| `npm test` (includes `pretest` build) | PASS: strict TypeScript build/application syntax checks; 57 tests, 17 top-level tests, 0 failed/cancelled/skipped |
| `npm run verify-math` | PASS: preserved bank 392 checks / 368 questions / 900 log cells; current bank 2,600 instances / 2,560 items / 40 lessons; 1,000 antilog cells |
| `node --experimental-sqlite scripts/audit-repository.mjs` | PASS: 36 tables; migrations 001–003 applied; SQLite quick check `ok`; no FK violations |
| `npm run backup -- .snapshots/modernisation-baseline-2026-10-21` | PASS: private relational backup and media snapshot |
| `node --experimental-sqlite scripts/audit-backup.mjs .snapshots/modernisation-baseline-2026-10-21` | PASS: fresh-target restore; exact canonical row comparison across 33 data tables and SHA-256 comparison of 3 media files; no sessions/tokens restored, no FK violations |
| `node scripts/audit-browser.mjs` with bundled Playwright | PASS: 10 final checks, all roles sign in, teacher template contents, released student lesson/widget, role page widths at 360px and mobile editor internal width; no uncaught errors |

## Existing regression coverage retained

The current tests already cover curriculum structure, image validation, calculator/expression grading and mastery boundaries, relational constraints, release scheduling, answer withholding, scores and marking history, private files, session promotion/history, auth restart/suspension/recovery, recovery restore, production bootstrap, delegated student permissions, staff directories, monitoring denominators/retakes/week comparison, notebooks excluded from progress, theme contrast and weekly template publishing/revisions.

Files: `tests/admin-directory.test.mjs`, `curriculum.test.mjs`, `images.test.mjs`, `lms-upgrade.test.mjs`, `monitoring.test.mjs`, `platform.test.mjs`, `production.test.mjs`, `profile.test.mjs`, `recovery.test.mjs`, `student-management.test.mjs`, `theme-contrast.test.mjs`, `weekly-content.test.mjs`.

No redundant tests were added for documentation. The new scripts provide reproducible audit, browser and actual-backup evidence independent of the existing fixture suite.

## Browser evidence and limits

Final report: `test-results/phase-0-browser-1792583093854/report.json`. Screenshots: `teacher-desktop.png`, `teacher-editor.png`, `teacher-editor-mobile.png`, `teacher-mobile.png`, `student-desktop.png`, `student-lesson.png`, `student-mobile.png`, `admin-desktop.png`, `admin-mobile.png` in that directory.

Installed Chrome was launched headless with three isolated browser contexts. Viewports: desktop 1366×900, mobile 360×800. Each role's measured document width was 360px at a 360px viewport. The weekly editor's internal client/scroll widths were both 344px. The teacher editor loaded 5 subtopics, 250 non-quiz questions and 20 weekly quiz questions. Student lesson rendering and the binary widget were verified. Screenshots were inspected; no physical device testing is implied.

Three initial 401 console/resource messages were traced to `/api/me` before authentication. This is `boot()` probing whether a session exists, followed by the expected sign-in screen. No post-login HTTP errors or uncaught JavaScript errors were recorded.

An intermediate browser run failed because the harness selected a lesson before the asynchronous Learn navigation completed; the existing dashboard had two matching lesson links. The harness now waits for the weekly-learning heading. The final rerun passed. Failed artifacts remain under `test-results/phase-0-browser-1792583059699/`; the initial successful pass is also retained. This was an inspection-script timing correction, not an application fix.

Native browser connector initialisation failed with a missing kernel asset path. The installed local Playwright module and Chrome supplied a working fallback. To reproduce on another machine, install Playwright separately or set `PLAYWRIGHT_MODULE` to its `index.mjs` file and optionally `AUDIT_BROWSER_CHANNEL` to an installed supported browser channel. Browser tooling was not added to application dependencies.

## Backup evidence

Private source: `.snapshots/modernisation-baseline-2026-10-21/`. Fresh restore report: `test-results/phase-0-restore-1792583072263/verification.json`. Contents remain ignored and are not included in documentation. `schema_migrations` application timestamps differ naturally on the fresh target and are not compared. The 33 actual data tables match exactly; three media hashes match. This verifies local recoverability, not encrypted offsite backup or provider recovery.

## Not run

Live PostgreSQL, live S3, hosted HTTPS, real Android camera/touch/keyboard, comprehensive accessibility/load/security tests, official curriculum review and current legal compliance assessment. These remain explicit later/external gates.

## Files introduced or updated in Phase 0

- `.gitignore`: protect private snapshot directory from accidental commits.
- `scripts/audit-repository.mjs`, `scripts/audit-browser.mjs`, `scripts/audit-backup.mjs`: reproducible inspection only.
- `docs/CURRENT_SYSTEM_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `RISK_REGISTER.md`, `TEST_REPORT.md`, `REPOSITORY_TREE.md`, `BASELINE_INVENTORY.json`: current audit, plan and evidence.
- `DEVELOPMENT_PROGRESS.md`, `VERIFICATION.md`, `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`: current milestone entry/links; historical entries retained.

**Acceptance: Phase 0 PASS. Phase 1 not started.** No new feature, production deployment, database migration, grading change or curriculum replacement is represented as complete.
