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
