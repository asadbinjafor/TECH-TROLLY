-- Small, re-encoded private purchase evidence. No image bytes in shop state,
-- financial snapshots, receipts or Supabase Data API. Included in DB backups.
CREATE TABLE purchase_image (
  id uuid PRIMARY KEY,
  uploader_id uuid NOT NULL REFERENCES app_user(id),
  purpose text NOT NULL CHECK(purpose IN ('memo','nidFront','nidBack')),
  source_hash text NOT NULL,
  content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 524288),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE purchase_image_link (
  image_id uuid PRIMARY KEY REFERENCES purchase_image(id),
  document_id uuid NOT NULL REFERENCES document(id),
  linked_by uuid NOT NULL REFERENCES app_user(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid REFERENCES app_user(id),
  removed_at timestamptz,
  CHECK((removed_by IS NULL)=(removed_at IS NULL))
);
CREATE INDEX purchase_image_document ON purchase_image_link(document_id);
CREATE TRIGGER purchase_image_immutable BEFORE UPDATE ON purchase_image
  FOR EACH ROW EXECUTE FUNCTION immutable_record();
DO $$
DECLARE object_name text; api_role text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY['purchase_image','purchase_image_link'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',object_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',object_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',object_name,api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
