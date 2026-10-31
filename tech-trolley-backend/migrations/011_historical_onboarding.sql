-- A one-time, Owner-controlled opening and dated catch-up workflow.
-- No existing business rows or immutable journals are rewritten.
ALTER TABLE shop
 ADD COLUMN history_active boolean NOT NULL DEFAULT false,
 ADD COLUMN history_from date,
 ADD COLUMN history_to date,
 ADD COLUMN history_last_date date,
 ADD COLUMN history_locked boolean NOT NULL DEFAULT false,
 ADD COLUMN history_version integer NOT NULL DEFAULT 0 CHECK(history_version>=0),
 ADD COLUMN history_finished_at timestamptz;
ALTER TABLE shop ADD CONSTRAINT history_dates CHECK (
 (history_from IS NULL AND history_to IS NULL AND history_last_date IS NULL
   AND NOT history_active AND NOT history_locked AND history_finished_at IS NULL)
 OR (history_from IS NOT NULL AND history_to IS NOT NULL AND history_last_date IS NOT NULL
   AND opened_at IS NOT NULL AND opening_date=history_from
   AND history_from<=history_last_date AND history_last_date<=history_to
   AND (history_active OR (history_locked AND history_finished_at IS NOT NULL))));
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check CHECK(kind IN (
 'opening','purchase','sale','collection','supplierPayment','expense','transfer',
 'contribution','withdrawal','loan','loanRepayment','advance','advanceRepayment',
 'salary','cashCount','reversal','stockEdit','purchaseReturn','supplierRefund',
 'openingStock','openingDue','openingAdjustment','historyLock','historyFinish'));
-- Existing RLS, revoked Data API grants and append-only triggers are retained.
