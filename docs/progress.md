# Progress and release handover

## Dashboard deployment execution — 2026-10-30

User supplied the Vercel, Render and Supabase dashboards and requested deployment. The new Vercel Hobby project **tech-trolley-internal** deployed from `7cab280d52fde2e25c4119a56d308515ea2d28d7`, branch `codex/tech-trolley-production`, root `tech-trolley-frontend`. Production web: https://tech-trolley-internal.vercel.app/. The [connected production redeployment](https://vercel.com/asad-6810/tech-trolley-internal/HvWAbvBbrQVfZmayT6EYvLFoN9CQ) uses `NEXT_PUBLIC_API_URL=/api` and production-only `API_UPSTREAM_URL=https://tech-trolley-internal-api.onrender.com`. Web and `/api/health` return HTTP 200; the proxy health body is `{"status":"ok"}`. The same source commit's [CI run 40942292088](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/40942292088) passed.

The user completed the password/creation step for the new Supabase Free/Nano project **tech-trolley-internal**, project reference `iejosjzhjjeykxknbxdw`, in Singapore. Its dashboard reports Healthy. Data API was disabled in the new-project form. The project-specific Session pooler URI on port 5432 was read from Connect; the public Supabase Root 2021 CA was downloaded and validated (expires April 2031). A real connection with verified TLS succeeded. Render applied migrations 001/002/003 and bootstrapped the initial Owner. A READ ONLY verification confirmed 1 user/Owner requiring password change, 7 approved expense categories, zero documents/inventory units/parties, and RLS on all 17 public application tables. `anon`, `authenticated` and `service_role` have no SELECT/INSERT/UPDATE/DELETE privileges on those tables.

Render service **tech-trolley-internal-api** is live at https://tech-trolley-internal-api.onrender.com/, service `srv-dbhqf66gekts73bv6phg`, [first deployment](https://dashboard.render.com/web/srv-dbhqf66gekts73bv6phg/deploys/dep-dbhqf6egekts73bv6rjg). It uses Node, Singapore, blank root, Free ($0/month), `npm ci --include=dev && npm run build:api`, `npm run start:render`, health `/health`, auto deploy Off. Runtime/TLS/pool/CA/origin, database URL and private bootstrap values are server environment values. Direct `/health` returns HTTP 200 `{"status":"ok"}`. The user supplied the database password in ignored `.local/deployment.env`; it was not disclosed in chat or Git. No browser password manager was read and no unrelated autofilled password was reused.

A real login through the public Vercel `/api` proxy succeeded with the requested initial credentials. The Owner still requires password change; a protected report request is blocked with `PASSWORD_CHANGE_REQUIRED`. The session cookie is host-only, HttpOnly, Secure and SameSite Strict. `/auth/me`, logout and rejection of the revoked session were verified. The verification session was revoked; the Owner password and business data were not changed. The user must change the initial password on first login and supply real shop/opening information. Free Render cold starts and Free Supabase backup limitations remain as documented in the deployment guide.

Vercel email reauthentication was completed by the user. Existing hosted reference services/projects were not modified, paused or deleted. No paid plan was selected. This execution section supersedes the historical local-only/cloud-blocker status below for web/API/database. Native signing/device/distribution work remains pending.

## Managed hosting follow-up — 2026-10-30

User selected Vercel (web), Render (API) and Supabase (PostgreSQL). Added [বাংলা deployment guide](deploy-vercel-render-supabase-bn.md), frontend vercel.json and root render.yaml. Vercel root is tech-trolley-frontend; Render root stays blank so workspace commands can access shared packages. Actual provider project URLs/secrets/accounts are still not supplied; this prepares deployment, not a claim of live hosting.

Browser requests now default to /api through a thin Next route proxy to server-only API_UPSTREAM_URL. This keeps HttpOnly/Secure/SameSite Strict cookies on the Vercel origin across separate Render/Vercel domains. CSV, Origin and idempotency headers are preserved; native/bearer headers from web callers are not forwarded. Financial logic stays in Nest. Native clients continue using the direct Render HTTPS URL.

Render build: npm ci --include=dev && npm run build:api. Start: npm run start:render (versioned migration → idempotent bootstrap → API). No reset or automatic sample data. The optional paid pre-deploy path is documented. Supabase Session pooler port 5432, verified TLS/custom CA and a five-connection pool are covered. Migration 003 enables RLS and revokes Supabase Data API-role privileges only for app-owned objects. Existing application history/passwords are preserved.

Verification: provider JSON schemas validated for both manifests; web/API builds and workspace typecheck pass; 2 hosting tests pass; backend suite 13 tests pass including repeat release without bootstrap secrets, untrusted-role RLS denial, and a real Nest login/CSV/logout flow through the web proxy. Implemented and pushed in [97587ff](https://github.com/asadbinjafor/TECH-TROLLY/commit/97587ff2f596b795042d6df9f7094acc0c1887ee). No real provider connection, database migration against Supabase, or public deploy was performed. The historical handover below remains the baseline; the selected providers and web proxy above supersede its hosting-selection/default API notes.

[Managed-hosting CI run 40941893627](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/40941893627) passed on 97587ff: clean install, full builds/typechecks, hosting tests, PostgreSQL tests, Android/iOS bundles and Expo Doctor. Final follow-up changes only correct the recorded test count and add these verification links.

---

Updated 2026-10-30 (Asia/Dhaka). Canonical integrated checkout: `E:\Taki`.
Branch: [codex/tech-trolley-production](https://github.com/asadbinjafor/TECH-TROLLY/tree/codex/tech-trolley-production).
Remote: `origin`, verified as `https://github.com/asadbinjafor/TECH-TROLLY.git`.
No auxiliary branches/worktrees were needed. No default/release branch merge or history rewrite was performed.

The reference at E:\razon\Tech-Trolley-Mobile-Shop-Inventory-and-Internal-Sales-Management-System remains read-only. It was structurally audited before implementation. See reference-structure.md, audit.md and requirements.md.

| Phase | Status |
| --- | --- |
| A — audit, structure mapping, workspace | Complete locally |
| B — schema, login-only roles/bootstrap/opening | Implemented and PostgreSQL-tested |
| C — purchase/stock/sale/settlement/receipt | Implemented; API and browser end-to-end checks pass |
| D — expenses/categories/funding/loans/advances/salary | Implemented; accounting/permission tests pass |
| E — daybook/counts/reports/corrections/export | Implemented; date/immutability/authorization checks pass |
| F — bilingual/theme web and native clients | Web visually exercised; native code/typecheck/bundles pass; device acceptance pending |
| G — tests/deployment/release | Local and Linux CI verification pass; portable artifacts/runbooks prepared; cloud/signed-device release blocked on external inputs |

Verified implementation commits, all pushed and remote-head checked:

| Commit | Change |
| --- | --- |
| [0e4b9eb](https://github.com/asadbinjafor/TECH-TROLLY/commit/0e4b9eb8b0c6b2c3af5b8145b55c74b792a51206) | Read-only audit and path mapping |
| [ca33306](https://github.com/asadbinjafor/TECH-TROLLY/commit/ca33306794563be375ac4fd109f9d94bd8e839ae) | Authenticated ledger and bilingual web/native clients |
| [37475b1](https://github.com/asadbinjafor/TECH-TROLLY/commit/37475b1059f4f816a4ca6a4877157b695927649d) | Accounting date/retry hardening, tests and release artifacts |
| [d536514](https://github.com/asadbinjafor/TECH-TROLLY/commit/d53651412082066b5c8ded2bb3af02056a6dae98) | Expo dynamic-config typing and explicit development dependency injection |

[GitHub CI run 40938594269](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/40938594269) completed successfully on d536514: install, shared/API/web build, all typechecks, real PostgreSQL tests, both mobile bundles and Expo Doctor. The earlier run failed on a dynamic Expo-config type and was corrected, not ignored. Final handover-only changes add the OpenAPI snapshot, progress/evidence, generated-type ignore and a tested restore-script environment cleanup.

Fresh `npm ci` completed locally. Web/API builds and ten PostgreSQL tests pass. Root typecheck passes after the Expo configuration correction. Both native Hermes bundles export; Expo Doctor passes 20/20. Repeatable CUA browser E2E script passes. Backup/restore test into a fresh database matched document count and all account balances. See verification.md for commands and limits.

The canonical local application is running at http://localhost:3001, API at http://localhost:3000. The actual requested initial Owner authenticated and was verified to require password change; its test session was revoked without changing the password. `trolley_local` has exactly one Owner and zero documents, units and parties. Bootstrap was rerun without duplicate accounts or data resets. Requested values exist only in ignored server configuration. Use the brief's initial credentials, change the password, then complete opening setup. No sample staff or business records were seeded there.

Separate synthetic databases: `trolley_browser_test` for UI verification, unique acceptance `_test` databases that are dropped after tests, and isolated restore-test databases. They use a task-owned PostgreSQL instance on loopback port 55432 under ignored `.local/postgres-test`; the existing Windows PostgreSQL service was not used. Dumps and credentials remain ignored. QA servers on ports 3100/3101 were stopped after testing; the canonical app uses 3000/3001.

Final component status:

| Component | State |
| --- | --- |
| Web | Implemented, production-built, browser-tested, running locally; not publicly deployed |
| API | Implemented, built, PostgreSQL/API-tested, running locally; not publicly deployed |
| Database | Local/test migrations executed; test backup and fresh restore verified; production DB not provisioned |
| Android | Native client and JS bundle prepared; no signed APK/AAB, install, physical-device test or distribution |
| iOS | Native client and JS bundle prepared; no signed IPA, install, physical-device test or distribution |

Concrete release blockers: Docker is not installed locally; no new hosting server/domain/account has been supplied; EAS is not logged in and an Android preview build stopped before job creation; no Expo project/token/signing credentials, Java/Android SDK or physical devices; no Apple team/TestFlight/Play account/distribution decision. Real shop address/contact/support/privacy URLs also need Owner input. Nothing has incurred a paid deployment/build or been published to an app store.

Eight full-workspace advisory nodes remain in Expo build tooling (older CLI Zod and unpatched deepmerge chains). Web/API production audit is clear. Preserve SDK compatibility; review upstream patches before release rather than applying the audit tool's incompatible SDK downgrade suggestion.

Next operator actions: provide hosting/DNS and production secrets; validate containers and off-host backup/alerts in staging; sign into the chosen Expo/Apple/Google accounts; configure HTTPS API environments; build/install development and preview apps; complete device/PDF/share/accessibility checks; choose internal/public distribution. Follow deployment.md and mobile-release.md. Unapproved business features remain separately listed in decisions.md.

No production-ready certification is claimed. Do not rerun a prototype reset, import old ledger records without reviewed mapping, or modify the protected reference checkout.
