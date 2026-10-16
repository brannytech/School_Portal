# Verification record

Completed on 16 October 2026 (Africa/Lagos).

- `node --check server.mjs` and `node --check public/app.js`: pass.
- `node --test tests/*.test.mjs`: **11 passed, 0 failed**. This includes eight integration scenarios, their parent suite and two image-validation tests.
- `node scripts/verify-math/index.mjs`: **392 assessment/example checks** and **900 log-table cells** pass. The 392 consists of 368 assessment questions and 24 worked examples.

Integration coverage: pending and removed accounts; registration privilege escalation; administrator approval; direct locked-week API calls; current/past/future terms; teacher class/subject boundaries; private submission uploads and signed-image ownership; forbidden cross-student attachments; resubmission policy; marking and student feedback; server-marked practice and reflection completion; discussion visibility and teacher replies; lesson-note and live-resource publishing; course validation and answer-key privacy; CSRF; password redaction; malformed images; JPEG metadata removal.

Browser checks: school-building sign-in screen and school crest; student, teacher and admin sign-in; student lesson rendering and answer feedback; teacher weekly controls and publishing of a sample text lesson note; admin validation queue and teacher assignments. Student mobile navigation and notes page were inspected at 360 × 800; the DOM reported no document-level horizontal overflow. Temporary viewport overrides were reset.

An early browser run found inert navigation buttons because default button types were being treated as form submissions; fixed and rechecked with mobile Notes and More navigation. A subsequent local registration test encountered a transient Windows file-write failure; bounded atomic-rename retries were added and the full suite passed. The final suite also verifies that practice accuracy uses attempted questions while completion coverage requires enough of the full question set.

Not claimed: Lighthouse scores, Android/iOS camera certification, real-device PWA installation, cross-device durability, production hosting/database operation, arbitrary teacher-authored maths correctness, or a complete acceptance pass for the original production-stack specification. See README.md and DECISIONS.md for scope.

Browser screenshots are stored under `preview/`.
