ALTER TABLE party ADD COLUMN is_walk_in boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX one_walk_in ON party(is_walk_in) WHERE is_walk_in;
ALTER TABLE inventory_unit DROP CONSTRAINT inventory_unit_status_check;
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_unit_status_check CHECK(status IN ('IN_STOCK','SOLD','REVERSED'));
DROP INDEX salary_once;
CREATE TABLE salary_settlement(staff_id uuid NOT NULL REFERENCES app_user(id),month text NOT NULL,document_id uuid UNIQUE REFERENCES document(id),PRIMARY KEY(staff_id,month));
INSERT INTO salary_settlement(staff_id,month,document_id) SELECT (d.snapshot->>'staffId')::uuid,d.snapshot->>'month',d.id FROM document d WHERE d.kind='salary' AND NOT EXISTS(SELECT 1 FROM document r WHERE r.reversal_of=d.id);
