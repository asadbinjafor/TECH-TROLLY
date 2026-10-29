# Tech Trolley

Read docs/progress.md, docs/reference-structure.md and docs/decisions.md before changes.
Canonical checkout is E:\Taki. The reference under E:\razon is read-only.
Keep the existing tech-trolley-backend/src/<feature> and tech-trolley-frontend/src/{app,features,components,services} structure.
Never reset business data, expose public registration, use floating point for authoritative money, or commit local secrets.
Every financial command must use PostingService transactions, persisted idempotency and append-only journal entries.
Use isolated PostgreSQL for tests. Never infer that a database is disposable from an environment file.
Record checks and limitations honestly. OWNER and STAFF are the only business roles.
