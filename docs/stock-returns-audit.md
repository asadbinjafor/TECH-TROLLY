# Stock edits and supplier returns — 2026-10-30

The Owner initially approved implementation/local checks with a deployment hold, then explicitly requested deployment of the reviewed update. The normal production-branch/CI/hosting pipeline is now authorized. See progress.md for release verification. The individual-seller declaration discussion is excluded.

## Posting and history

`stockEdit` corrects unsold model/brand/storage/color/variant/category/condition/IMEI/battery/box with a reason and revision guard. It cannot edit cost, supplier, payments, status or original documents. PostingService stores a zero-money document with before/after snapshots, audit event and persisted command key. Future invoices use the corrected unit; original invoices/purchases stay frozen. Invalid/duplicate IMEI, stale revision and sold/returned stock are rejected atomically.

`purchaseReturn` records an accepted full-unit physical return. Enter the supplier-approved merchandise credit explicitly (zero through original merchandise price). Remove sellable stock, retain a RETURNED unit/history and linked negative movement. Apply the credit to that purchase's remaining payable first; carry the excess in separate supplierReceivable, not customer receivables. Expense acquisition cost not recovered: deductions plus capitalized courier. Previously expensed courier is not counted again. An unpaid return with a deduction can retain a payable for the agreed deduction.

`supplierRefund` records actual partial/full Cash/Bank receipts against the return. It decreases supplier receivable without revenue/profit. Persisted keys, due checks and the shop transaction lock prevent duplicate/over-collection. Return snapshots freeze earlier supplier payment IDs; those dependencies cannot be reversed afterward. Payments of a remaining deduction made after the return and refund receipts keep reasoned correction. Accepted returns/stock edits cannot be generically reversed or deleted.

All money uses integer minor units/BigInt, PostingService transactions and append-only documents/journal/allocations/movements. Migration 008 extends existing constraints/accounts, adds a revision and one-return index, and retains RLS and API-role revocations. No new application tables. Owner acts across dates; Staff retains today's-source purchase/return policy. Shared web/native forms have blank monetary inputs, mandatory reasons and return previews. Money separates supplier refund receivable; range reports/CSV include return credit, end-date refund balance, losses and dated receipts.

Historical return documents in a range report calculate their due using only allocations posted through that range's end date. A later refund therefore cannot silently reduce the past statement's receivable. Collection actions still use today's actual remaining due and the canonical current-state authorization.

## Evidence and limits

The isolated tests exercise a version-7-to-8 upgrade with existing records; metadata/invoice history, stale revisions and duplicate IMEIs; full/part/unpaid/zero-credit returns; courier/deductions; partial refunds; races, persisted retries, dependency corrections and forced journal failure rollback; Staff/anonymous denials. Full backend and hosting/form suites, builds and typechecks pass. Real browser buttons were exercised in an isolated synthetic shop, including Bengali 390px views. No synthetic transactions go into production or the persistent local shop.

Final checks: 34 backend and 28 hosting/form checks; API/web builds, all workspace typechecks and Android/iOS exports pass. One native export command was initially run from the workspace root and failed to find the mobile entry point; rerunning from tech-trolley-mobile produced both final bundles. Local backup/migration checks preserve all prior record hashes, and the persistent server remains ready. Temporary UI database/processes were cleaned up after verification.

Scope is supplier returns of unsold single units. Customer returns, warranty repair/exchange, arbitrary purchase-money edits, reversing an accepted return and reacquiring a returned phone under the same globally unique IMEI remain excluded. Native exports do not claim installed physical-device testing. Production push/deploy/migration remains pending explicit instruction; local backup and upgrade evidence are recorded in progress.md.
