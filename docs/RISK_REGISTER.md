# Modernisation risk register

21 October 2026 (Africa/Lagos). Findings are based on the Phase 0 code review and executed baseline. Open entries are not claims of completed remediation.

Phase 1 update: the source-preservation/new-document validation/concurrency/publication-path controls in R1–R3 are implemented and locally verified; see [acceptance evidence](PHASE_1_REPORT.md). Rich-editor/autosave/production controls and the remaining platform risks stay open. The table retains the original risk descriptions for provenance.

| ID | Priority | Risk / evidence | Required control / stage | Status |
|---|---|---|---|---|
| R1 | High | `readBuilder()` and `prepareWeek()` reconstructed whitelists, potentially dropping legacy metadata on republish | Source snapshots/adapters, roundtrip tests and ID-based field preservation in Phase 1 | Addressed locally in Phase 1 |
| R2 | High | Draft saving did not validate structured content; draft edits lacked a separate revision token | Server schema validation for all new documents and optimistic draft concurrency, Phase 1; autosave tests Phase 2 | Foundation addressed; autosave deferred to Phase 2 |
| R3 | High | Multiple content publication ingress paths (`weekly-template` and legacy `course`) | Shared validator and tests on both paths; student-safe document projection, Phase 1 | Addressed locally in Phase 1 |
| R4 | High | Schools table exists but cache, class/subject identifiers and load/persist logic are single-school | Tenant-aware repositories and verified original-school backfill before school provisioning, Phase 8 | Open; do not enable tenancy |
| R5 | High | Matching/steps/graph kind labels exceed dedicated interaction/grading support | Explicit supported-type capabilities and review workflow; type-by-type acceptance tests, Phase 4 | Open |
| R6 | High | App request serialisation and whole-domain compatibility cache constrain concurrency | Preserve one process for now; transactional per-operation repositories before replicas, Phase 8/9 | Open |
| R7 | High | Local passing privacy tests cover selected routes, not all legacy record-ID/session paths | Endpoint-by-endpoint authorisation inventory and negative tests; same discipline on every new route, complete review by Phase 9 | Open; no penetration-test certification |
| R8 | Medium | Layered global renderer overrides and old sidebar launchers create regressions/reachability risk | Integrate shared renderer at final weekly override; browser test actual teacher/student paths, Phases 1–3 | Open |
| R9 | Medium | All 250 practice question forms and 50 lesson exercises can render at once | Contextual/collapsible studio design, lazy heavy dependencies and measured rendering, Phases 2/3/9 | Open; baseline mobile width passes |
| R10 | Medium | Numerical expression checking samples five positive values | Keep limitation visible; domain-aware equivalence tests/review, Phase 4; no symbolic-proof claims | Open |
| R11 | Medium | Older docs contain superseded lesson counts/workflows | Current audit/tracker takes precedence; maintain dated evidence and update affected guides with each implementation | Documented in Phase 0 |
| R12 | High | Backups contain student records, hashes and application secrets | Private `.snapshots` ignored; actual backup/restore verified; operational encryption/access/retention review Phase 9 | Local recovery verified; offsite security open |
| R13 | Medium | No current editor/math libraries installed or evaluated | Current official compatibility/security/licensing review before selection, Phases 2/3 | Deferred deliberately |
| R14 | High | PostgreSQL/S3/hosted HTTPS/physical Android not exercised here | Credentialed staging/provider recovery and actual device evidence, Phase 9 | External verification pending |
| R15 | High | Guardian roles and linkage absent | Verified/revocable access, explicit permitted disclosures, Phase 7; current NDPA/NDPC legal review by Phase 9 | Not implemented; legal compliance not assessed |

No SQL migrations or live-school student data transformations were performed in Phases 0–1. Existing issue discovery did not fail the Phase 0 documentation gate; it defined later implementation gates. Phase 1 evidence resolves only the specific foundation controls listed above, not the full production risk register.
