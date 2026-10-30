-- Additive workflow; original purchases, payments and journals remain append-only.
ALTER TABLE inventory_unit ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE inventory_unit DROP CONSTRAINT inventory_unit_status_check;
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_unit_status_check
  CHECK(status IN ('IN_STOCK','SOLD','REVERSED','RETURNED'));
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check CHECK(kind IN (
 'opening','purchase','sale','collection','supplierPayment','expense','transfer',
 'contribution','withdrawal','loan','loanRepayment','advance','advanceRepayment',
 'salary','cashCount','reversal','stockEdit','purchaseReturn','supplierRefund'));
ALTER TABLE journal_line DROP CONSTRAINT journal_line_account_check;
ALTER TABLE journal_line ADD CONSTRAINT journal_line_account_check CHECK(account IN (
 'cash','bank','inventory','receivable','payable','revenue','cogs','expense',
 'equity','drawing','loan','advance','supplierReceivable'));
CREATE UNIQUE INDEX purchase_return_once ON document(unit_id) WHERE kind='purchaseReturn';
-- Existing RLS, owner access, API-role revocations and immutable triggers are retained.
