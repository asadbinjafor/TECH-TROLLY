# Individual phone purchase and acquisition cycles — 2026-10-31

The Owner authorized implementation/deployment after analysis, confirmed buying back previously sold phones, and required every photographed seller-identity field with only two handwritten signatures blank.

## Accounting and compatibility

`individualPurchase` is a new strict transport command. PostingService records the existing `purchase` document kind so purchase reports, supplier payable allocations, returns and COGS/profit follow the same source. Existing purchase command shapes/defaults and persisted retry hashes are unchanged. Stock, private declaration/profile, journal, movement, result and audit commit in one serialized transaction. Authoritative money remains integer minor units.

Actual Cash + Bank paid cannot exceed merchandise cost; either input can stay blank. The remainder is supplier payable, separate from Personal DUE. Later supplierPayment targets the original purchase without another expense/inventory acquisition. Individual purchases do not silently add courier/repair cost; existing supplier purchase/expense workflows remain available.

Checked synthetic example: opening Cash/Bank 100,000 each; buy 60,000, pay Cash 40,000/Bank 15,000 => Cash 60,000, Bank 85,000, inventory 60,000/payable 5,000. Sell for 65,000 Cash, reacquire at 55,000 Cash => Cash 70,000, Bank 85,000, inventory 55,000/gross profit 5,000; original payable stays 5,000. Pay it from Bank => Bank 80,000/payable zero, unchanged profit. Sell second cycle for 58,000, receive Bank 57,000/customer due 1,000 => gross profit 8,000, Cash 70,000, Bank 137,000, inventory zero/customer receivable 1,000. A third all-credit acquisition/accepted supplier return offset their own payable without changing that customer due. Concurrent exact-cent postings also reconcile.

## Acquisition cycles

Migration 009 replaces global IMEI uniqueness with uniqueness among IN_STOCK rows and adds a previous acquisition link. Each cycle retains its own unit UUID/purchase/seller/cost/box/sale. Historical units/documents are not overwritten or deleted. Supplier purchases support reacquisition too. The shop lock and unique index prevent concurrent duplicate active stock. Old-sale reversal is blocked if later live acquisitions exist, including descendants separated by a reversed cycle; a later same-IMEI check covers identity corrections too. New purchases do not silently net old customer credit against new supplier debt.

Linked stock history uses already-authorized documents. Existing reasoned edits preserve original signed facts and affect future stock/sales; accepted returns/refund collection retain existing postings. Owner/all-date and Staff/today-only source access remain enforced.

## Private identity and print

Mandatory: seller name/phone, parents' names, present/permanent address, NID/driving licence and nominee name/phone. Box requires a deliberate with/without choice; old unspecified values stay unchanged. Other supplied phone specifications/accessories are optional. A seller is a supplier contact, not a new login role. Selecting a contact may autofill a protected profile for review.

Private identity resides in separate profile/declaration tables, not ordinary party rows or document/state snapshots. Explicit protected endpoints enforce date scope; Staff cannot autofill yesterday's private profile. NID/nominee/parents/extended addresses are absent from stock state, CSV and sales invoices. Tables retain RLS and revoke PUBLIC/Supabase Data API grants; Nest uses its existing table-owner connection. Declarations are immutable. Actor name/role and initial identity facts remain frozen despite later profile/contact edits.

The photographed seven-day clause is printed text, not an automatic warranty/refund/legal decision. No identity/signature image upload or signature reuse is implemented. Printed names are not handwritten signatures.

The shared one-page A4 renderer provides black/white vector branding, boxed date, filled phone/box/IMEI/price/identity and two empty 15 mm signature areas. An initial Cash/Bank/due line records partial payment explicitly. Web/native use the same protected API PDF via existing proxy/cookies. Later payments/stock edits remain in transaction history rather than rewriting the signed original; the screen explains this. Sales invoices retain two pages.

The server shares one PDF worker/bounded cache, blocks external fetches/page scripts, reauthorizes before cache access and validates complete content/exact A4 page count. Browser and server share measured font fitting for long values without consuming signature space. The dependency fingerprint includes purchase.ts and generated backend invoice-version.ts, keeping existing Render build filters effective for future template updates.

## Verification and limits

Local builds/typechecks and all 60 backend/PDF/isolated PostgreSQL checks plus 28 form/hosting checks passed before final UI/history/print-fit follow-ups; final release results are recorded in progress.md. Coverage includes populated-schema fingerprint preservation, rollback, retry/duplicate-key races, active IMEI uniqueness, buyback COGS/profit, old payable settlement, credit independence, returns, exact cents, private/date access, immutable snapshots and declarations. The obsolete acceptance test rejecting sold IMEIs now checks active stock duplicates; new tests cover valid reacquisition.

An explicitly owned `individual_flow_*_test` shop exercises real browser form/review/confirm/download, seller autofill, both box choices and split/Bank-only payments with blank Cash. The actual button download renders as one complete A4 page. Short, maximum Bengali and wide Latin values pass canonical PDF checks. Synthetic sample files/private evidence stay outside Git.

Physical printer scaling and pixel-identical photographic reproduction are not claimed. Print A4/Actual size/100%. No production business test entries are needed. Existing Git/CI hosting and startup migration runner remain the only release paths; no manual production SQL or competing pipeline.

Once new acquisition cycles exist, do not deploy an API older than migration 009's workflow guards. Its old reversal logic does not understand later cycles. Recover with a reviewed forward fix; retaining the database alone does not make an older API compatible.
## 2026-10-31 approved form/PDF correction

This follow-up supersedes the earlier required seller selector/permanent-address fields. New web/native forms use direct seller entry, an optional permanent address and a required birth date beside NID. Valid ISO calendar dates and Dhaka-today maximum are enforced; old private snapshots/retries may omit birth date. The optional schema fields have no defaults, preserving old parsed request hashes. Ordinary drafts drop stale supplier selectors; persisted pending commands bypass preparation and retain their exact payload/key.

The existing PostingService transaction links an exact active private NID/name/phone match only when unique, or creates a new basic Supplier with no private address. Contact creation, profile/declaration, journal, stock and command_result commit or roll back together. Failed insufficient-funds requests and concurrent duplicate retries are tested for orphan/duplicate contacts; a different identity with the same name/phone stays separate. Later supplier payment clears the original due without a second purchase. Birth date remains in private JSON tables under existing RLS, absent from ordinary state/reports/audit metadata. No migration, no old document rewrite and no production test postings.

All filled PDF text is bold, NID/birth date share a row, Tech Trolley spelling is corrected, and both handwritten signatures stay empty. Normal/maximum Bengali/wide Latin/legacy samples pass one-page A4 generation. Synthetic rasterized outputs were inspected. The approved combined batch also includes bounded visible PDF download preparation/retry/save and mobile 16px focus controls; physical device keyboard/browser-download/printing acceptance remains pending.
