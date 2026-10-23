# Database and content migrations

Phase 3 update — 23 October 2026: **No SQL migration.** New `graph` and `math-tool` blocks remain editable validated JSON in existing lessons, drafts, publication history and private templates. Blank template creation is an explicit private draft operation, without a startup reset/backfill. Existing question identities/history and assignment settings remain preserved. Graph definitions roundtrip through restart and backup/restore. An older renderer may reject these new block types; retain a compatible renderer or restore affected publications before rolling code back. [Phase 3 evidence](PHASE_3_REPORT.md).

23 October 2026, through Phase 2.

Existing SQL migrations remain `001_relational.sql`, `002_history_and_terms.sql` and `003_student_presence.sql`. **Phases 1–2 add no SQL migration.** Do not edit/reapply these files to introduce content changes.

Phase 2 adds a bounded `rich-text` block to version-1 lesson documents. Drafts, publication snapshots and author-private scoped `blockTemplates` use existing JSON storage in `app_settings` and ordinary backups. Newly published weeks are archived as well as replaced publications. Restore-as-draft creates a fresh revision without replacing the current publication. No startup backfill or live-school data conversion is run. Run `npm ci` and `npm run build` before restarting; older clients/renderers do not understand the new rich-text blocks.

Existing `lessons.content` JSON accepts an optional `document` property. Weekly drafts add `revision` and `baseRevision` in the existing `app_settings` store. Publications add a `publicationId` and continue using the existing snapshot archive. Unknown legacy properties remain intact through merge; full replaced publications are archived by both publication routes. No automatic conversion/backfill occurs on startup or lesson read.

Published/draft revision values are opaque tokens. Obtain them from `GET weekly-template?week=N`; send `revision` and `draftRevision` with each save/publish. `null` is the empty-state revision. A token may be omitted only when its current state is absent; omitting a token cannot overwrite existing content. Full-course JSON publication sends the `X-Content-Revision` from its GET response as the POST `revision`. Existing browser forms already implement this protocol. Reload older open tabs after updating the server.

## Backup and rollback

- A private pre-phase backup exists at `.snapshots/phase-1-before-2026-10-21/`, outside public assets and ignored by Git. It includes private records; restrict access and use the existing operational encryption policy before offsite transfer.
- Phase 2 also has a private pre-change backup at `.snapshots/phase-2-before-2026-10-21/`. New isolated tests verify rich content, history and private templates through restart and backup/restore. The live database comparison matched 31 of 34 backed-up tables; three operational tables differed while the app stayed active. Academic tables matched, FK violations were zero, and no operational changes were reset. See [Phase 2 report](PHASE_2_REPORT.md).
- To revert academic content, stop the server, restore a selected reviewed backup with the existing `scripts/restore.mjs` into a fresh DATA_DIR, verify row/media integrity and switch the configured DATA_DIR. The restore command refuses an occupied target; never overwrite the original school database in place.
- Code-only rollback retains JSON fields physically but an older renderer will not understand new document-only lessons. Review that compatibility before rolling back code; use a tested backup when restoring the prior state. Do not strip new documents or snapshots as a downgrade step.
- Backups exclude authentication sessions and recovery tokens. Users sign in again after restoration. Provider object storage requires its own media backup plan.

Phase 1 tests exercise backup/restore of structured content, archived publications and assessment snapshots into an empty SQLite database, then open the restored lesson through HTTP. At that phase's checkpoint, a separate read-only comparison confirmed all 34 backed-up tables unchanged. The later Phase 2 comparison is recorded above; the historical all-table match is not a current live-data claim.

Later normalised revision/guardian/tenant tables need their own versioned transactional SQL migrations, explicit backfills, rollback and PostgreSQL tests. They are not part of this phase.
