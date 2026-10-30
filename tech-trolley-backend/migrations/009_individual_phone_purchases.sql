-- Each inventory_unit is one acquisition cycle. Historical IMEIs/costs/documents
-- are retained; only one cycle of an IMEI may be physically in stock at a time.
ALTER TABLE inventory_unit DROP CONSTRAINT inventory_unit_imei_key;
CREATE UNIQUE INDEX inventory_one_active_imei ON inventory_unit(imei)
  WHERE imei IS NOT NULL AND status='IN_STOCK';
CREATE INDEX inventory_imei_history ON inventory_unit(imei) WHERE imei IS NOT NULL;
ALTER TABLE inventory_unit ADD COLUMN previous_unit_id uuid REFERENCES inventory_unit(id)
  CHECK(previous_unit_id IS NULL OR previous_unit_id<>id);
CREATE INDEX inventory_previous_cycle ON inventory_unit(previous_unit_id) WHERE previous_unit_id IS NOT NULL;

-- Identity data never enters party.*, ordinary document snapshots or stock state.
CREATE TABLE individual_seller_profile (
  party_id uuid PRIMARY KEY REFERENCES party(id),
  details jsonb NOT NULL CHECK(jsonb_typeof(details)='object'),
  updated_at timestamptz NOT NULL
);
CREATE TABLE purchase_declaration (
  document_id uuid PRIMARY KEY REFERENCES document(id),
  seller jsonb NOT NULL CHECK(jsonb_typeof(seller)='object'),
  terms text NOT NULL,
  buyer_role text NOT NULL CHECK(buyer_role IN ('OWNER','STAFF'))
);
CREATE TRIGGER purchase_declaration_immutable BEFORE UPDATE OR DELETE ON purchase_declaration
  FOR EACH ROW EXECUTE FUNCTION immutable_record();
DO $$
DECLARE object_name text; api_role text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY['individual_seller_profile','purchase_declaration'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',object_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',object_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',object_name,api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
