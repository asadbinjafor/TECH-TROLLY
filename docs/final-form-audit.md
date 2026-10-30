# Form and empty-selection audit — 2026-10-30

Scope: all 16 transaction commands, fixed and data-backed dropdowns, required/optional and conditional fields, contact/category/user/shop editors, login, report/date inputs, web/native parity and existing permission/accounting regressions. Empty optional fields are valid when their schema permits them. Empty stock, Staff and outstanding-document lists can reflect real business state and must not be populated with dummy production data.

## Findings and fixes

| Finding | Result |
| --- | --- |
| No stock, Staff, receivable/payable, loan or advance records left required dropdowns with only a placeholder | Localized source-specific explanation and prerequisites; Review disabled until the prerequisite exists |
| Fully paid walk-in sale showed a customer hint that sounded mandatory | Explicitly explain that saved Customer is optional for full payment |
| Customer for a credit sale was checked only at financial posting | Shared validation and required marker now request Customer before confirmation |
| Phone IMEI remained attached to a draft after changing to Accessory | Hide that field for Accessory and send null IMEI; retain its draft value if the user changes back to Phone; direct API schema remains strict |
| Cash/Bank and salary month unnecessarily began blank | Superseded by the Owner's later blank-input request: payment/discount inputs start empty; salary month still uses the server-supplied Bangladesh business date |
| Reversal options included opening, cash counts, reversal records and known dependent transactions | Exclude unsupported kinds, sold purchases, superseded sales and documents with allocated dues; authoritative API checks remain final, especially for incomplete old snapshots |
| A previously selected option could be removed/sold/settled by another action | Show unavailable-selection guidance and block a new submission while keeping the other input values |
| Input lengths differed from server constraints | Align product/contact/money/month limits, including native inputs and admin editors |
| Category and user PATCH returned PostgreSQL driver's update tuple instead of the saved object | CTE-backed consistent object response; user audit role/active values are present; safeUser continues to whitelist public account fields |
| Contact heading rendered the literal `parties` key | Add English/Bengali heading |

## Coverage

| Form group | Verification |
| --- | --- |
| Opening, contribution, withdrawal, transfer, cash count | Required blanks, amount/account choices, reason fields; mismatch reason required in UI; isolated accounting checks |
| Purchase | Required fields, three independent stock details, phone IMEI/battery validation, accessory null IMEI, supplier creation and selected draft preservation |
| Sale | Available stock, optional walk-in customer/contact fields, blank payment/discount defaults (later follow-up), credit Customer requirement, selected unit resets, invoice output |
| Collection / supplier payment / loan repayment / advance repayment | Correct outstanding source type, empty guidance, fixed accounts, stale selections; isolated settlement/overcollection checks |
| Loan / Staff advance / salary | Person/Staff sources, required reasons, current salary month, blank optional advance adjustment (later follow-up); existing salary uniqueness and permission checks |
| Correction | Allowed types, stock/dependency exclusions, required reason, immutable linked journal correction tests |
| Contacts / categories / users / shop / login | Optional contact values, length limits, create/update/archive/restore and duplicate handling; account response/audit values; existing authentication, last-Owner, revocation and same-origin checks |
| Reports / date filters | Existing inclusive range, invalid/future date, CSV/profit and Staff today-only tests retained |

Five form regression checks exercise every command's valid payload, every required blank input, every fixed dropdown option, every required empty source, English/Bengali field labels, conditional fields, stale selections and correction dependencies. Together with existing transport/invoice/readiness checks the hosting suite has **18 checks**. The PostgreSQL suite has **17 checks**, including actual financial workflows and permissions in a uniquely created disposable database.

The real 390px browser fixture verified empty stock; accessory purchase after changing from Phone with an existing IMEI; Supplier add and preserved draft; successful accessory posting; credit blocked without a Customer; successful full-payment walk-in sale with Bank zero and optional invoice contacts; and empty collection/supplier-payment/loan-repayment/advance/advance-repayment/salary guidance. Salary month is populated correctly; captured browser runtime errors were empty. One local development helper stopped during navigation and was restarted; the remaining empty-state checks completed in a fresh tab. No production test purchases, sales, contacts or categories were created.

No new migration, database reset, financial posting mechanism, business role, Supabase grants or hosting plan change. Pending idempotent retries continue using their saved payload/key rather than revalidating against changed dropdown choices. Financial and database constraints remain authoritative. Physical Android/iOS devices and every possible device/browser/network combination are not covered by this audit; a universal zero-bug guarantee is not claimed. Release evidence follows in progress.md.
