# Implementation prompt for another coding agent (Codex, Claude Code, Antigravity or similar)

Copy everything below the line into the agent. Keep this file in the repository and update it when a step is finished.

---

You are continuing work on **Olawale's Lab**, a multi-school learning platform for Nigerian secondary schools (JSS1 to SS3, three terms per session), repository `brannytech/School_Portal`. Teachers write lessons, quizzes, practice questions and assignments in a **Lesson Studio**; students learn and answer on phones with little data; admins and teachers monitor progress. The final goal is **SaaS for education**: many schools on one platform, each with fully independent data, each customisable (name, logo, building photo, colours) on one common code base.

## 1. Read first (in this order)
1. `docs/V3_AUDIT_AND_PLAN.md` on branch `audit-v3`: the approved plan. Sections 9 (roadmap), 10 (decisions), 11 (hosting), 12 (support monitor), 13 (parent report), 14 (lesson import), 15 (audio and written answers), **16 (multi-school)** and 17 (review of an external proposal and telemetry rules). The owner's decisions in section 10 are final.
2. `docs/LESSON_STUDIO_GUIDE.md`, `README.md`, `DEPLOYMENT.md`.
3. `tests/` (what behaviour is already protected) and `scripts/` (browser verification scripts).

## 2. Branches and state
- `main`: last released version (do not push to it).
- `clean-platform-v2` (PR #4): clean-state platform, Lesson Studio v2, question images, late-work marking, small-window Studio, improved question import. Merge first.
- `multi-school` (PR #6, stacked on #4): **step 1 of multi-school done**: one database and uploads folder per school, requests routed per school, school code at sign-in, `npm run create-school`, isolation tests.
- `audit-v3`: documentation only (the plan).
Create each new piece of work on its **own branch from the newest merged work** and open one pull request per step. Never leave `main` or a merged branch broken.

## 3. Architecture you must respect
- Node 22, run with `node --experimental-sqlite`. One long-running process, plain `node:http` in `server.mjs`. Requests are handled **one at a time** (a promise chain), which the multi-school design relies on.
- Data: the whole school database is loaded in memory (`db`), and `save()` writes changes to SQLite (or Postgres when `DATABASE_URL` is set). Migrations are in `migrations/*.sql`, run in order.
- **Multi-school**: `store.mjs` holds a registry (`schools.json`) and one *tenant* per school (own database, own uploads folder). `db`, `sql`, `save`, `tenantDir()`, `storagePrefix()`, `sessionStore()`, `uploadLinks()` are views that always point at the school of the current request (set in `server.mjs` from the school code in a sign-in request, or from the cookie `lab_session=<code>.<token>`). Never import another school's data, never cache `db` arrays across requests, never add a global map keyed only by user id.
- Front end: vanilla JS single-page app in `public/` (`app.js`, `upgrade.js`, `weekly-course.js`, `monitoring.js` as classic scripts sharing globals) and an ES-module Lesson Studio in `public/studio/`. Editor bundle (TipTap, MathLive, KaTeX) built by `npm run build` from `client/`.
- Strict TypeScript core in `core/` compiled to `dist/` (grading, results). Shared rules there must stay pure and tested.
- Question kinds: numeric, choice, multi, boolean, short, expression, fill. Assignment modes PHOTO and ONLINE; auto-grading immediate or after review; new work starts LOCKED. Online work submitted after the due time is marked and flagged late.
- Files are stored locally or in S3 (`STORAGE_DRIVER=s3`); S3 keys are prefixed per school.

## 4. Non-negotiable rules
1. **Isolation first.** A person in school A must never read, change, count or detect school B's data. Every new endpoint, query, file route, report and background job must work through the per-request school views. Add a test to `tests/multi-school.test.mjs` for every new data path.
2. **The platform owner never sees student records** (names, scores, submissions, photos, reports). Counts and health only.
3. **Low data.** Students may have almost no data: no new heavy libraries on student screens, no polling, no WebSockets. Telemetry is batched, tiny and optional (plan 17.4).
4. **Children's data.** No keystroke capture, no location, no device identifiers, no public report links, no parent accounts (staff download reports).
5. **Single-school behaviour must not change** when only one school exists (no school-code field, same look). Existing installs upgrade in place.
6. English only. Accessible: keyboard operable, visible focus, 44 px touch targets, WCAG AA contrast.
7. Do not rewrite working code to restyle it. Extend. Keep the plain-JS style of the file you are in.
8. Never commit secrets, real student data or `test-results/`.

## 5. How to work
- Install and build: `npm install`, `npm run build`. Tests: `npm test` (109 pass at the end of step 1). Browser checks need Playwright and Chromium; see the environment variables used in `scripts/*.mjs` (`PLAYWRIGHT_MODULE`, `AUDIT_BROWSER_PATH`) and run at least `npm run verify-studio-v2`, `verify-assignments`, `verify-questions`, `verify-studio-small` for anything touching those screens.
- Bump the cache name in `public/sw.js` (`olawale-shell-vNN`) whenever any file in `public/` changes.
- Write the test first for each rule you add; keep the whole suite green before every commit.
- Small commits with clear messages; one pull request per step with a summary, how it was tested, and anything not done.
- Update `docs/V3_AUDIT_AND_PLAN.md` (the step's status and limits) and this prompt when a step is finished.

## 6. Work to do, in this order
### Step 2: school identity and platform owner (5 days; plan section 16.6)
- Per-school settings stored in each school's database: name, short name, motto, crest, building photo, accent colour (contrast-checked), report header lines (address, phone, principal). Crest and photo are converted to small images, stored in that school's folder, and served from a cacheable, school-scoped public route because they show before sign-in.
- Remove every hard-coded "Grace-Field" (`public/app.js`, `index.html`, manifest, service worker pre-cache list, print styles). New schools start with neutral branding (initials badge).
- After the school code is typed on the sign-in page, fetch `/api/config?school=<code>` and show that school's name, crest and colour; remember the code on the device.
- Platform owner: role `OWNER` in a separate `platform.sqlite` (never in a school database); separate sign-in at `/platform`, forced password change, rate limited. Screen: list schools (name, code, status, counts, last activity, storage), create school (shows a temporary password once, or sends an invitation link), suspend and reopen, reset a school admin's password, delete with typed confirmation and a backup first. Creating a school runs inside the server (no restart). Support access ("enter as admin") is explicit, needs the school's consent, and is written to that school's audit log.
- Tests: branding never leaks between schools; invalid colours and non-image or oversized logos are rejected; a school admin cannot reach `/platform`; suspended schools cannot sign in and existing sessions stop; the owner API never returns student data.
- Done when: the owner creates two schools from the screen and each shows its own branding on sign-in and inside the app, and the isolation tests still pass.

### Step 3: hosting (plan section 11)
Long-running host (not Vercel Functions: the filesystem is read-only), managed Postgres with a schema per school (written in step 1 but **never run against a live Postgres**: test it first), S3-compatible storage with the per-school prefix, HTTPS, health check, per-school backup and restore (restoring one school must not touch another), per-school limits (storage, students). Staging with two real schools.

### Step 4: shared curriculum library (plan 16.4)
Platform-level lesson and question templates (SS1 Mathematics Week 1 to 13 first). A school copies and edits its own copy; edits never change the library or other schools. Include the Lesson Studio import path (plan section 14) so teachers can also bring their own lectures.

### Then, in this order (each its own branch and pull request)
1. **V3.0 quick wins** (data weight: image conversion, compression, ETag, cache headers, icons, remove crest from pre-cache).
2. **V3.2m Support monitor** (section 12): evidence per topic, four support bands, class board, student profile, support plans, extension and reminder actions, active-time presence.
3. **V3.2r Parent report** (section 13): school header from settings, per-subject analysis, strengths, weaknesses, editable comments, print and PDF, class bulk run, audit entry. Admin and form teacher see all subjects; subject teachers see their own.
4. **V3.2i Lesson import** (Word first, then text, spreadsheets, slides, PDF text) with a review screen.
5. **V3.2a Audio and written answers** (audio blocks, essay answers, rubric marking).
6. **V3.3e Learning events** (section 17), **V3.3 offline and data saver**, **V3.4 architecture**, **V3.5 data layer** (incremental saves, indexes, load test), **V3.6 accessibility pass**.
Also fix the Studio's save-conflict message (keep the teacher's unsaved edits, say what changed, offer reload or compare).

## 7. When you are unsure
Prefer the plan and the owner's decisions in section 10. If something would weaken isolation, expose student data, or add data cost for students, stop and ask the owner instead of guessing. Report clearly what you did not do or could not test.
