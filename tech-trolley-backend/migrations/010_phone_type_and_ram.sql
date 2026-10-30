-- Unknown historical specifications stay unknown. Never infer an OS from a name.
ALTER TABLE inventory_unit ADD COLUMN phone_type text;
ALTER TABLE inventory_unit ADD COLUMN ram text;
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_phone_type
  CHECK (phone_type IS NULL OR (category='phone' AND phone_type IN ('android','iphone')));
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_phone_ram
  CHECK (ram IS NULL OR (phone_type IS NOT NULL AND phone_type='android' AND ram IN ('4 GB','8 GB','12 GB','16 GB')));
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_android_ram
  CHECK (phone_type IS DISTINCT FROM 'android' OR ram IS NOT NULL);
ALTER TABLE inventory_unit ADD CONSTRAINT inventory_phone_storage
  CHECK (phone_type IS NULL OR storage IN ('64 GB','128 GB','256 GB','512 GB','1 TB','2 TB'));
-- Existing inventory RLS and Data API grant revocations continue to apply.
