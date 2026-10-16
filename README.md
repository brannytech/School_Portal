# Olawale’s Lab

A working local learning platform for Grace-Field Private School. The supplied school-building photo appears on sign-in and registration, and the crest appears in the workspace navigation.

## Run

Requires Node.js 22 or newer. No dependency installation or database service is needed for this local edition.

```powershell
npm start
```

Open **http://127.0.0.1:3000**. Alternatively, run `node server.mjs`. `npm run dev` enables Node’s file watcher where subprocess permissions allow it.

Accounts are seeded automatically on first start. `npm run seed` preserves existing records. Data is saved in `data/database.json`; private photos are in `data/uploads/`. Keep that directory private and back it up together with the database. Restarting the server signs users out but retains school records.

## Demo accounts

All demo passwords: **Learn@2026!**

| Role | Email |
| --- | --- |
| Administrator | admin@olawaleslab.school |
| Mathematics teacher | teacher@olawaleslab.school |
| Approved SS1 student | student@olawaleslab.school |
| Second approved student | chisom@olawaleslab.school |
| Pending student, sign-in blocked | pending@olawaleslab.school |

The demo selectors fill the sign-in form. Names, scores, assignments and accounts are illustrative records.

## What works

- Student registration creates a pending account. Administrators approve, reject with a reason, add, move, soft-remove and restore accounts; bulk approval and student CSV import/export are included.
- Students receive their own dashboard, scores, progress, assignments and notes. Staff access is checked on the server, against assigned class and subject. Administrators assign teachers, create subjects/classes, change the current term and lock terms or individual weeks.
- All six Nigerian secondary classes are present. Three terms are kept separate within the seeded 2026/2027 session. Previous terms stay readable unless locked; future terms open when the administrator advances the current term.
- SS1 Mathematics first term includes eight weeks and 24 daily lessons. Week 1 starts unlocked. Each lesson has objectives, explanations, a worked example, Nigerian real-life context, an experiment, a recording area, extra reading, a checkpoint, summary, 12 practice questions and a required reflection. Each week also has a ten-question topic quiz: **368 questions total**.
- Interactive widgets include binary switches, a base converter, index-law exploration, four-figure log lookup, antilog calculation, direct/inverse variation plots, formula substitution and a quadratic plot with roots, discriminant, vertex and value table.
- Practice is marked by the server. A lesson is completed only when at least 60% of its practice questions are correct and its reflection is submitted. The latest answer to each question determines current accuracy.
- Teacher weekly content editor: Teaching workspace → Edit / publish lesson content. JSON is validated for structure, minimum questions, unique lesson IDs and answer formats. Teachers can publish additional subject/class/term courses within their assigned scope. Keep IDs stable after students begin learning. For a new course, use the seeded SS1 course as a structural reference; replace its actual content and question IDs. Teacher-authored answers require review; only bundled seed answers are covered by the supplied maths audit.
- Assignments: teacher publishing, multiple-page camera/gallery submissions, explicit resubmission permission, marking out of 100 and individual feedback.
- Notes: daily/weekly camera/gallery submissions, seven-day submission indicators, teacher marking, redo requests, feedback and missing-submission lists. Teachers also publish their own lesson notes as text, image pages or document links.
- Class discussions accept text and question photos. Approved classmates can reply; teacher replies are highlighted. Reflections stay between the learner and authorised staff.
- Test/exam score entry, progress charts, class reports and CSV export. Subject-specific live links and recording links are supported. YouTube and Vimeo recording links embed; other HTTPS sources open in a new tab.
- Phone camera support uses the device-native file capture control, with separate gallery selection. Images are resized to a maximum 1600-pixel side and compressed toward 400 KB. The server validates format/size and strips JPEG/PNG metadata. Uploads use short-lived, single-use URLs. Image viewing requires a session, authorisation and an expiring signed link.
- Failed/offline photos are queued in IndexedDB on the device. Reconnect, sign into the original account, open a submission form and select **Recover queued photos**. Recover each photo, return to the matching form and choose **Attach recovered photo** before submitting. Submission itself is deliberately explicit. Delete queued photos on shared devices when no longer needed.
- Responsive navigation, visible keyboard focus, dark mode and an installable PWA shell. Only public app assets are cached; private student/API data is never service-worker cached. Offline learning records require reconnecting.

## Configuration

Set environment variables in the launching shell; `.env` is not automatically loaded.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listening port |
| `HOST` | `127.0.0.1` | Loopback by default; use `0.0.0.0` only for intentional network access |
| `DATA_DIR` | `data` | Private persistent database and uploads |
| `DEMO_PASSWORD` | `Learn@2026!` | Seed password, applied only when the database is first created |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |

On an actual phone, connect through a properly configured HTTPS host. Camera behaviour varies by browser; the native photo/file picker remains the baseline. PWA installation and modern camera APIs need a secure context (localhost is permitted for desktop development).

## Verification

```powershell
npm test
npm run verify-math
```

Integration tests use their own randomly named directory under `test-results/`, with an isolated server and seeded accounts. They do not change the working demo’s database. Node’s test runner needs permission to start subprocesses on managed Windows systems.

The maths audit checks **392 question/worked-example instances** (368 assessments + 24 examples) using independent arithmetic methods, substitution and inverse operations, plus **900 four-figure log-table cells**. It covers the content in `content.mjs` and `enrichment.mjs`. The original user-supplied standalone HTML and PDF remain intact and are not represented as audited platform content.

## Scope and deployment limitations

This is a single-process local implementation, not a production school deployment. The project’s preferred Next.js/PostgreSQL/Prisma/NextAuth stack was replaced for this runnable, dependency-free edition; see `DECISIONS.md`. It uses server-side scrypt password hashing, expiring HttpOnly sessions, CSRF checks, input validation, rate limits and private local storage, but still needs production infrastructure and operational review before accepting real student records.

Sessions and upload tokens live in process memory; multiple server replicas are unsupported. There is one academic session; rolling into a new year requires a session-aware database migration. Content outside SS1 Mathematics first term must be authored by teachers. The original PDF has not been automatically converted. Matching/drag-order practice, symbolic algebra equivalence checking, manual point-plot grading, automatic unlock schedules, score CSV import, PDF/video-file uploads and in-app camera preview/rotation are not included. Image capture/gallery uploads and external recording/document links work.

Browser checks cover desktop and 360px mobile layout, student navigation, practice feedback, and staff workflows. Actual Android/iOS camera behaviour, installation, offline recovery across a real network loss, and a Lighthouse score are not certified by these local checks.

For deployment, migrate persistence to PostgreSQL with transactions/migrations and scoped object storage, use a durable session store, HTTPS and managed secrets, replace demo credentials, add password reset, configure backup/retention and monitoring, and test on the school’s actual phones and network. The private local runtime was not published to a static hosting service, which cannot run its Node server or retain its database.

## Suggested next phase

Other subjects and class curricula; multi-session promotion; teacher-friendly visual lesson authoring; richer question types and symbolic maths; parent access; SMS/WhatsApp notices; production hosting and database/storage integration.
