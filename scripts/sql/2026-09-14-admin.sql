-- Admin (Brendan, 2026-09-14): a flag on the profile row that no API writes.
-- An admin opens everything the rule would gate, and still sees the gate card
-- with a close cross so the gating can be checked by eye. Set by hand:
--
--   update reader_profiles set admin = true where email = '…';
--
-- Ran on Aurora 2026-09-14.
alter table reader_profiles add column if not exists admin boolean not null default false;
