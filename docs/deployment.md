# Deployment, backups and recovery

The active managed deployment is **Vercel web + Render API + Supabase PostgreSQL**: [Tech Trolley Web](https://tech-trolley-internal.vercel.app/) and [API health](https://tech-trolley-internal-api.onrender.com/health), with the private Supabase project recorded in server configuration. Current release evidence and limitations are in [progress.md](progress.md); operator instructions are in [the Bengali manual](manual-deployment-bn.md). Follow `render.yaml` and `tech-trolley-frontend/vercel.json`. Production-branch pushes use Vercel Git and Render **After CI Checks Pass**; the existing API startup runner alone applies migrations. Manual deployment is recovery, not the normal release path. Secrets stay outside Git and client bundles. The portable Docker alternative below is not the active deployment; container startup has not been verified here.

## Local Windows

Historical local setup used a separate loopback PostgreSQL instance under `.local/postgres-test` on port 55432. Its trust authentication is test-only. Do not assume any currently configured local database is empty or disposable. New audits/releases create their own explicitly owned cluster and UUID test databases; ownership must be verified before writes or cleanup. The reference database remains untouched.

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

The existing Vercel/Render/Supabase accounts, HTTPS endpoints and production secrets are configured; they are not outstanding release inputs. Remaining external work includes off-host recovery/alert acceptance, Expo/signing/distribution accounts and physical Android/iOS devices or TestFlight acceptance. A custom domain is optional. No paid hosting upgrade or store release is authorized by these instructions.
