# Tech Trolley

Read docs/progress.md, docs/reference-structure.md and docs/decisions.md before changes.
Canonical checkout is E:\Taki. The reference under E:\razon is read-only.
Keep the existing tech-trolley-backend/src/<feature> and tech-trolley-frontend/src/{app,features,components,services} structure.
Never reset business data, expose public registration, use floating point for authoritative money, or commit local secrets.
Every financial command must use PostingService transactions, persisted idempotency and append-only journal entries.
Use isolated PostgreSQL for tests. Never infer that a database is disposable from an environment file.
For Vercel/Render/Supabase, preserve the same-origin web /api proxy and host-only HttpOnly cookies. New app tables must retain RLS and no direct grants to Supabase Data API roles; Nest uses the database table owner.
Record checks and limitations honestly. OWNER and STAFF are the only business roles.
User preference: after app updates, continue committing/pushing and deploying the affected Vercel/Render services, then verify the live result, until the user asks to stop. Maintain a Bengali manual-deployment guide for learning. Paid hosting upgrades require an explicit user decision.
Combined release authorized (2026-10-31): the user requested deployment of the individual purchase form/PDF corrections together with the pending mobile zoom and Download fixes.
Production deployment preference: pushes to codex/tech-trolley-production use the connected Vercel Git integration and Render After CI Checks Pass with API dependency build filters. Supabase migrations run only through the existing API startup runner. Keep render.yaml and live dashboard settings aligned; use manual deployment for recovery, not routine updates.
The API generates the canonical two-page invoice PDF. After changing packages/invoice/src, run npm run prepare:invoice-release and commit the generated backend invoice-version.ts. CI checks this dependency fingerprint so the existing backend build filter deploys shared-template changes together with the API. Do not add a competing manual-deploy pipeline.
