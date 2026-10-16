# CODEX AGENT PROMPT: Nigerian Secondary School Learning Platform (Phase 1: SS1 Mathematics, First Term)

## 0. ROLE AND WORKING RULES

You are a senior full-stack engineer and instructional designer. Build a production-quality, mobile-first student learning platform for a Nigerian secondary school (JSS1 to SS3, three terms per session). Work in small, verifiable milestones. After each milestone: run the app, run tests, fix errors, then continue.

Rules:
1. Do not ask clarifying questions. Where this spec is silent, choose the simplest sensible option and record it in `DECISIONS.md`.
2. Every maths answer, worked example and practice question MUST be verified programmatically (a Python or TypeScript script in `/scripts/verify-math`). Never ship an unverified answer.
3. Mobile first. Design at 360px width first, then scale up. Many students use low-end Android phones on slow data, so keep pages light.
4. Simple navigation. A student must reach any feature in at most 2 taps from the home screen.
5. Write a `README.md` with setup, env vars, seed instructions, and a demo login for each role.

---

## 1. TECH STACK (use unless there is a strong reason not to)

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Auth: NextAuth (credentials: username/email + password, hashed with bcrypt/argon2), role-based middleware
- File storage: S3-compatible (Supabase Storage / Cloudflare R2 / local disk fallback in dev). All uploads go through signed URLs, and access is enforced server-side.
- PWA (installable, cached shell, offline fallback page), because connectivity is unreliable
- Math rendering: KaTeX
- Charts/graphs: a lightweight library (e.g. Recharts) for progress, and an interactive function plotter (custom canvas/SVG or function-plot) for quadratic graphs
- Validation: Zod. Tests: Vitest + Playwright (smoke tests per role)

---

## 2. ROLES AND ACCESS RULES

| Role | Capabilities |
|---|---|
| **Admin** | Full backend. Validate/approve/reject student registrations. Add and remove students. Create classes, subjects, terms. Assign teachers to subject+class. Unlock/lock weeks, terms and sections. Paste live-class links. View everything. |
| **Teacher** | Only sees classes and subjects assigned by Admin. Unlock weekly content for assigned subject/class, push assignments, view and mark submissions, grade notes, answer questions, add recordings, paste live links, enter test/exam scores. |
| **Student** | Only after Admin approval. Sees only their own class, content, scores and submissions. |

Hard rules (enforce on the server, not just the UI):
- A student account is created as `PENDING`. A `PENDING` or `REJECTED` student CANNOT sign in or see any data. Show a clear message: "Your account is awaiting admin approval."
- **Assignment submissions and note submissions are visible ONLY to the student who submitted and the teacher(s) of that subject/class (plus Admin).** Other students must never be able to fetch them, including by guessing URLs.
- Questions and answers on a lesson ARE visible to all approved students in that class plus the teachers.
- Removing a student sets status `REMOVED` (soft delete, keep history, block login).

---

## 3. ACADEMIC STRUCTURE (data model guidance)

Hierarchy: `Session (e.g. 2026/2027) -> Term (1st, 2nd, 3rd) -> Class (JSS1..JSS3, SS1..SS3) -> Subject -> Week -> Lesson (daily topic)`.

Key models (Prisma, add indexes and relations yourself):
- `User` (role, status: PENDING/ACTIVE/REJECTED/REMOVED), `StudentProfile` (class, admission number, guardian phone), `TeacherProfile`
- `Session`, `Term`, `Class`, `Subject`
- `TeacherAssignment` (teacher, subject, class, term/session)
- `Enrollment` (student, class, session)
- `Week` (subject, class, term, weekNumber, title, `isUnlocked`, `unlockedAt`, `unlockedBy`)
- `Lesson` (week, title, order, `contentJson` (see section 5), estimated minutes)
- `TermAccess` (class/subject/term lock flag): previous terms are readable by default; Admin can lock any term or section
- `LiveSession` (subject, class, term, title, link, scheduledAt, active flag)
- `Recording` (lesson/day, subject, class, video URL or uploaded file, date)
- `Assignment` (created by teacher, subject, class, term, due date, instructions, optional attachment)
- `AssignmentSubmission` (assignment, student, image(s), status, score, teacherFeedback, markedAt)
- `NoteSubmission` (student, subject, date, type: DAILY/WEEKLY, image(s), status, score, teacherFeedback, markedAt)
- `LessonQuestion` (lesson, student, text, optional image, created) and `LessonAnswer` (question, author (student or teacher), text, isTeacherAnswer)
- `Reflection` (student, lesson, whatILearnt, unansweredQuestion, created; teacher can reply)
- `PracticeAttempt` (student, lesson, questionId, response, correct, timeSpent)
- `LessonProgress` (student, lesson, started, completed, practiceScore, reflectionDone)
- `TestScore`, `ExamScore` (student, subject, term, score, maxScore, teacher, remark)
- `AuditLog` for admin actions

Term rules:
- Every list in the app (content, questions, assignments, notes, scores, recordings, live links) is filtered by the selected term. The student has a **Term switcher** (1st / 2nd / 3rd) defaulting to the current term. Past terms stay accessible unless Admin locks them. Future terms show "Not yet open".

---

## 4. FEATURES AND SCREENS

### 4.1 Student portal (bottom tab bar on mobile: Home, Learn, Assignments, Notes, More)
1. **Sign up / Sign in.** Register (name, class, admission no., guardian phone, password) -> status PENDING. Sign in only if ACTIVE. Personalised dashboard: "Good morning, <FirstName>", class and term badge.
2. **Home dashboard.** Today's lesson card, next live class (Join button), pending assignments with due dates, notes due today, progress ring, latest teacher feedback.
3. **Learn (Contents).** Subject list for the student's class, then weekly list. Weeks show Unlocked or Locked (padlock, not clickable). Inside a week: daily lessons. Locked weeks are blocked server-side too.
4. **Lesson page.** Rendered from `contentJson` (section 5). Includes a reflection section at the end.
5. **Questions and Feedback (per lesson).** Student posts a question (text, or snap/upload a photo of a question). All classmates and teachers see the thread; anyone approved in the class can reply; teacher replies are highlighted.
6. **Assignments.** List pushed by teachers for the student's subjects. Open one to read instructions, then **snap or upload** a photo of the work (camera or gallery, multiple pages allowed), submit, and later view the teacher's score and written feedback. Resubmission allowed only if the teacher enables it.
7. **Notes submission.** Per subject, per day and per week: student snaps and uploads their note. Show a calendar/streak view of submitted vs missed days. Teacher marks it (score + feedback), and the student sees the result.
8. **Scores.** Test scores section and Exam scores section, per subject and per term, with a simple bar/line chart and class-position optional (Admin setting).
9. **Progress monitoring.** Per subject: lessons completed, practice accuracy, assignments submitted and marked, notes submitted, reflections done, weekly trend chart.
10. **Live class.** For each subject a "Live" card showing the link the teacher or Admin pasted. Large "Join live class" button opening the link in a new tab.
11. **Class recordings.** Per subject, list of recordings by date ("Topic for the day"), embedded video player (YouTube/Drive/Vimeo links or uploaded file), with the term filter.

### 4.2 Admin and Teacher backend (responsive too)
1. **Student validation queue.** Pending list with Approve / Reject (with reason). Bulk approve. Add student manually, bulk import via CSV, remove student, move student between classes.
2. **Classes and subjects.** Create classes JSS1 to SS3, subjects, terms and sessions.
3. **Teacher assignment.** Assign teachers to subject+class. Teachers only see what they are assigned.
4. **Weekly content control.** Grid of weeks by subject/class with Unlock/Lock toggle. Optional "auto-unlock on date". Term-level and section-level lock toggles.
5. **Assignments.** Teacher creates and pushes an assignment (title, instructions, due date, class, subject, optional image/PDF). View submissions, open photo viewer (zoom/rotate), enter score and feedback, mark as reviewed.
6. **Notes review.** Queue of student notes by date; mark done/needs-redo, score, feedback. Show who has NOT submitted.
7. **Q&A inbox.** All lesson questions for the teacher's subjects with unanswered filter. Reply inline.
8. **Reflections inbox.** See each student's "what I learnt" and "unanswered question", with reply.
9. **Scores entry.** Enter or CSV-import test and exam scores.
10. **Live links and recordings.** Paste/update the live-class link per subject/class/term, and add recordings.
11. **Reports.** Class progress overview, students at risk (low completion, missing notes/assignments), export CSV.

### 4.3 Camera and uploads (important)
- Use `<input type="file" accept="image/*" capture="environment">` as the baseline (works on all phones), plus an in-app camera preview via `getUserMedia` where supported, with capture, retake, multi-page add, rotate.
- **Compress images client-side** (target <= ~400 KB, max 1600px longest side) before upload. Show upload progress and retry on failure. Queue uploads if offline and send when back online.
- Validate type and size server-side. Strip EXIF location data. Store private files in a private bucket and serve only via short-lived signed URLs after an authorization check.

### 4.4 Non-functional
- Large tap targets (>= 44px), readable fonts, high contrast, light and dark mode, simple language.
- Accessible (labels, alt text, keyboard focus).
- Loading skeletons, friendly error states, empty states.
- Rate-limit auth and uploads. CSRF/XSS protection. Never expose another student's data.

---

## 5. LESSON CONTENT ENGINE (core of the learning experience)

Each `Lesson.contentJson` is an ordered list of blocks. Build a renderer and an admin/teacher editor (JSON or form-based) for these block types:

1. `objectives`: "By the end of this lesson you will be able to..."
2. `explain`: short chunked explanation (KaTeX supported), with "Key idea" callouts
3. `example` (worked example): step-by-step reveal, with "Show next step"
4. `realLife`: real-life Nigerian context example (naira, markets, transport, phone data, farming, etc.)
5. `experiment`: "Try it yourself" interactive (sliders, calculators, graph plotters, drag-and-drop)
6. `video`: embedded video (URL field)
7. `learnMore`: collapsible extra reading and external links
8. `practice`: interactive questions with instant feedback, hints, and full worked solution after answering. Question types: multiple choice, numeric input, fill in the blank, true/false, ordering/matching, step-by-step. Track attempts and accuracy. Randomised numbers where it makes sense (question templates).
9. `checkpoint`: mini quiz mid-lesson
10. `summary`: recap bullets
11. `reflection`: required after the lesson (see below)

**Reflection section (end of every lesson):** two fields, "In 2 to 3 sentences, what did I learn today?" and "What question do I still have that is not yet answered?" plus a "Submit reflection" button. Marks `reflectionDone`. Lesson counts as complete only when practice threshold (e.g. >= 60%) and reflection are done.

Each lesson needs at least **12 practice questions** (mix: 4 easy, 5 medium, 3 WAEC/NECO-style), all auto-marked, with explanations. Each topic also gets a 10-question end-of-topic quiz.

---

## 6. SEED CONTENT: SS1 MATHEMATICS, FIRST TERM

Create Class `SS1`, Subject `Mathematics`, Session `2026/2027`, Term 1. Create one Week per topic below (Week 1 unlocked for demo, others locked), with 1 to 3 daily lessons per week. Follow the Nigerian SS1 syllabus (WAEC/NECO aligned). Use Nigerian contexts in real-life examples. Include all block types from section 5 in every lesson. The facts below are the required minimum; expand them into full lessons and VERIFY every number with the scripts.

### Week 1: Number Bases
- Concept: place value, base 10 vs other bases (2, 5, 8, etc.), digits allowed in each base (digits 0 to n-1), notation like `1101₂`.
- Conversion from any base to base 10 by expanded place values. Examples: `1101₂ = 8+4+0+1 = 13₁₀`; `234₅ = 2×25 + 3×5 + 4 = 69₁₀`.
- Conversion from base 10 to other bases by repeated division (remainders read bottom-up). Example: `25₁₀ = 11001₂`.
- Conversion between non-decimal bases via base 10.
- Arithmetic in bases: addition, subtraction, multiplication (and simple division), with carrying and borrowing in the given base. Example: `101₂ + 111₂ = 1100₂`.
- Real life: binary in phones/computers (on/off), counting in groups (dozens, crates).
- Experiment: interactive base converter with place-value columns; "flip bits" binary toggle that shows the decimal value.
- Practice: conversion both ways, arithmetic in bases 2, 5, 8; "find the base" (e.g. find n if `13ₙ = 8₁₀`: answer n=5), WAEC-style.

### Week 2: Laws of Indices (Exponents)
- Laws: `aᵐ×aⁿ=aᵐ⁺ⁿ`, `aᵐ÷aⁿ=aᵐ⁻ⁿ`, `(aᵐ)ⁿ=aᵐⁿ`, `a⁰=1`, `a⁻ⁿ=1/aⁿ`, `a^(1/n)=ⁿ√a`, `a^(m/n)=(ⁿ√a)ᵐ`, `(ab)ⁿ=aⁿbⁿ`.
- Examples: `2³×2⁴=2⁷=128`; `27^(2/3)=9`; `8^(-1/3)=1/2`; solving `2^(x+1)=32` gives x=4.
- Real life: population/phone-data growth, powers of 10 in standard form, compound growth.
- Experiment: "index law explorer" where students change base and powers and watch both sides match.
- Practice: simplification, evaluation, fractional and negative indices, solving index equations.

### Week 3: Logarithms Using Tables
- Definition link: `log₁₀ N = x` means `10ˣ = N`. Standard form; **characteristic** and **mantissa**. Reading the four-figure logarithm table with the "difference" (mean difference) columns, and antilogarithm tables.
- Examples: `log 4560 = 3.6590` (characteristic 3, mantissa .6590); `log 0.0456 = 2̄.6590` (bar notation, meaning -2 + 0.6590).
- Antilog: reverse process; place the decimal point using the characteristic.
- Build an **interactive log-table and antilog-table widget** (four-figure tables) students can use with a guided "find row, find column, add difference" walkthrough. Generate the tables programmatically to 4 d.p. and verify.
- Practice: finding logs and antilogs of numbers greater than and less than 1.

### Week 4: Logarithms Using Tables, Powers and Roots
- Rules: `log(ab)=log a+log b`, `log(a/b)=log a−log b`, `log aⁿ = n·log a`, `log ⁿ√a = (1/n)·log a`.
- Example: `√45.6`: log 45.6 = 1.6590, halve it = 0.8295, antilog gives about 6.753.
- Handling bar numbers when dividing (e.g. halving 2̄.xxxx correctly: add −2 adjustments so characteristic is even).
- Practice: squares, cubes, square roots, cube roots, fractional powers, decimals less than 1.

### Week 5: Applications of Logarithms
- Computation with logs: products, quotients, combined expressions. Example: `23.5 × 4.62`: log sum 1.3711 + 0.6646 = 2.0357, antilog about 108.6 (exact 108.57).
- Real-life uses: compound interest `A = P(1+r/100)ⁿ` (naira savings), exponential growth/decay, volume/area calculations with awkward numbers, pH/decibel idea (brief learn-more).
- Practice: multi-step calculations; students must show the log table steps (a step-by-step answer type with each line checked).

### Week 6: Simple Equations and Variation
- Linear equations in one unknown (including fractions, brackets), word problems (age, money, distance/speed).
- Variation: direct (`y=kx`), inverse (`y=k/x`), joint (`y=kxz`), partial (`y=a+bx`-type). Steps: write relation, find k, rewrite, substitute.
- Example: "y varies directly as x; y=12 when x=3, find y when x=7": k=4, y=28.
- Real life: cost vs quantity of garri/fuel, workers vs days (inverse), speed vs time.
- Experiment: sliders showing a direct and an inverse variation graph updating live as k changes.

### Week 7: Change of Subject of Formula
- Making a variable the subject: inverse operations, expanding brackets, collecting terms, roots and squares, fractions. Substitution after changing subject.
- Examples: `v = u + at` gives `t = (v − u)/a`; `A = πr²` gives `r = √(A/π)`; `S = ½(a+l)n` gives `l = 2S/n − a`.
- Real life: converting `F = 9C/5 + 32` to find C; simple interest `I = PRT/100` to find R.
- Practice: ordered-steps question type (drag steps into the right order) and typed-answer with algebraic equivalence checking (use a CAS like mathjs/nerdamer to accept equivalent forms).

### Week 8: Quadratic Equations and Graph Construction
- Solving by factorisation, completing the square, and the formula `x = (−b ± √(b²−4ac)) / 2a`. Discriminant (nature of roots). Forming a quadratic from given roots.
- Graph of `y = ax² + bx + c`: table of values, scale choice, plotting, smooth curve, axis of symmetry, turning point, roots from the graph, reading values.
- Worked example: `y = x² − 2x − 3` for x = −2 to 4 gives y: 5, 0, −3, −4, −3, 0, 5. Roots x=−1 and x=3, turning point (1, −4), axis x=1.
- Experiment: **interactive graph plotter** with sliders for a, b, c showing the parabola, roots, vertex and discriminant live; and a "plot the points yourself" graph-paper mode where the student taps the grid to plot points from their own table and the app checks them.
- Practice: solving, forming equations, completing tables, reading graphs (graph-based multiple-choice questions).

Also seed: sample students (2 ACTIVE, 1 PENDING), 1 teacher assigned to SS1 Mathematics, sample assignment, sample live link, sample recording, sample Q&A thread, sample test/exam scores. Seed other classes (JSS1 to SS3) as empty shells so the structure is ready.

---

## 7. MILESTONES (deliver in this order, commit at each)

1. Project scaffold, Prisma schema, migrations, seed script, auth and role middleware, approval flow.
2. Admin: class/subject/term setup, teacher assignment, student validation, add/remove/import.
3. Student shell: dashboard, term switcher, bottom navigation, PWA setup.
4. Week/lesson structure with unlock/lock enforced server-side, plus term/section locks.
5. Lesson renderer with all block types, practice engine, progress tracking, reflection.
6. Camera/upload pipeline (compression, signed URLs, private access) and the Assignments module.
7. Notes submission module (daily/weekly, marking, feedback, streak view).
8. Q&A threads with image upload, and teacher inbox.
9. Scores (test/exam), progress monitoring charts, live-class links, recordings.
10. SS1 Mathematics Term 1 content (all 8 weeks) with verified answers and interactive widgets (base converter, log tables, variation sliders, quadratic plotter).
11. Reports, polish, accessibility pass, automated tests, README and `DECISIONS.md`.

---

## 8. ACCEPTANCE CHECKLIST (verify before finishing)

- [ ] A newly registered student cannot sign in until Admin approves.
- [ ] A student cannot open a locked week, even by direct URL or API call.
- [ ] Student A cannot view Student B's assignment or note images (test it).
- [ ] A teacher cannot see classes/subjects they are not assigned to.
- [ ] Camera capture works on a phone browser; images compress and upload; failed uploads retry.
- [ ] Term switcher separates all content and conversations; admin lock on a past term blocks access.
- [ ] Every lesson has all required block types, >= 12 practice questions and a working reflection form.
- [ ] All maths answers pass the verification scripts (report the pass count).
- [ ] The app is usable and readable at 360px width with no horizontal scrolling.
- [ ] Lighthouse mobile performance >= 80 on the lesson page, and the PWA is installable.
- [ ] README with demo accounts for Admin, Teacher, Student.

When finished, output: a summary of what was built, how to run it, known limitations, and suggested Phase 2 (other SS1 subjects, JSS/SS2/SS3 content, SMS/WhatsApp notifications, parent view).
