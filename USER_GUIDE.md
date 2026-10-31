# Using Olawale’s Lab

## Current stage — Interactive Mathematics and blank templates, 23 October 2026

Open **Teaching workspace → Edit in Lesson Studio**, select a week and choose **Start blank template**. Start with an empty subtopic and no content, practice or quiz questions. Add your own blocks and questions, preview, save and publish; Undo can reverse the blank replacement before closing. The current publication stays available until you publish the replacement. New subtopics also start empty. Existing publication requirements still apply.

Insert **Interactive graph** for editable functions, charts and coefficient sliders, or **Mathematics toolkit** for matrices, geometry and other explorations. Student changes and graph practice feedback are local; official marks are unchanged. Follow the [blank-template and mathematics guide](docs/INTERACTIVE_MATHEMATICS.md). Phase 3 passes its local gate; Phase 4 remains next. Earlier guide entries below are historical.

## Current stage — Teacher Content Studio, 23 October 2026

Phase 2 is complete within its [reported scope](docs/PHASE_2_REPORT.md). As an assigned teacher or administrator, choose the academic session/class/subject/term, then **Teaching workspace → Edit in Lesson Studio**. Create or select a week/subtopic, edit blocks and formatted text, add visual equations, preview, save a private draft and publish. History can restore a publication as a new draft. See the [Lesson Studio guide](docs/LESSON_STUDIO_GUIDE.md) and the [studio reference](docs/TEACHER_CONTENT_STUDIO.md) for controls, conflict recovery and memory-only offline editing.

Students read released content through the usual learning page, including typeset equations. The legacy weekly form remains available; its structured-text fields stay protected. Earlier dated guide entries below describe previous phases. **Next: Phase 3 — Interactive Mathematics, not started.**

## Lesson content update — 21 October 2026

Teachers: use **Teaching workspace → Open weekly lesson template**, or **My learning → Design this week**. Save a private draft, reopen it, then publish when ready. Keep lesson/question IDs stable. The editor preserves existing lesson metadata and hidden legacy quiz items.

If another window or teacher saves newer content, saving shows a conflict. Reopen the week and review the newer version before reapplying your changes. **Load published version** discards your unsaved screen edits and starts from the publication; private drafts remain separate until you save or publish. Reload older open browser tabs after this update so they use the new revision checks.

This historical Phase 1 entry introduced protected structured content in the legacy form. Phase 2 now supplies visual editing and typeset equations through Content Studio, as described above. Existing learning, assignment, quiz/reflection and progress workflows continue.

See [current scope and limitations](docs/KNOWN_LIMITATIONS.md). Earlier guide sections describe existing workflows; the current weekly editor is the primary teaching interface.

## Forgotten password and recovery tokens

1. On the sign-in page the person chooses **Forgot your password?** and enters their school email. The page always shows the same message, so it never reveals whether an email has an account.
2. Every active administrator gets a notification, and the request appears under **Admin → Password recovery requests**.
3. The administrator confirms the person's identity, then selects **Issue recovery token**. The token expires in 30 minutes, works once and signs the account out everywhere. Give it to the person privately (in person or the school's private channel, never a class group).
4. The person chooses **I have a recovery token** on the sign-in page, pastes the token and sets a new password of at least 14 characters, then signs in. A suspended or pending account stays suspended or pending.

An administrator can also issue a token directly for anyone under **Account access and recovery**.

## School administrator

1. Sign in with the initial administrator account configured on first production start. Development sandbox access is a separate local feature.
2. In School management, add teachers and students. New student accounts remain pending; review and approve them before access. Imports accept CSV, validate duplicates and show row errors. Do not send a CSV containing passwords through public channels.
3. Assign teachers to a class and subject in the selected academic session. Add subjects/classes as needed.
4. Use the session selector and term selector to keep academic work in the intended archive. Create a session, enrol/promote students into it, assign its teachers, publish its course material, then make it current. Historical enrolments remain intact.
5. School management also controls term locks, suspension/reactivation, recovery tokens and mastery/marking policy. Weights for tests, examinations and explicitly included note marks must total 100%. Results remain incomplete until the required components have published marks.

## Teacher

1. The teaching workspace shows only assigned class/subject combinations for the selected session. Choose the correct class, subject and term before publishing.
2. Publish lesson content using the validated advanced JSON editor. Preserve IDs for material students have started. Seeded questions are audited; teacher-authored questions need educational and mathematical review.
3. Unlock a week or set a daily release rule: Draft, Scheduled, Locked, Unlocked or Archived. A daily rule overrides the weekly default. Enter release times in Africa/Lagos; the server stores UTC and checks availability on each request.
4. Create assignments with instructions, deadline and maximum marks. Review private files; enter marks and feedback or return work for correction. Each resubmission and marking revision retains history. Students receive in-app notifications.
5. Review daily/weekly notes separately. Notes default to 10 marks, with optional completeness, accuracy, organisation, legibility and timeliness criteria. They do not contribute to official totals unless the administrator explicitly configures their weight.
6. Respond to questions and private submitted reflections. Resolve, pin or hide discussions; reports remain staff-visible. Announcements notify enrolled students.
7. Enter/import marks as drafts and publish results when reviewed. Corrections are audited. Add HTTPS recording/live links or private lesson-video uploads. Live meetings open in their external provider; the LMS is not a conferencing service.

## Student

1. Sign in after the school approves your account. Use Home, Learn, Work, Notes and More on phones.
2. Select a subject and academic term/session. Readable historical material is clearly separated from the current session. Locked or future lessons cannot be opened through direct links either.
3. In a lesson, read the objectives and worked steps, experiment with the tools, answer diagnostics and practise by difficulty. The calculator, tables and relevant graph/formula workspaces stay in the lesson.
4. Complete a 10-question subtopic quiz or 20-question topic mastery assessment. Submit the whole attempt to receive its score, corrections and mastery band. Practice feedback and quiz scores are separate. Lesson completion also requires the configured practice coverage and a submitted reflection.
5. In your reflection, describe what you learnt, explain a concept, say what was difficult, add a remaining question and choose confidence from 1 to 5. Save a draft or submit privately to your teacher.
6. Photograph or select assignment/note pages. Review, rotate, remove/retake or reorder pages before submitting. Documents are supported for assignments; note/question capture uses photographs. Your work is private to you and authorised staff.
7. If a photo upload fails, use Recover queued photos after reconnecting, then attach recovered pages in the matching form and submit explicitly. The app does not promise full offline lessons or silent offline submission. Do not leave private queued material on a shared device.
8. Read your teacher’s feedback, published scores and notifications. Class questions are shared with your approved classmates; reflections and marks are private. Report a concern to your teacher rather than sharing private information publicly.

## Profile photos and signing out

Select the photo/initials at the top right (or the profile summary in the desktop sidebar) to open your profile. Use **Update profile photo → Save photo** to change your picture, or **Sign out of Olawale’s Lab** to log out. Choose JPEG or PNG; the browser compresses the image before upload.

Administrators must select an **Initial profile photo** when adding an individual student. Student accounts remain pending until approved. For CSV imports and self-registered students, open **School management → Your students → Profile**, upload the initial photo, then approve the account. Existing accounts without photos retain their access and display initials until an admin supplies the initial photo. Students can subsequently update their own photo from Profile.

The light/dark theme button is beside Profile. Both themes use Grace-Field College’s blue and crimson with readable text on neutral backgrounds.

## Teacher privileges and student directory

Administrators: open **School management → Teachers & subjects → Set teacher privileges**. Select a teacher and grant **Register students**, **Manage student access**, or both. Teachers can never grant privileges or create staff accounts. Revoking a permission applies to the next request, including already signed-in teachers.

All teachers can view registered students in their assigned classes under **Students** (desktop sidebar, Teaching workspace, or **More → Students** on phones). Administrators can view all students. Search by name, school email or admission number; combine class and status filters; choose 10, 20 or 50 students per page, use Previous/Next, or jump to a page. Phone lists use cards to keep actions within reach.

With registration permission, a teacher can register students in their assigned classes in the current session and upload initial photos. New accounts remain pending. With management permission, a teacher can approve, reject, suspend, deactivate or remove students, update their photos, and move them between the teacher’s assigned classes. Initial photos are still required before approval. Account removal preserves academic history. Administrators control teacher assignments and privileges separately.

## Teacher, subject and assignment directories

In **School management → Teachers and subjects directory**, switch between **Teachers**, **Subjects** and **Teaching assignments**. Each tab keeps its own search and filters. Search teacher names/emails or subject names; filter by class, subject, teacher status, or assigned/unassigned where relevant. Assignment filters use the selected academic session.

Choose 10, 20 or 50 entries per page, use Previous/Next, or jump directly to a page. Clear filters recovers from an empty search. Teacher rows provide subject assignment, privilege and recovery actions; subject rows show teacher counts and link to their teaching assignments. Assignments can be removed from their own paginated tab. Phone results use cards.

## Student progress and last seen

Teachers: select **Class progress** in Teaching workspace, the desktop sidebar, or **More** on a phone. Administrators can select **Monitor students** from School management. **Students → Progress** opens an individual learner’s progress. Choose the class, subject, term and academic session at the top; teachers can only monitor assigned class/subject combinations.

Search an active student by name, email or admission number; filter by learning week; use the paginated list to open individual progress. The graphs show lessons marked as read by students, unique exercises attempted, lesson quizzes submitted, topic mastery tests submitted, reflections submitted and assignments submitted. Weekly cards display **work done / released-week activities**, for example 12 / 45. Only released lessons count; their history stays available if later locked. Unreleased and draft-only content is excluded. Exercise attempts count as work done regardless of correctness; practice accuracy is shown separately. Retakes and assignment resubmissions do not inflate completed-task counts. Notes are displayed separately because the platform has no fixed expected number of daily notes.

When creating assignments, select **Learning week** to include them in that week’s progress. Assignments without a learning week are excluded until linked using **Link assignment to week** in Class progress.

Last seen records the student’s latest login or recent foreground interaction, across the account rather than just the selected subject. Activity is saved privately and survives restarts. The app sends at most one update per minute while a visible student tab is recently active; idle/background tabs stop reporting. Staff opening the monitor never advances a student’s last-seen time. **Not recorded yet** means no timestamp has been captured since tracking was introduced. Times display in WAT. These indicators describe activity, not attendance or proof of learning. The staff dashboard refreshes every minute while visible, or immediately using **Refresh progress**.

### Released-week comparison

Class progress defaults to **Latest released week**. Select an earlier released week, or **All released weeks** for combined progress. Use **Compare with** to place two released weeks side by side; counts and completion percentages appear for content read, exercises, quizzes, reflections and assignments. Changes are shown in percentage points so weeks with different workloads can be compared. **Lowest completion first** sorts students for the selected view to help teachers find learners who need encouragement. Consider each week’s release date before interpreting low completion.

Students use **Mark lesson as read** at the end of lesson content; opening a lesson alone does not mark its content consumed. Initial content-read tracking is self-reported and is separate from assessment scores. New assignments should be linked to their learning week; future weeks and their assignments do not enter the totals until released. Release history and earlier progress remain available after a week is locked again.

### Student weekly learning and notebook progress
Open Learn to see work done next to each released week’s lessons. View weekly progress opens your own activity breakdown, practice accuracy, previous-week comparisons and all released weeks. Student and teacher views use the same weekly work calculation. A lesson is read only after Mark lesson as read; retakes count once.

In My notes → Submit my notes, select the date, Daily/Weekly and the open learning week, then attach photos. Both daily and weekly notes are stored under that selected week in My notes. Existing notes without a week show Choose learning week; link them once without re-uploading. Notes remain private and retain teacher marks and correction history. Notebook submissions are optional and are excluded from progress reports.

### Classroom notebook checks and progress
Notebook uploads are optional and do not appear in learning progress, week comparisons or staff monitoring. Classroom notebook checks do not need to be repeated online. Teachers who want digital submissions can still use Notes & review; students can use My notes. Weekly progress tracks reading, exercises, quizzes, topic tests, reflections and assignments.

### Weekly topics, subtopics and lesson templates
Students open Learn, choose a bold subtopic title and work through its content, examples, optional experiment/video and end-of-subtopic practice. Previous/next navigation and a subtopic selector appear above and below the lesson. The final subtopic ends with one weekly topic quiz followed by one weekly reflection. The weekly list also links directly to the quiz and reflection. These open only when all subtopics in that week have been released.

Weeks, lessons, questions and assignments are all written in Lesson Studio. See the [Lesson Studio guide](docs/LESSON_STUDIO_GUIDE.md). The old weekly template form has been removed.

Paste an HTTPS YouTube watch, short, share or embed URL into a subtopic’s video field. The lesson renders an embedded player inside the app. Teacher-entered content is plain text; raw HTML is not required.

Assignments are grouped by week and topic. Each task has its own work date, deadline (WAT), marks and release status. Draft tasks stay private; locked or future scheduled tasks display a locked card without instructions. Publish releases a task when that week’s content is open. Several assignments can belong to one week. Use Assignments → Edit / release to change a task or its deadline.

Weekly progress now counts one weekly quiz and one weekly reflection, alongside content read, unique practice attempts and released assignments. Historical assessment and reflection records remain stored. Note submissions remain excluded from progress.
