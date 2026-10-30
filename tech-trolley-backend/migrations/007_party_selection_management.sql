-- Archive selection entries while keeping references and immutable documents.
ALTER TABLE party ADD COLUMN active boolean NOT NULL DEFAULT true;
