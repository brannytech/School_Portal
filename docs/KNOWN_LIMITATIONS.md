# Current limitations

21 October 2026. **Phases 0 and 1 complete; Phase 2 next.** See [Phase 1 report](PHASE_1_REPORT.md) for exact acceptance evidence and [risk register](RISK_REGISTER.md) for remaining platform risks.

- Teacher Content Studio, rich inline formatting, visual equation input, professional equation typesetting, autosave and version-history/restore controls are not implemented yet. New equation blocks currently show escaped mathematical source.
- Structured lesson text is read-only in the existing weekly form to prevent stale legacy fields from overwriting documents. Validated API/advanced JSON authoring is available; a teacher-facing block editor is Phase 2.
- Only the foundation block types documented in the phase report are supported. New graph authoring, coefficient slider blocks, matrix/geometry tools and richer assessments remain Phases 3–4.
- Existing question-bank order may be reconstructed by SQL IDs on restart; question content/identities and attempt snapshots are preserved. Current revision checks deliberately ignore incidental bank order while preserving document block order.
- Data/revision operations still use a single server process and the compatibility cache. Multi-replica writes and multi-school separation are not supported.
- No parent portal, new personalised intervention engine, subscription management or complete school report-card workflow was implemented in Phase 1.
- Local build, 70 regression tests, maths checks and browser/recovery gates pass. Live PostgreSQL/S3/HTTPS, actual Android, full accessibility/load/security reviews and official curriculum/legal compliance remain unverified external or later-stage requirements.
