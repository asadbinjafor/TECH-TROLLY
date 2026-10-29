CREATE TABLE app_user (
 id uuid PRIMARY KEY, name text NOT NULL, login text NOT NULL UNIQUE, email text UNIQUE,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('OWNER','STAFF')),
 active boolean NOT NULL DEFAULT true, must_change boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity (value text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id));
CREATE TABLE session (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id),
 expires_at timestamptz NOT NULL, absolute_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_user ON session(user_id);
CREATE TABLE auth_attempt(key text PRIMARY KEY,count integer NOT NULL,reset_at timestamptz NOT NULL);
CREATE TABLE shop (
 id integer PRIMARY KEY CHECK(id=1), name text NOT NULL DEFAULT 'Tech Trolley',
 address text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',
 bootstrapped boolean NOT NULL DEFAULT false, opened_at timestamptz, opening_date date
);
INSERT INTO shop(id) VALUES(1);
CREATE TABLE party (id uuid PRIMARY KEY,name text NOT NULL,phone text NOT NULL DEFAULT '',kind text NOT NULL CHECK(kind IN ('supplier','customer','person')));
CREATE TABLE expense_category(id uuid PRIMARY KEY,bn text NOT NULL,en text NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE UNIQUE INDEX expense_category_bn ON expense_category(lower(bn)) WHERE active;
CREATE UNIQUE INDEX expense_category_en ON expense_category(lower(en)) WHERE active;
CREATE SEQUENCE document_number;
CREATE SEQUENCE unit_number;
CREATE TABLE document (
 id uuid PRIMARY KEY, number text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('opening','purchase','sale','collection','supplierPayment','expense','transfer','contribution','withdrawal','loan','loanRepayment','advance','advanceRepayment','salary','cashCount','reversal')),
 actor_id uuid NOT NULL REFERENCES app_user(id),actor_name text NOT NULL,
 created_at timestamptz NOT NULL, business_date date NOT NULL,
 total bigint NOT NULL CHECK(total>=0), original_due bigint NOT NULL DEFAULT 0 CHECK(original_due>=0),
 party_id uuid REFERENCES party(id),unit_id uuid,
 snapshot jsonb NOT NULL, reversal_of uuid UNIQUE REFERENCES document(id)
);
CREATE INDEX document_date ON document(business_date,created_at);
CREATE INDEX document_party ON document(party_id);
CREATE UNIQUE INDEX salary_once ON document((snapshot->>'staffId'),(snapshot->>'month')) WHERE kind='salary';
CREATE TABLE inventory_unit (
 id uuid PRIMARY KEY,internal_id text NOT NULL UNIQUE,model text NOT NULL,brand text NOT NULL,variant text NOT NULL,
 category text NOT NULL CHECK(category IN ('phone','accessory')),condition text NOT NULL CHECK(condition IN ('new','used','refurbished')),
 imei text UNIQUE CHECK(imei ~ '^\d{15}$'),battery integer CHECK(battery BETWEEN 0 AND 100),
 box text NOT NULL CHECK(box IN ('with','without','unspecified')),cost bigint NOT NULL CHECK(cost>0),
 status text NOT NULL CHECK(status IN ('IN_STOCK','SOLD')),purchase_id uuid NOT NULL REFERENCES document(id),sale_id uuid REFERENCES document(id),
 CHECK((category='phone' AND imei IS NOT NULL) OR (category='accessory' AND imei IS NULL))
);
ALTER TABLE document ADD CONSTRAINT document_unit FOREIGN KEY(unit_id) REFERENCES inventory_unit(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE inventory_movement(id bigserial PRIMARY KEY,unit_id uuid NOT NULL REFERENCES inventory_unit(id),document_id uuid NOT NULL REFERENCES document(id),delta integer NOT NULL CHECK(delta IN (-1,1)));
CREATE INDEX inventory_status ON inventory_unit(status);
CREATE TABLE journal_line (
 id bigserial PRIMARY KEY,document_id uuid NOT NULL REFERENCES document(id),
 account text NOT NULL CHECK(account IN ('cash','bank','inventory','receivable','payable','revenue','cogs','expense','equity','drawing','loan','advance')),
 amount bigint NOT NULL CHECK(amount<>0)
);
CREATE INDEX journal_document ON journal_line(document_id);
CREATE INDEX journal_account ON journal_line(account);
CREATE TABLE allocation (
 id bigserial PRIMARY KEY,document_id uuid NOT NULL REFERENCES document(id),target_id uuid NOT NULL REFERENCES document(id),amount bigint NOT NULL CHECK(amount<>0),
 CHECK(document_id<>target_id)
);
CREATE INDEX allocation_target ON allocation(target_id);
CREATE TABLE cash_count (
 document_id uuid PRIMARY KEY REFERENCES document(id),expected bigint NOT NULL,counted bigint NOT NULL CHECK(counted>=0),
 difference bigint NOT NULL,cutoff bigint NOT NULL,needs_review boolean NOT NULL DEFAULT false
);
CREATE TABLE command_result (
 actor_id uuid NOT NULL REFERENCES app_user(id),key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,
 PRIMARY KEY(actor_id,key),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_event(id bigserial PRIMARY KEY,actor_id uuid REFERENCES app_user(id),action text NOT NULL,subject_id text,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Append-only record'; END $$;
CREATE TRIGGER document_immutable BEFORE UPDATE OR DELETE ON document FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON journal_line FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER allocation_immutable BEFORE UPDATE OR DELETE ON allocation FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER movement_immutable BEFORE UPDATE OR DELETE ON inventory_movement FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE FUNCTION balanced_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT COALESCE(sum(amount),0) FROM journal_line WHERE document_id=NEW.document_id)<>0 THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON journal_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION balanced_document();
