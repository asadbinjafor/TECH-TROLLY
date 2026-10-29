# Requirement coverage

Paths below are relative to the canonical checkout. `P` means `tech-trolley-backend/src/accounts/posting.service.ts`; `W` means `tech-trolley-frontend/src/features`; `N` means `tech-trolley-mobile/src/features`. Shared command schemas/forms/types are in `packages/contracts`. This matrix maps implemented source and evidence; it does not label external release tasks completed.

| Brief area / confirmed behavior | API/database | Web | Native | Evidence / limits |
| --- | --- | --- | --- | --- |
| Read-only reference audit and original folder organization | docs/reference-structure.md, docs/audit.md | Existing frontend directory retained | Matching mobile addition | Source/tree/config reviewed; old Git/files unchanged |
| Required stack and one shared API | Nest modules, TypeORM PostgreSQL, versioned SQL | Next App Router/React/TS | Expo/RN/TS, native navigation | All typechecks, web/API builds; both JS bundles |
| Tech Trolley gold/charcoal, themes, eight screens | Same shared state | dashboard/workspace, globals.css | native-page, App.tsx | Desktop English and mobile Bengali/dark browser screenshots; devices untested |
| Bilingual labels/errors/receipts/exports | Shared codes, report CSV language | Shared i18n, bundled font | Shared i18n, bundled/embedded font | Visible Bengali UI/receipt checked; native PDF rendering unverified |
| Login only, two roles and private user creation | auth/, users/, identity constraints | auth/login, settings/administration | App Login, native-administration | API tests: no signup, unauthorized creation, Owner/Staff creation |
| Requested initial Owner and secure first change | auth/bootstrap.ts, server-only ignored env | Forced change UI | Forced change UI | Atomic/idempotent bootstrap, rerun preserves changed password; no secret committed |
| Password hashing, expiry/refresh/revocation/last Owner | bcrypt, hashed sessions, auth_attempt | HttpOnly cookie flow | SecureStore Bearer flow | Password/reset/deactivation revocation, last Owner and CSRF tests |
| Monthly capability Owner-only; preserve daily/week | reports.service canonical period policy | Owner monthly tab | Owner monthly control | Direct API/export denial, parameter rejection; inference limitation documented |
| Zero-data start; one-time opening; contributions | bootstrap has no business seed; P | Explicit opening notice/form | Explicit opening path | Fresh totals zero; concurrent opening one winner; opening not revenue/inflow |
| Exact units, IMEI string/unique, battery/box | inventory_unit constraints, P | Purchase form and stock filters | Same shared form/cards | Leading-zero IMEI, optional battery, accessory no IMEI, own cost tests |
| No purchase selling price; courier choice | Purchase contract, acquisition-cost posting | Shared purchase fields | Shared purchase fields | OpenAPI property check; capitalize and expense cases |
| Sale exact unit/blank price/reset stale inputs | Strict sale schema and locked stock | command-form | native-command | Browser blank inputs/draft flow; concurrent sale one winner |
| Discount/payment/due validation; loss allowed | BigInt validation; sale journal | Live net/due/profit review | Same preview and review | Reference numerical example; credit and below-cost sales |
| Stable parties/walk-in and immutable snapshots | party IDs, snapshots, one walk-in | Party manager/receipt | Party manager/receipt | Equal names not merged; walk-in created on demand; receipt snapshots |
| Atomic purchase/sale/receipt/settlement | P, deferred FKs, balanced journal | Durable result before receipt | Same client contract | Injected DB failure rollback; no partial document/journal |
| Customer/supplier dues paid against originals | allocation table, P | Money forms | Money forms | Example F, overcollection race, due/profit invariance |
| Expenses/categories add/rename/archive/restore | snapshots, unique active labels, audit | Settings manager, preserved form draft | More/categories, persisted draft | History rename/empty-list/bootstrap tests |
| Transfers/funding/drawings/loans/advances/salary | Separate accounts and allocations | Money/staff forms | Same workflows | Funding not profit, loan repayment, advance application, salary uniqueness |
| Daybook/calendar/carryforward/reconciliation | UTC instant, Dhaka date strings, report sums/count cutoff | Date picker/prev/next/today, panels | Native date picker/day cards | Date/month boundary and carryforward fixture tests; cash counts/review flags |
| Correct net/gross profit and stock valuation | Actual unit COGS, recognized expense | Overview/report cards | Same cards | Exact B–F amounts, unsold inventory not expense |
| Money precision and concurrency | bigint, global shop row lock | Decimal string input | Decimal numeric input | Excess precision rejected; stock/spending/dues races |
| Persisted idempotency/status recovery | command_result request hash/result | Frozen pending payload/session draft | Frozen pending payload/AsyncStorage | Duplicate same key one result, changed payload denied, failed retry recovers |
| Immutable history and reasoned corrections | append-only triggers, reversal links/dependency checks | Reverse form/history | Reverse form/history | SQL mutation rejected; dependent reversal blocked; stock corrected; count flagged |
| Authorized receipts and protected export | documents controller, capability-safe CSV | 80mm print CSS/PDF via browser | Native Print/Sharing and embedded font | Receipt no cost/profit; browser receipt verified; OS PDF/device output untested |
| Security and connectivity states | validation, CORS/Origin, Helmet, no-store, rate limit, redacted logs | Loading/forbidden/error/uncertain states | Same states; no offline posting | API authorization/CSRF, browser flow; device network tests remain |
| Deployment, backup, restore and CI | infra/, scripts/, workflow | Standalone Dockerfile | EAS profiles/build URL guard | DB dump/restore compared; Docker not installed; cloud inputs unavailable |
| Android APK/AAB and signed iOS | Shared API prepared | N/A | EAS development/preview/production | JS bundles only. EAS account and local Android SDK/JDK absent; no installed/distributed builds |
| Git workflow and handover | Canonical branch and verified pushes | Same integrated branch | Same integrated branch | docs/progress.md lists commits/remote verification; no default-branch merge |

Unconfirmed returns/refunds, bulk accessories, taxes, backdating, historical imports, camera scanning, branches and offline financial synchronization remain excluded in docs/decisions.md. They are not claimed as implemented features.
