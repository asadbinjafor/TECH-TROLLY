# Deployment, backups and recovery

No server/domain/account was supplied for the new repository. Historical Vercel/Render/Supabase settings belong to the read-only reference; no reference credentials or databases were accessed. Portable deployment templates are prepared. Docker is unavailable on this computer, so container startup has not been verified locally.

## Local Windows

The task created an isolated PostgreSQL instance under `.local/postgres-test`, listening only on `127.0.0.1:55432`. It is separate from the existing PostgreSQL 18 Windows service. Its trust authentication is test-only. `trolley_local` is the empty local application database; `trolley_browser_test` contains explicitly synthetic browser QA records. Acceptance tests create and drop their own unique `_test` databases. Nothing touches the reference's database.

```powershell
Set-Location E:\Taki
./scripts/start-test-postgres.ps1
npm ci
npm run build:shared
# The ignored backend .env has already been prepared from the requested initial setup.
npm run db:migrate
npm run db:bootstrap
npm run build -w @tech-trolley/backend
# Terminal 1
npm start -w @tech-trolley/backend
# Terminal 2
npm run dev -w @tech-trolley/frontend
```

Use http://localhost:3001. Migrations and bootstrap preserve existing data. Do not run reset/drop/db-push against an existing application database. Development is not production hosting.

## Portable HTTPS deployment

Install Docker Engine/Compose on the chosen host. Copy `infra/.env.example` to ignored `infra/.env` and supply an actual DNS hostname, HTTPS origin, encoded private database connection and server-only bootstrap inputs. The database URL in Compose uses host `db`; it is not public. Keep secrets in the host's secret store or protected environment, never in client variables. The supplied stack uses Caddy for HTTPS and same-origin `/api`, NestJS, Next standalone, private PostgreSQL and a persistent backup volume.

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml build
docker compose --env-file infra/.env -f infra/compose.yaml up -d db
docker compose --env-file infra/.env -f infra/compose.yaml run --rm api node dist/database/migrate.js
docker compose --env-file infra/.env -f infra/compose.yaml run --rm api node dist/auth/bootstrap.js
docker compose --env-file infra/.env -f infra/compose.yaml up -d
docker compose --env-file infra/.env -f infra/compose.yaml ps
```

Run migrations explicitly before serving a release. Startup never synchronizes or resets schema. Remove bootstrap secrets after successful initial setup. External PostgreSQL should use certificate-verified TLS (`DATABASE_SSL=true` with a trusted CA) and appropriate connection pooling; the internal Compose network uses private transport. API pools are bounded at 10 connections per instance. Production cookies require HTTPS.

`/api/health` checks database/migration availability. Monitor HTTP errors/latency, readiness failures, database storage/connections and backup completion. The backup container exits on failure so a host alert can detect/restart it. No external alert destination/account was invented. Caddy access logs exclude application payloads; API errors log only error type/code. Configure log rotation/retention on the host and verify the chosen infrastructure's secret redaction.

## Backups and restore

`infra/backup.sh` makes daily custom-format pg_dump backups, retains 30 days and promotes a `.partial` file only after successful dump. Backup volume survives containers, but is not an off-host disaster-recovery copy. Before production use, configure an encrypted off-host copy/retention policy in the selected hosting account, restrict access, and alert on stale backups. This external destination is not configured without hosting input.

PowerShell backup (requires server-only DATABASE_URL in the current process; do not echo it):

```powershell
./scripts/backup.ps1
# Restore into a new isolated test database; original DB remains intact:
./scripts/restore-test.ps1 -BackupFile 'E:\Taki\.local\backups\ACTUAL_BACKUP.dump'
```

Restore verification was executed: three synthetic browser documents and every journal account balance matched the source exactly, and all restored document journals summed to zero. The restore was into a unique `trolley_restore_*_test` database. Dumps remain ignored. Test restores are not a production restore claim.

For production recovery: provision a fresh private PostgreSQL database, restore a validated backup with `pg_restore --no-owner --exit-on-error`, compare document counts, all account balances, stock and dues, then run only missing compatible migrations and point a staging API to it. Verify login, protected reads, opening persistence and existing receipts before switching production traffic. Do not restore over a live database or replace current records by a prototype export. Schedule regular restore drills using an isolated destination.

## Rollback and staging

Use separate secrets, database, volumes and hostname for staging. Apply each migration to a restored staging snapshot first. These migrations are additive except a constraint/index replacement designed for the newly introduced schema; there is no legacy reference-data import. Reverting an application container must remain compatible with the current schema. Prefer forward fixes; no destructive automatic down migration is supplied. A database restore loses later committed activity and therefore requires a deliberate recovery decision and reconciliation.

CI installs from the one lockfile, builds shared/API/web, typechecks native, runs isolated real-PostgreSQL acceptance tests, exports Android/iOS bundles and runs Expo Doctor. A local passing check is distinct from a successful hosted CI run. Do not merge the implementation branch into a release/default branch without the requested review process.

Concrete external inputs remaining: hosting account/server and DNS domain; production database/secrets and off-host backup/alert destination; Expo account/project; Android signing/distribution account; Apple team/signing/devices or TestFlight; real shop contact/support/privacy details. No paid service has been provisioned.
