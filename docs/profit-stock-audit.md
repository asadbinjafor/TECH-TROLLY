# Stock, profit and Staff access audit — 2026-10-30

Scope: the Owner's four requested changes and confirmation that Staff has today's accounting access while Owner has all dates. Canonical repository `E:\Taki`; the reference repository remains read-only.

| Request | Audit finding | Implemented result |
| --- | --- | --- |
| Separate Storage, Color and Variant | One combined `variant` input and column | Separate purchase inputs and stock columns, migration 006, immutable sale/receipt details; historical text preserved |
| Model and individual product profit | Aggregate daily/week/month revenue/COGS only | Dedicated Profit & expenses page, model totals sorted by gross profit, per-sale cost/net selling amount/profit/serial/seller statement |
| Start/end dates and monthly analysis | Only current presets and single-day date | Owner inclusive custom range plus today, trailing seven days and current month |
| Understand expense concentration | Total expenses without a breakdown | Category totals sorted by amount, individual expense reasons, salary and expensed procurement included |
| Write custom expenses | Existing required reason and category administration | Direct Other / custom expense choice with required name and reason; no category creation required |
| Staff stock/purchase/IMEI/cost | Already supported by shared PostingService and state | Retained, with separate new product fields and normal refreshed server state |
| Staff today's posting and download | Staff could read older days/week and state returned all documents | Server enforced today-only report/export, document/count state and receipt access; older corrections/settlements require Owner |
| Statement download | CSV contained documents and aggregate metrics | CSV also contains model and sale profit, categorized expenses/reasons and chronological cash/bank running balances; available to Staff for today |

Authoritative amounts stay integer minor units / BigInt. Report queries use one repeatable-read transaction. Profit uses journal revenue after discount less COGS, then operating expenses for net profit. Receivable collection, loans, funding and transfers do not generate sales profit. Signed corrections retain the original document link and affect their actual posting date. A correction of an older sale can therefore appear as negative current-period quantity/revenue/cost/profit. Opening funds are starting balances, not duplicate inflows. Merchandise purchases and cost of products sold are shown separately.

Legacy combined variant text and existing immutable documents/journals are not rewritten. No direct Supabase Data API access, backdating, new roles, bulk checkout or destructive stock edits were introduced. Stock costs and operating balances remain visible to Staff as requested; today's linked corrections can identify their older source document, without opening the prior day's report/receipt. Existing committed retry keys keep their results.

Verification: 16 isolated PostgreSQL tests pass, including model totals across variants, capitalized versus expensed courier, credit collection, custom expense validation/reasons, same-day and cross-day corrections, inclusive date validation, cash/bank reconciliation and direct Staff access denials. Four hosting/invoice tests and full builds/typechecks pass. Android/iOS bundles export. Browser QA used a separate synthetic database: Owner date-range CSV download, Staff stock cost/product fields, Staff custom-expense posting and updated today-only CSV, plus English desktop and Bengali 390px mobile layout checks. Real production business records were not used for tests. Native device installation/signing remains outside this change.
