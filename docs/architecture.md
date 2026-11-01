# Architecture and API

One npm workspace and lockfile retain the reference's two application directories, with `tech-trolley-mobile` and the shared contracts/API client/i18n/design tokens/invoice packages added. Node 24.17.0/npm 12.0.2 were used locally. Locked versions include Next.js 16.4.3, React 19.3.0, NestJS 11.2.8, TypeORM 0.3.31, Expo 58.0.22 and React Native 0.88.1. Native dependencies came from the SDK 58 template and `expo install`; no forced root React override is used.

Nest modules cover authentication, users, shop, parties, expenses/categories, accounts/posting, reports and documents. Financial command handlers live together in `accounts/posting.service.ts` because purchases, sales, settlements, loans, advances, salaries, opening, counts and reversals must share the same transaction boundary. SQL persistence is explicit through TypeORM EntityManager rather than auto-synchronized entity schemas. Feature directories follow the reference. Future larger domains can extract handlers without bypassing the posting service.

All authoritative money is integer BDT minor units in PostgreSQL bigint and JavaScript BigInt. HTTP input/output is decimal strings with zero to two decimal places. Excess precision is rejected, not rounded inconsistently. Display-only Intl formatting uses Number. Phone IMEI is a string of exactly 15 digits; accessories are individually tracked without an IMEI. Physical units retain their own acquisition costs.

The shop row is locked before every financial command. That serializes this single shop's postings and coordinates opening, inventory, spending and settlement checks. User activity is rechecked under a shared row lock. Transactions contain immutable documents, journal lines, stock movements, payment allocations, audit events and the saved idempotency result. Deadlocks/serialization failures retry the whole transaction at most three times. PostgreSQL deferred triggers independently reject unbalanced journals. No posted document, journal, allocation, stock movement or audit event can be updated/deleted through normal SQL; corrections append linked documents.

Schema: app_user/identity/session/auth_attempt; singleton shop; party/expense_category; document/inventory_unit/inventory_movement; journal_line/allocation; salary_settlement; cash_count; command_result/audit_event; private individual_seller_profile/purchase_declaration; schema_migration. Unique constraints protect login/email aliases, active in-stock IMEI, invoice/internal numbers, active salary/month settlement and reversal identity. Separate acquisition cycles allow a previously sold/returned phone to be bought again. Foreign keys preserve document lineage. Numeric document sequences may have gaps after rollbacks.

Debit-positive accounts: cash, bank, inventory, receivable, loan, advance, cogs, expense and drawing. Credit-negative accounts: payable, revenue and equity. Every command sums to zero. Balances are derived from journal lines; subledger due is original_due minus allocations. Expense categories and unit/customer/supplier data are snapshotted at posting. Unsold purchases remain inventory; collections and funding do not become revenue. Initial balances are equity. Walk-in identity is created only on the first fully paid unnamed sale and reused; it is excluded from selectable credit customers.

Ordinary posting derives UTC timestamptz and the Dhaka business date from one database instant; supplied businessDate is rejected outside the approved one-time historical setup. During that Owner-only setup, real in-range nondecreasing business dates are accepted while created_at/actor remain actual. PostgreSQL DATE values are parsed as calendar strings to prevent UTC date shifts. Report bounds are canonical: selected daily date, trailing seven days, current calendar month or inclusive custom range. Staff can request only today. Initial opening is included in period opening money, not money received today. Repeatable-read state snapshots keep balances and documents consistent within a response. See historical-accounts-bn.md for the setup lifecycle.

Client drafts never post offline. Mutations use a persisted UUID idempotency key and frozen payload before submission. On timeout/server uncertainty clients retain it and offer status recovery/retry. Successful server results alone trigger final receipts. Drafts use web sessionStorage/native AsyncStorage; credentials use HttpOnly cookies/native SecureStore. Reads refresh every 30 seconds and on resume; sessions refresh every 15 minutes within their absolute lifetime.

API surface (OpenAPI UI `/openapi`, JSON `/openapi.json`):

| Endpoint | Purpose |
| --- | --- |
| POST /auth/login, /password, /refresh, /logout; GET /auth/me | Login-only lifecycle |
| GET/POST /users; PATCH /users/:id | Owner account administration |
| GET /shop/state; PATCH /shop | Shared authenticated state, Owner shop details |
| POST /parties; PATCH/DELETE /parties/:id; PATCH /parties/:id/active | Stable supplier/customer/person contact; edit/archive/restore without losing history |
| POST /expense-categories; PATCH /expense-categories/:id | Create/rename/archive/restore categories |
| POST /commands/:kind | Validated atomic financial intent, Idempotency-Key required |
| GET /commands/status/:key | Current actor's durable saved result |
| GET /reports?period=today\|week\|month\|range | date only for daily; from/to required for range; Staff today-only |
| GET /reports/export | Same bounds/permissions; formula-safe CSV |
| GET /documents/:id/receipt | Authorized customer receipt without cost/profit |
| GET /documents/:id/pdf | Canonical protected two-page A4 sales PDF |
| GET /purchases/:id/declaration, /pdf | Protected private purchase facts and one-page A4 declaration |
| GET /health | Database/migration availability |

Request schemas for command paths are generated directly from the same Zod contracts imported by the typed API client. Acceptance tests inspect the generated purchase schema. Server validation remains authoritative.

Official references rechecked during implementation: [Next installation](https://nextjs.org/docs/app/getting-started/installation), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction), [authorization](https://docs.nestjs.com/security/authorization), [PostgreSQL exact numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html), [locking](https://www.postgresql.org/docs/current/explicit-locking.html).
