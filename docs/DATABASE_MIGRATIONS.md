# Database and content migrations

21 October 2026, Phase 1.

Existing SQL migrations remain `001_relational.sql`, `002_history_and_terms.sql` and `003_student_presence.sql`. **Phase 1 adds no SQL migration.** Do not edit/reapply these files to introduce content changes.

Existing `lessons.content` JSON accepts an optional `document` property. Weekly drafts add `revision` and `baseRevision` in the existing `app_settings` store. Publications add a `publicationId` and continue using the existing snapshot archive. Unknown legacy properties remain intact through merge; full replaced publications are archived by both publication routes. No automatic conversion/backfill occurs on startup or lesson read.

Published/draft revision values are opaque tokens. Obtain them from `GET weekly-template?week=N`; send `revision` and `draftRevision` with each save/publish. `null` is the empty-state revision. A token may be omitted only when its current state is absent; omitting a token cannot overwrite existing content. Full-course JSON publication sends the `X-Content-Revision` from its GET response as the POST `revision`. Existing browser forms already implement this protocol. Reload older open tabs after updating the server.

## Backup and rollback

- A private pre-phase backup exists at `.snapshots/phase-1-before-2026-10-21/`, outside public assets and ignored by Git. It includes private records; restrict access and use the existing operational encryption policy before offsite transfer.
- To revert academic content, stop the server, restore a selected reviewed backup with the existing `scripts/restore.mjs` into a fresh DATA_DIR, verify row/media integrity and switch the configured DATA_DIR. The restore command refuses an occupied target; never overwrite the original school database in place.
- Code-only rollback retains JSON fields physically but an older renderer will not understand new document-only lessons. Review that compatibility before rolling back code; use a tested backup when restoring the prior state. Do not strip new documents or snapshots as a downgrade step.
- Backups exclude authentication sessions and recovery tokens. Users sign in again after restoration. Provider object storage requires its own media backup plan.

Phase 1 tests exercise backup/restore of new structured content, archived publications and assessment snapshots into an empty SQLite database, then open the restored lesson through HTTP. A separate read-only comparison confirms all 34 backed-up tables of the existing school database are unchanged from the pre-phase backup.

Later normalised revision/guardian/tenant tables need their own versioned transactional SQL migrations, explicit backfills, rollback and PostgreSQL tests. They are not part of this phase.
