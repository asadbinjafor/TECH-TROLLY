-- Retention affects expired authentication counters only, never business data.
CREATE INDEX auth_attempt_expiry ON auth_attempt(reset_at);
