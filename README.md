# Olawale’s Lab — Grace-Field College, Ibadan

A working student-centred LMS with administrator approval, subject teachers, private work submission, interactive learning and assessment-based mastery. School motto: Raising young minds for future impact.

## First sign-in (clean install)

A fresh install contains no students, teachers, lessons or sample data, only one administrator.

1. Run `npm start`. The first start prints the administrator email and a temporary password in the terminal and also saves them to `data/FIRST-LOGIN.txt`.
2. Open http://127.0.0.1:3000 and sign in with those details (default email `admin@school.local`; set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first start to choose your own).
3. The portal immediately asks for a new password (at least 12 characters). Nothing else works until it is changed, and the temporary password stops working.
4. From **School management → Add student / teacher** the administrator creates teachers and students, then assigns subjects to teachers.

For development with sample accounts and the sample SS1 Mathematics course, set `DEMO_PASSWORD` or `SEED_SAMPLE_DATA=true` before the first start.

## Run

Requires Node.js 22.11 or newer.

~~~powershell
npm ci
Copy-Item .env.example .env
npm run build
npm start
~~~

Open http://127.0.0.1:3000. The sign-in page shows no development sandbox unless you set DEMO_MODE=true in .env on a private machine (then, with a fresh DATA_DIR, set DEMO_PASSWORD and sign in as admin@olawaleslab.school). Production is a separate bootstrap with no demonstration users. See [installation and deployment](DEPLOYMENT.md).

## Real school use

See **Quick start for a real school** in [DEPLOYMENT.md](DEPLOYMENT.md): `npm run setup:production -- --email you@school.example`, then `npm run build` and `npm run start:production`.

## This upgrade

Current stage: **Lesson Studio v2 (clean platform)**. Teachers write weeks, lessons, questions and assignments in one Lesson Studio, release per lesson or per week, and release assignments after teaching. See the [Lesson Studio guide](docs/LESSON_STUDIO_GUIDE.md) and the [implementation plan](docs/NEXT_STEPS_PLAN.md). After updating, run `npm run build`, restart the server and refresh. Local editor/math assets are generated under `public/vendor/`; no runtime CDN is needed.

- Replaces JSON persistence with a real relational database and versioned migrations. SQLite runs locally; PostgreSQL is configurable for deployment. Existing local records are imported once and the original JSON file is retained.
- Academic sessions, enrolment/promotion history, term archives and daily lesson publication/release rules.
- Durable authentication, suspension, pending administrator-created students and single-use account recovery.
- Forty SS1 Mathematics lessons (five per topic), 60 stage-specific questions per lesson, 20-question topic mastery assessments sampling all five lessons, independent attempt records and configurable mastery bands. The bank has 2,560 assessment items.
- Private assignments/notes, note rubrics and configurable marks, resubmission and marking history, in-app feedback notifications.
- Discussion moderation, reflection drafts/confidence/difficulties, announcements, unpublished results and audited corrections, CSV marks and policy-weighted summaries.
- Contextual calculator, base/graph/formula tools, genuine log and antilog tables, private document/video storage adapters and backup/restore scripts.

The existing lightweight UI and Node HTTP backend are retained. New calculation/result domain modules use strict TypeScript. This is a phased MVP rather than a React/Next.js rewrite; see [implementation status](IMPLEMENTATION_STATUS.md) for explicit incomplete and unverified requirements.

## Verify

~~~powershell
npm test
npm run verify-math
~~~

Tests build the domain code and use isolated fictional databases. The maths commands audit both the original preserved bank and the expanded curriculum. Test results are recorded in [VERIFICATION.md](VERIFICATION.md).

## Documentation

- [Deployment, configuration, bootstrap, backup and restore](DEPLOYMENT.md)
- [Administrator, teacher and student guide](USER_GUIDE.md)
- [Lesson Studio guide](docs/LESSON_STUDIO_GUIDE.md)
- [Completed / partial / unverified requirements](IMPLEMENTATION_STATUS.md)
- [Development progress and quality gates](DEVELOPMENT_PROGRESS.md)
- [Architecture decisions](DECISIONS.md)

## Operational limits

Run one application process per database. Live PostgreSQL/S3 services, hosted HTTPS and physical-phone camera behaviour have not been certified here. Production credentials and storage policy must be configured and verified before real student onboarding. The application does not send email invitations, provide native conferencing or implement every advanced assessment/question type in the master brief. The original supplied HTML/PDF remain preserved project resources rather than publicly served unprotected courses.
