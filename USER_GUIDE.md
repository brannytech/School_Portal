# Using Olawale’s Lab

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
