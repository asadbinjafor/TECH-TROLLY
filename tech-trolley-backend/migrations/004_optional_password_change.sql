-- Owner-requested login policy: changing a password is optional.
-- Preserve password hashes, identities, roles, sessions and all business records.
ALTER TABLE app_user ALTER COLUMN must_change SET DEFAULT false;
UPDATE app_user SET must_change=false WHERE must_change;
