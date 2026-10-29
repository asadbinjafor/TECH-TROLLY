# Verification — 2026-10-30 (Asia/Dhaka)

Executed against the new target only. The read-only reference and its credentials/data were never used for tests. Native/cloud release status is kept separate from compilation checks.

| Check | Result |
| --- | --- |
| `npm install` / single npm lockfile | Passed; SDK-compatible native dependencies installed and deduplicated |
| `npm run build` | Passed shared packages, Nest TypeScript and Next production build |
| `npm run typecheck` | Passed API, Next and native TypeScript |
| `TEST_DATABASE_URL=.../trolley_test; npm test` | Passed 10 tests (nine grouped scenarios plus parent), fresh uniquely named real PostgreSQL databases |
| `npm run export -w @tech-trolley/mobile` | Passed Android and iOS Hermes bundles, bundled logo/Bengali font |
| `npx expo install --check` | Dependencies up to date |
| `npx expo-doctor` in mobile directory | Passed 20/20 after resolving obsolete config/duplicate native dependency; dynamic config compatibility also checked |
| Repeatable `scripts/web-e2e.mjs` through CUA | Passed supplier → purchase → exact stock → draft preservation → sale → receipt → stock-out history; isolated localhost:3101 only |
| Browser desktop/mobile QA | English/light desktop, Bengali/dark 390px viewport; initial setup, leading-zero IMEI, acquisition cost/profit/due review, corrected receipt date |
| Backup → fresh restore | Passed pg_dump/pg_restore; document count and every journal balance exactly equal source, no unbalanced restored journals |
| Web/API production dependency audit | Zero advisories after Multer 2.5.0 / js-yaml 5.5.0 resolution |
| Full workspace dependency audit | Eight reported nodes remain in Expo build tooling (three high, five low): older CLI Zod and unpatched deepmerge chains; no unsupported SDK downgrade applied |
| Credential-content scan | Requested bootstrap email/password absent from tracked/intended text; ignored backend .env confirmed |
| Git pushes | Verified remote branch heads after each push; see progress log |

Acceptance scenarios exercise: fresh/idempotent/concurrent bootstrap and zero totals; forced password change; no public signup; Owner-created accounts; session reset/deactivation and last Owner; canonical monthly authorization and exports; exact brief B–F arithmetic; concurrent opening, sales, spending and collections; persisted duplicate request and changed-payload denial; real database fault/rollback/retry; leading-zero IMEI, accessories without fake IMEI, actual unit COGS/below-cost credit sales; loans/advances/salary; category historical labels and deliberately empty lists; immutable SQL records and linked corrections; cash count review flags; Dhaka midnight/month date grouping and carried balances; protected receipt omits cost/profit; generated OpenAPI purchase schema has no selling-price field.

The injected database failure emits one expected redacted `P0001` server error during the rollback test. It is not an unexplained failing check.

Browser automation evidence: [desktop empty shop](screenshots/web-desktop-empty.png), [Bengali dark mobile](screenshots/web-mobile-bengali-dark.png), [authorized receipt](screenshots/web-receipt.png). All transaction/customer/unit names in those populated QA captures are explicitly synthetic and remain outside the local application's fresh database.

Run the repeatable UI check from a supported CUA session after signing into the isolated browser fixture, set a desktop viewport, import `scripts/web-e2e.mjs`, and pass its bound tab to `runWebAcceptance(tab)`. It never resets data and refuses any URL outside the test port. It adds synthetic records only to that fixture. The isolated fixture creation was performed locally; it is not a production seed command.

Unexecuted/external checks: Docker image build/Compose runtime (Docker absent); signed Android APK/AAB and iOS IPA compilation (no Expo account/project/signing; Java/Android SDK absent locally); all physical-device installation, native keyboard/navigation/accessibility/file-share/PDF/print checks; actual OS-produced Bengali PDF rendering and printer paper checks; TestFlight/Play/App Store distribution; live HTTPS/cloud deploy, off-host backups and alerts. Bundle success and browser font rendering do not substitute for those checks.

Release status:

| Component | Implemented/built | Installed/tested/deployed/distributed |
| --- | --- | --- |
| Web | Implemented; production build and browser E2E pass | Local server verified; public deployment not performed |
| API | Implemented; build and PostgreSQL integration tests pass | Local server verified; public deployment not performed |
| Database | Explicit migrations executed; local/test data persists | Test backup and fresh restore pass; production database not provisioned |
| Android | Native code and JS bundle prepared | Signed APK/AAB not built; not installed, device-tested or distributed |
| iOS | Native code and JS bundle prepared | Signed IPA not built; not installed, device-tested or distributed |

This is a locally verified implementation with documented external release work, not a production-ready certification.
