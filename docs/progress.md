# Progress and release handover

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
