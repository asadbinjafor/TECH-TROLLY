-- The Nest API connects as the table owner. Browser/native clients never use Supabase Data API roles.
-- Restrict only this application's objects; do not change Supabase's auth/storage or unrelated tables.
DO $$
DECLARE
  object_name text;
  api_role text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY[
    'schema_migration','app_user','identity','session','auth_attempt','shop','party',
    'expense_category','document','inventory_unit','inventory_movement','journal_line',
    'allocation','cash_count','command_result','audit_event','salary_settlement'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',object_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',object_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',object_name,api_role);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH object_name IN ARRAY ARRAY[
    'document_number','unit_number','inventory_movement_id_seq','journal_line_id_seq',
    'allocation_id_seq','audit_event_id_seq'
  ] LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC',object_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM %I',object_name,api_role);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH object_name IN ARRAY ARRAY['immutable_record','balanced_document'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC',object_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM %I',object_name,api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
