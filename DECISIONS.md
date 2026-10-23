# Architecture decisions for the expanded brief

## Phase 2 implementation decisions — 23 October 2026

- Phase 2 completes the documented studio gate; Phase 3 remains unstarted. The supported block list and remaining media/graph/assessment scope are explicit in [the report](docs/PHASE_2_REPORT.md).
- Keep the vanilla frontend. Locally bundle TipTap for structured rich text, MathLive for visual input and KaTeX 0.18.2 for display/server parsing. Pin audited dependencies, copy package notices and lazy-load authoring code; no paid editor service or runtime CDN.
- Store a bounded allowed JSON subset, not arbitrary teacher HTML. Reject unsafe nodes/links/math commands and independently parse equations on the server. Share student and preview rendering.
- Reuse existing JSON storage, opaque draft/published revisions and single-process request serialisation. Queue autosaves, retain newer local edit generations and stop on conflicts. Offline unsaved edits stay in memory with warnings, avoiding private browser-storage drafts on shared devices.
- Restore historical publications as new drafts; retain current publications and attempts. Reusable block templates are private to the author and academic scope. No SQL migration, school-data backfill or grading-policy change.
- Final browser tests caught selection replacement on inline equation insertion; insert after selected text and verify text/format preservation across refresh. Earlier decisions below describe their dated phase.

## Phase 1 implementation decisions — 21 October 2026

- Phase 1 is complete; Phase 2 is next and not started. The one-phase-per-handoff instruction remains in force.
- Share one pure ES-module document contract between Node and browser. Import the shared renderer before the final weekly `boot()`; keep the vanilla frontend and existing assets.
- Store optional version-1 documents in existing lesson JSON; do not backfill legacy lessons on startup/read. Keep legacy source fields and full publication snapshots; verify originals before any future destructive migration.
- Use separate optimistic draft revisions and canonical published fingerprints. Full-course publication also requires an explicit revision and archives replaced weeks. Old open editors fail with a conflict rather than overwriting newer data; reload them after update.
- Preserve question metadata/stage and hidden legacy lesson quizzes in the weekly form. Hash revisions independently of SQL-reconstructed question order; document block order remains significant.
- Render only validated declared blocks and escaped text. Student projection excludes unknown metadata/snapshots and assessment keys. Equation source stays textual until Phase 2 adds a separately evaluated safe rendering/input library.
- Structured content is protected from edits through stale legacy text fields. Loading published content can discard blocks that exist only in an abandoned draft. Autosave and restore-as-new-draft UI belong to Phase 2.

See [current report](docs/PHASE_1_REPORT.md). Earlier decisions follow as history.

## Modernisation phase decisions — 21 October 2026

- Complete one master-brief phase per handoff, per the user's clarification. Phase 0 is complete; Phase 1 is next and has not started. Report current stage, real checks, limitations and next stage on every handoff.
- Use the actual source/tests as the baseline. Keep historical notes, but link the current audit and evidence so obsolete lesson counts are not mistaken for current behaviour.
- Preserve the existing lightweight frontend, backend, school assets and academic/assessment records. Phase 0 changes only audit tooling/documentation and ignores private snapshots.
- Plan an additive versioned document in existing lesson JSON for Phase 1, with lossless legacy fields and explicit conversion snapshots; avoid destructive eager migration. This is a design proposal to validate during Phase 1, not a completed schema change.
- Reuse the final weekly lesson renderer path and existing release/authorisation checks. Shared student/preview rendering and complete server validation are required before a visual studio is considered complete.
- Do not select or install editor, equation or graph dependencies in the audit phase. Check current official compatibility, accessibility, security and licensing at the relevant implementation phase.
- Private snapshot records/media remain outside Git; the real baseline backup was restored into a new ignored test directory and compared without printing private records.

See [audit](docs/CURRENT_SYSTEM_AUDIT.md), [plan](docs/IMPLEMENTATION_PLAN.md) and [risk register](docs/RISK_REGISTER.md). Older decisions follow.

These supersede the first local-edition decisions.

1. Preserve the existing working client and HTTP backend rather than replacing the product with a framework scaffold. The codebase remains lightweight HTML/CSS/JavaScript plus Node; new domain logic is strict TypeScript. A full React/Next.js migration is not represented as complete.
2. Replace JSON primary persistence with relational SQLite and a parameterised PostgreSQL adapter. Schema migrations cover school/session/class/subject/enrolment/course/lesson/question ownership, marks, submissions, versions, releases, notifications, recovery and audit records. Rich teaching blocks and immutable snapshots use JSON columns. The original database.json is a one-time migration input, not the active database.
3. Keep a compatibility domain cache and serialise API requests for one server process. This is a deliberate MVP concurrency boundary; do not launch replicas or claim that configuring PostgreSQL alone provides clustering.
4. Derive the initial school year from September or INITIAL_SESSION. Sessions and historical enrolments are explicit records. Student class scope comes from the selected session’s enrolment, not merely the user’s current class property.
5. Store session IDs hashed in the database, keep CSRF checks, and recheck account status on every request. Suspension/recovery revokes existing sessions. Recovery tokens are hashed, expire and are single-use; delivery is manual until a real email provider is integrated.
6. Sandbox entry is a development-only server route. Production requires a fresh non-demo database, administrator bootstrap credentials and a secret; it rejects development databases and has no client-side demo password. Administrator-created students now remain pending until approval.
7. Daily release rules override a week’s default. Scheduled release uses UTC comparisons on access, without pretending to run a background publishing/notification service.
8. Keep practice, diagnostic checks, quizzes and topic mastery distinct. Mastery comes from submitted assessments, not page views. Practice coverage and a submitted reflection determine lesson completion. Attempts preserve scores and active-time estimates; these estimates are not invigilation or reliable evidence of attention.
9. Expand the seeded bank to 60 items per subtopic and 20 mastery items per topic. The supplied eight-topic outline is the curriculum source. Full-prompt uniqueness is tested within subtopics; parameter variations remain part of practice. Seeded answers are audited; teacher-authored questions need review. Formula equivalence is bounded numerical checking, not a complete symbolic theorem.
10. Keep private local storage available, and implement an S3-compatible provider through environment configuration. Proxy authorised media with expiring signed access and range requests. Provider deployment and phone camera behaviour remain unverified external gates.
11. Mark notes independently, defaulting to 10, and include them in weighted totals only when explicitly configured with a positive policy weight. Required unpublished/missing components leave the weighted total incomplete. Preserve submission and marking versions rather than overwriting history.
12. Archive users and preserve academic records. Backups exclude authentication sessions and recovery tokens. A retention policy, encrypted offsite backups, malware scanning and operational safeguarding require a school-approved deployment process.
13. Keep the actual school logo and building asset. Use the new brief’s institution name, Grace-Field College, Ibadan, and its motto in product text.

14. Use the requested blue, crimson and white palette for all application themes; retain the user’s General.png crest as the school logo (the later College_2 image informed colours only). Keep neutral light/navy dark surfaces and separate contrast-safe link and button colours. The signed-in crest location becomes a profile control; the actual school crest stays on authentication screens.
15. Require an administrator-uploaded initial photo on individual student registration. CSV/self-registration creates pending accounts that cannot be activated until an admin adds the initial photo. Existing active accounts retain access; those without a photo show initials and ask the admin for their initial photo. Photos belong to accounts across sessions, are private to their owner and admins, and reuse the local/S3 storage provider. The profilePhotos metadata collection persists in app_settings; user profiles hold the current photo ID.

16. Delegate student registration and account management with two explicit admin-owned teacher privileges, both disabled by default. Every mutation rechecks the current grant and session-specific class allocations. Registration does not imply approval permission; teachers cannot create staff, self-grant permissions, access another class, or move students to an unassigned class. Registration by teachers is limited to the current session.
17. Add a server-filtered and paginated registered-student directory (10/20/50 per page) shared by admins and assigned teachers. Search covers names, emails and admission numbers. Mobile rows become cards. Preserve existing complete report data while bounding directory rendering; retain account access and recovery in the directory to avoid duplicate long student lists.

18. Replace unbounded admin teacher/allocation lists and duplicate recovery rows with a shared directory containing separate Teachers, Subjects and Teaching assignments tabs. Filter and paginate on the server (10/20/50 entries); keep per-tab client filters, cap assignment summaries and re-use existing secure mutation endpoints. Assignments and subject teacher counts follow the selected academic session.

19. Add account-level student last-seen timestamps in student_presence, separate from academic records. Record successful student login and throttled authenticated foreground activity, never staff polling. Preserve timestamps through backups/restores; keep class/subject/session authorisation on the monitoring endpoint.
20. Define a work unit as one released lesson marked read, one released non-quiz exercise attempted, one submitted lesson quiz, one submitted topic mastery test, one reflection or one week-linked assignment submission. Count each once; separate accuracy and note submissions. Weekly denominators use published lesson tasks and explicitly week-linked assignments. Unlinked assignments do not enter progress until linked. Default to the latest released week, support arbitrary week comparison and all-released-week totals, and preserve release history when weeks are relocked and display active-account progress with searchable pagination.

### Weekly student progress and notes
- Share the released-week calculation between staff monitoring and a private my-progress endpoint, which always derives the student from the authenticated session and honours term/session access.
- Require an open learning week on every new note submission. Preserve date/frequency and correction history, distinguish identical dates across weeks, and allow owners to link unlinked historical notes to a previously released week without guessing from calendar dates.
- Display notebook counts separately from percentage completion; there is no configured notebook requirement to use as a denominator.
- Place a compact progress indicator with each week’s lessons and provide detailed activity breakdowns and week comparisons from the learning path.

### Optional classroom notebook checking
Per user request, notebook submissions are excluded entirely from student and staff progress displays and monitoring API responses, including home progress and weekly lesson indicators. Weekly work percentages continue to use reading, exercises, quizzes, topic tests, reflections and assignments only. My notes / Notes & review remains available as a separate optional workflow, with existing uploads and feedback preserved.

### Phase 3: blank authoring and local interactive mathematics

- Provide an explicit blank private template with one empty subtopic and no questions. Keep publication validation, current publication, weekly assignments and historical records intact; allow Undo and custom question deletion. New subtopics also start empty.
- Reuse existing scoped document/draft/history/template storage. Share strict mathematics definitions between server and browser; never execute mathematical input as JavaScript.
- Use small local SVG for bounded educational graphs/geometry; avoid a new external graph dependency. Store editable expressions and settings, and document sampling/feature-recognition limits. Re-evaluate established graph/geometry libraries for advanced constructions.
- Keep graph-construction feedback local and informal. Calculator permissions and official graph-question grading belong to later assessment authoring.

### Weekly teaching structure and authoring
- Render subtopics rather than fixed days. Practice follows each subtopic; one quiz and reflection close the weekly topic. Keep legacy assessment/reflection endpoints for older clients, but the current interface uses week-scoped activities. Historical mastery submissions count as the weekly quiz; historical reflections are capped at one per week.
- Teacher templates are private drafts until published. Publishing replaces only the selected week and stores the previous version, while retaining stable IDs and historical student records. Editing the published revision is checked to prevent overwriting a concurrent publish.
- Support 1–30 subtopics and 1–100 teacher-authored practice/quiz questions, avoiding artificial fixed-length question banks. Teachers provide answers and feedback; shipped mathematics remains independently verified.
- Assignment releases are separate from content releases: draft, locked, published or scheduled, with a work date and explicit WAT deadline. Student submission endpoints enforce release status.
- YouTube links are validated and converted to a privacy-enhanced embedded player; teacher HTML is escaped.
