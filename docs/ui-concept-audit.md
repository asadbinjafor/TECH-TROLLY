# Approved UI concept implementation — 2026-11-02

The Owner requests implementation, audit and deployment of the generated Tech Trolley concept: light desktop Dashboard, dark mobile Dashboard and light mobile personal-loan cards. The reference is a visual direction, not permission to introduce new accounting or change access. The existing shop logo, routes, bilingual copy, real saved data, reporting, form rules and protected balance reveal remain authoritative.

## Result

- Gold/charcoal surfaces, rounded cards, subtle shadows, semantic metric icons and four colored Quick actions follow the concept. Shared screen styling keeps existing workspace pages visually consistent.
- Cash is a dark hero and Bank a light hero. The top-right disclosure retains opening balances and actual inflow/outflow details. Dashboard values and recent transaction amounts remain masked until the existing account-password verification succeeds.
- Mobile has four route links with a visible active state. New sale is a full-width Dashboard action above them and remains available from its dedicated workspace page. Reconcile stays on Dashboard; its mobile icon retains an accessible name.
- DUE retains exact existing totals, search, unpaid/all filters, archived history, original-loan selection, Staff scope and repayment commands. New summary/person cards display the same data, including long names and the non-reversed original Cash/Bank source. The explanation remains below the account list.
- Existing forms retain linked labels, inline rose Optional markers, 48px controls, actual 16px mobile text, numeric keyboard hints, review, pending idempotent payloads and navigation handling.
- New CSS is screen-only. No invoice renderer, backend, native source, schema, deployment filter or dependency changes.

## Evidence from running checks

All data used here belongs to a freshly initialized, task-owned PostgreSQL cluster on loopback port 55550. The database has a unique `uiconcept_ui_…_test` name, API port 3370 and Web port 3371. It is unrelated to the user's existing local or production databases. Private artifacts are in `.local/ui-concept-20261102-69c1600d/` and excluded from Git.

| Check | Actual result |
| --- | --- |
| `npm test` with explicit isolated PostgreSQL | 80 passed, zero failed/cancelled/skipped; permissions, journals, idempotency, concurrent sale, rollback, historical onboarding and canonical PDF regressions |
| `npm run test:hosting` | 39 passed; form rules, navigation layers, pending sales and readiness |
| `npm run typecheck` | All shared/API/Web/native workspaces passed |
| `npm run build` | Shared/API and optimized Web build passed, all 16 routes generated |
| Synthetic API/accounting scenario | Owner/Staff account creation and server permissions, Staff week/month/range rejection, purchases/sale/expense/payment/transfer/loans; competing sale returns exactly one 201 and one 409 |
| Browser repayment from new person card | Choose original Rafi QA loan, review and post 500 Cash; Cash rises 500, loan receivable falls 500, profit unchanged |
| Browser sale from new Dashboard | 15,000 Cash, blank Bank/Discount and walk-in; Save sale without printing closes the form without receipt; unit becomes SOLD, inventory falls 10,000, profit rises 5,000 |
| Financial readback after both UI commands | Cash 96,550; Bank 58,000; inventory 2,000; customer receivable 2,000; supplier payable 7,000; personal loan receivable 24,000; net profit 16,550; zero unbalanced journals |
| Dashboard reveal | Wrong synthetic password rejected; correct password shows exact values; opening/in/out disclosure works; hide and later route/reload show masks again |
| DUE filters | Cleared account appears under All, name search finds it; repayment/history remain available |
| Overview responsive geometry | 1440, 768, 390 and 320px widths: no root overflow; four metric cards retained; four mobile route links |
| DUE responsive geometry | Bengali dark at 320, 768 and 1280px; long names wrap inside cards. A 320px amount wrapping its currency suffix was corrected with smaller icon/amount typography and visually rechecked |
| Workspace route smoke checks | Loaded Inventory, Purchases, Transactions, Money, DUE, Staff, Reports, Profit, Settings, Sale and Daybook at 390px: no root/panel horizontal overflow |
| Form geometry | Purchase, individual purchase, sale, expense, transfer and loan dialogs: no horizontal overflow; ordinary controls 48px/16px, dark Optional color `#eda4ae` |
| Browser console | No warning/error entries in the final inspected local page |

The first route-loop observation caught startup placeholders rather than loaded pages and was discarded; retained results wait for `.app h1`. One temporary assertion initially used lowercase `sold`, corrected to the actual `SOLD` contract before the successful result. Neither was an application defect.

## Limits and release

Viewport checks use in-app Chromium, not physical iOS Safari or Android Chrome. Installed native binaries, device keyboards, physical printing, assistive-technology testing and every conceivable money/name length are not claimed. Native code is unchanged. The implementation follows the concept while retaining approved controls and records; identical pixels across different devices/fonts are not claimed.

The optimized build was also signed into using the same isolated fixture, with production HTTPS enforcement retained through a loopback TLS gateway and a certificate trusted only by the test child process. A direct HTTP upstream correctly returned `API_CONFIGURATION_REQUIRED` before that test gateway was supplied. No application TLS check was bypassed. Production screenshots confirm desktop opening details expanded, mobile details collapsed, masks retained and the mobile New sale button above the fixed navigation at 390×844. Git/CI/live verification is recorded in `progress.md`. Deployment follows the existing branch/Vercel integration. Unchanged API dependencies should leave Render on `147fd41`; no Supabase migration or real business posting is needed. No lint command is configured in the existing workspace; none was invented or claimed.
