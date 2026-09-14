-- API keys and metering (2026-09-13), on Aurora's policy database. Idempotent.
-- Only a SHA-256 hash of a key is stored; the plaintext is shown once at
-- creation. key_prefix is "gb_" + 6 hex — enough to name a key, useless alone.
CREATE TABLE IF NOT EXISTS api_keys (
  id           text PRIMARY KEY,
  user_id      text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  key_prefix   text NOT NULL,
  name         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id);

-- One row per key per UTC day, bumped by one atomic upsert per request; a
-- month is SUM(count) over that month's rows, at most 31 per key.
CREATE TABLE IF NOT EXISTS api_usage (
  api_key_id text NOT NULL REFERENCES api_keys(id),
  day        date NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, day)
);

-- The plan a reader is on: free until Stripe exists, set by hand meanwhile.
ALTER TABLE reader_profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
