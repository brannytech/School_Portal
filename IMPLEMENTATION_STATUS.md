# Status against the expanded LMS brief

Updated 17 October 2026, Africa/Lagos. This is a functioning expanded MVP, not a claim that every production acceptance criterion has passed.

| Area | Implemented | Verification / remaining scope |
| --- | --- | --- |
| Persistence | Relational SQLite; PostgreSQL adapter; two versioned migrations; foreign keys, constraints, indexes; legacy import | SQLite and restore tested. Live PostgreSQL unverified. Single-process repository only. Rich blocks, question definitions and submission snapshots use JSON columns alongside relational ownership/scope keys. |
| Authentication | scrypt, durable hashed session IDs, CSRF, rate limits, pending/active/suspended/deactivated/archived statuses, one-time recovery | Approval, suspension, restart, recovery replay and clean production bootstrap tested. Email invitation delivery is not integrated. |
| Academic organisation | Configurable sessions, terms, six classes, teacher assignments, promotion/enrolment archives | Historical class and session isolation tested. Multi-school tenancy is not implemented beyond the school entity. |
| Release rules | Week and daily locks; draft/scheduled/locked/unlocked/archived; read-time scheduled availability; staff preview | Direct lesson/assessment access tested. Scheduled notifications/background job processing are not provided. |
| Learning | 24 daily lessons across eight topics; worked steps, diagnostics, practice, reflections, optional teacher resources | Browser rendering and selected interactions checked. The bank follows the supplied topic outline; independent external curriculum accreditation was not performed. Some generated exercises are parameter variations of a method, rather than 60 different conceptual methods. |
| Question bank | 1,600 persisted assessment items: 60/subtopic plus 20/topic; numeric/MCQ/formula tasks; hints, tolerance and explanations | 1,624 item/example checks; no repeated full prompt within a subtopic; 900 log and 1,000 antilog cells checked. Advanced matching, rich short-answer rubrics and drag ordering remain incomplete. |
| Assessments | Separate 10-question quiz and 20-question mastery attempts, server marking, score history, bands, attempts/time | Answer withholding, whole-attempt marking, retries and mastery tested. Formal timed online test/exam authoring and availability windows remain a later feature; official results currently use manual/CSV entry. |
| Maths tools | Scientific calculator, base/indices/variation/formula/quadratic tools, log/antilog tables, guided formula steps, point-plot activity | Calculator and formula checks tested. Formula equivalence uses bounded numerical samples, not a complete symbolic proof/CAS. Manual tool activities are formative and do not themselves award official marks. |
| Work and notes | Private photo/PDF/DOCX work; marking; note max/rubric; versions/history; correction requests; in-app notifications | Private local image and note/resubmission workflows tested. Physical phone camera, rotation/order and every binary format still need real-device end-to-end checks. No in-app live camera preview. |
| Discussions/reflections | Class-only questions, replies, resolve/pin/hide/report; private submitted reflections; draft/confidence/difficulty fields | Moderation and privacy tested at API level. Reply highlighting API exists; a complete moderation/report triage dashboard is still partial. |
| Results | Draft/published test/exam records, CSV import, audited corrections, configurable weighted summaries | Publication and weighted calculations tested. School-specific report cards/positions/approval workflows are not complete. |
| Media | Hosted links, private local/S3 upload adapter, video range playback, speed/resume, live link instructions | S3 and provider playback/captions are unverified. No video transcoding, automatically generated captions or conferencing service. |
| UX/PWA | Existing responsive navigation retained; sessions, notifications, expanded learning forms and tools added; cached public shell | Selected mobile/browser checks performed. No Lighthouse certification, comprehensive accessibility audit, complete downloadable offline course system or actual-phone certification. |
| Operations | Build, environment template, production bootstrap, backup/restore, deployment and role guides | Build and local restore tested. Hosted HTTPS, monitoring, encrypted offsite backup, retention processes and external-service staging remain deployment gates. |

## Current gates

- Build/type checks and automated API/database tests: passing in the available local environment; actual command totals are in VERIFICATION.md.
- Seeded mathematical checks: passing.
- Local application: working and migrated; existing school subjects and assignments retained.
- External deployment and complete production-school operational acceptance: **not passed / not claimed**.

## Next development phase

1. Provision staging PostgreSQL and private object storage; execute migrations, backup recovery and a complete device upload/marking workflow there.
2. Replace the compatibility cache/serial request model with transactional per-operation repositories before adding replicas or high concurrency.
3. Add formal timed assessment authoring, richer question renderers, a teacher-friendly lesson block editor and moderation triage.
4. Complete curriculum review, school report cards, media accessibility, malware scanning and phone/accessibility/performance audits.
5. Introduce email invitations, delivery integrations and multi-school tenancy only with actual configured providers and tested tenant boundaries.
