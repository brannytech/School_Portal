# Modernisation risk register

Phase 3 update — 23 October 2026: blank templates, bounded expression parsing/definition validation, editable local graph/matrix/geometry controls, mobile widths and saved configuration recovery pass the local gate. Numerical sampling/feature limits, basic geometry constraints, local-only exercise feedback and formal assessment permissions are documented in [Phase 3 evidence](PHASE_3_REPORT.md). Physical-device, accessibility/performance and external production gates remain open. No new dependency audit was run in this phase.

21 October 2026 (Africa/Lagos). Findings are based on the Phase 0 code review and executed baseline. Open entries are not claims of completed remediation.

Phase 2 update — 23 October 2026: visual authoring, rich-text validation, safe local equation input/display, serial autosave, conflict/offline handling and scoped history/restore now pass local acceptance. The installed dependency audit reports zero known vulnerabilities; physical-device, comprehensive accessibility/security and performance gates remain open. See [Phase 2 evidence](PHASE_2_REPORT.md).

Phase 1 update: the source-preservation/new-document validation/concurrency/publication-path controls in R1–R3 are implemented and locally verified; see [acceptance evidence](PHASE_1_REPORT.md). Rich-editor/autosave/production controls and the remaining platform risks stay open. The table retains the original risk descriptions for provenance.

| ID | Priority | Risk / evidence | Required control / stage | Status |
|---|---|---|---|---|
| R1 | High | `readBuilder()` and `prepareWeek()` reconstructed whitelists, potentially dropping legacy metadata on republish | Source snapshots/adapters, roundtrip tests and ID-based field preservation in Phase 1 | Addressed locally in Phase 1 |
| R2 | High | Draft saving did not validate structured content; draft edits lacked a separate revision token | Server schema validation, independent draft concurrency and serial autosave with conflict/offline tests | Addressed locally in Phases 1–2; memory-only offline edits remain a documented limit |
| R3 | High | Multiple content publication ingress paths (`weekly-template` and legacy `course`) | Shared validator and tests on both paths; student-safe document projection, Phase 1 | Addressed locally in Phase 1 |
| R4 | High | Schools table exists but cache, class/subject identifiers and load/persist logic are single-school | Tenant-aware repositories and verified original-school backfill before school provisioning, Phase 8 | Open; do not enable tenancy |
| R5 | High | Matching/steps/graph kind labels exceed dedicated interaction/grading support | Explicit supported-type capabilities and review workflow; type-by-type acceptance tests, Phase 4 | Open |
| R6 | High | App request serialisation and whole-domain compatibility cache constrain concurrency | Preserve one process for now; transactional per-operation repositories before replicas, Phase 8/9 | Open |
| R7 | High | Local passing privacy tests cover selected routes, not all legacy record-ID/session paths | Endpoint-by-endpoint authorisation inventory and negative tests; same discipline on every new route, complete review by Phase 9 | Open; no penetration-test certification |
| R8 | Medium | Layered global renderer overrides and old sidebar launchers create regressions/reachability risk | Shared renderer integrated at final weekly override; actual teacher/student browser regression each phase | Locally covered through Phase 2; ongoing regression risk |
| R9 | Medium | All 250 practice question forms and 50 lesson exercises can render at once in the legacy form | Contextual studio question selection, collapsible blocks, lazy dependencies and measured performance | Studio mitigates form rendering; 360px passes; low-end performance gate open |
| R10 | Medium | Numerical expression checking samples five positive values | Keep limitation visible; domain-aware equivalence tests/review, Phase 4; no symbolic-proof claims | Open |
| R11 | Medium | Older docs contain superseded lesson counts/workflows | Current audit/tracker takes precedence; maintain dated evidence and update affected guides with each implementation | Documented in Phase 0 |
| R12 | High | Backups contain student records, hashes and application secrets | Private `.snapshots` ignored; actual backup/restore verified; operational encryption/access/retention review Phase 9 | Local recovery verified; offsite security open |
| R13 | Medium | Editor/math dependencies require compatibility/security/licensing evaluation and maintenance | TipTap/MathLive/KaTeX evaluated with official sources, local bundling/notices, patched KaTeX and dependency audit; repeat on updates | Phase 2 selection locally verified; continuing dependency maintenance |
| R14 | High | PostgreSQL/S3/hosted HTTPS/physical Android not exercised here | Credentialed staging/provider recovery and actual device evidence, Phase 9 | External verification pending |
| R15 | High | Guardian roles and linkage absent | Verified/revocable access, explicit permitted disclosures, Phase 7; current NDPA/NDPC legal review by Phase 9 | Not implemented; legal compliance not assessed |

No SQL migrations or live-school student data transformations were performed in Phases 0–2. Existing issue discovery defined later implementation gates. Current evidence resolves only the local controls listed above, not the full production risk register.
