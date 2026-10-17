# Installation, deployment and recovery

## Tested local installation

Node.js 22.11 or newer is required. The tested runtime is Node 22.11 with its SQLite flag enabled by the npm scripts. SQLite is experimental in that exact runtime; do not infer that this test certifies every later Node release.

```powershell
npm ci
Copy-Item .env.example .env
npm run build
npm start
```

Open http://127.0.0.1:3000. With DEMO_MODE=true, development sandbox buttons enter fictional role accounts without embedding account passwords in the client. Existing user, subject and assignment records are retained. The legacy `data/database.json` is imported only when no relational database exists; the original file is left untouched. Subsequent writes go to `school.sqlite`, not the old JSON file. Stop the old server before upgrading and make a private backup first. Automatic curriculum upgrades keep a private pre-upgrade course snapshot in database settings.

## Production bootstrap

Use a **separate empty data directory**. A development database is explicitly rejected in production. Do not copy the sandbox database into a live school environment.

Configure these server environment variables, or place them in a private `.env` file:

- `NODE_ENV=production`, `DEMO_MODE=false`.
- `DATA_DIR`: private persistent directory, outside `public/`.
- `SESSION_SECRET`: at least 32 random characters from a secret manager.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: first administrator’s email and a unique password of at least 14 characters. Used only on initial bootstrap; no default production password exists.
- `INITIAL_SESSION`: optional academic-session label. If absent, the school year is derived from the September start, rather than hard-coded.
- `COOKIE_SECURE=true` behind HTTPS. Use a valid TLS reverse proxy and keep this application’s direct port private. Configure `HOST` and `PORT` for the hosting environment.
- `SELF_REGISTRATION=false` by default. Administrator-created/imported student accounts remain PENDING until approved. Setting it to true enables pending self-registration.

Run `npm ci`, `npm run build`, then `npm start`. First production bootstrap seeds curriculum and school structure, but no fictional students, teachers, marks or assignments. Access recovery uses a short-lived single-use token created by an authenticated school administrator and delivered privately to its account holder. The application does not send invitation or recovery emails.

## PostgreSQL

Set `DATABASE_URL` to a genuine PostgreSQL connection string and `DATABASE_SSL=true` where the host requires verified TLS. The `pg` adapter uses bound parameters and the versioned SQL files in `migrations/`. Migrations run transactionally at startup. Use a restricted database account and take a backup before schema changes.

**Live PostgreSQL was not available in this workspace.** The adapter is implemented; a hosted PostgreSQL migration, restart, upload, account and isolation test remains a deployment gate. SQLite migrations, constraints and restore were tested locally. Switching `DATABASE_URL` does not copy records automatically. Use the tested logical backup/restore format into an empty target, then execute the external-database verification gate before admitting students.

Run **one application process/replica** per database. The compatibility repository maintains an in-process domain cache and serialises requests. Multiple replicas, clustering and independent direct database writers require a repository concurrency redesign; PostgreSQL configuration alone does not make this architecture horizontally scalable.

## Private storage

`STORAGE_DRIVER=local` stores media in `DATA_DIR/uploads/`. Use a private encrypted persistent volume and appropriate operating-system ACLs. No HTTP static route serves that directory. File routes recheck authorisation and use short-lived signed access.

For S3/R2-compatible storage, configure `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`, plus server-only `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Keep the bucket private. The implementation uploads through the SDK and proxies authorised downloads, including video byte ranges. It does not make public object URLs or claim to transcode videos or scan malware.

**Live object-storage credentials were not available.** Bucket policy, actual uploads, signing, range playback and backup must be checked against the intended provider before production. JPEG/PNG cleaning and private local image submission are tested. PDF/DOCX/MP4/WebM signature validation is implemented, but signature checks are not a malware scanner. Add scanning/quarantine if the school requires untrusted document/video uploads.

## Backup and restore

Stop application writes during a maintenance window and run:

```powershell
npm run backup -- backups/private-school-backup
```

The logical snapshot includes relational records and local media; authentication sessions and recovery tokens are excluded. Backups contain student records and password hashes: restrict access, encrypt offsite copies, establish retention and practise restores. S3 media requires a separate versioned bucket backup. The backup directory is Git-ignored.

Restore into a new, empty directory/database:

```powershell
$env:DATA_DIR = 'data-restored'
npm run restore -- backups/private-school-backup
```

The restore command refuses to overwrite a database with existing users. It restores media, uses a transaction for records and requires every user to sign in again. A local backup/restore round trip was executed by the automated suite. A school-specific retention/deletion schedule and offsite recovery process still need operational approval; user removal is archival rather than record destruction.

## Release gates

`npm run build`, `npm test`, and `npm run verify-math` must pass. Then verify the actual PostgreSQL/storage deployment, HTTPS, device camera/file-picker behaviour, mobile keyboard access, PWA installation, backups and a complete student → teacher → student marking cycle with fictional staging accounts. No production student records are used in automated tests. Do not label the deployment production-ready before these external gates pass.
