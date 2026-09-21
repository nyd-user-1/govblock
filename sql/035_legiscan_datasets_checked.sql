-- The dataset ledger records when a session was last LOOKED AT, not only when it
-- was last imported (2026-09-20). livingston's scripts/box/national-sweep.mjs
-- compares every session's hash with LegiScan's and imports only what moved; a
-- legislature that has gone home never moves, so imported_at alone read it as a
-- feed gone dark and the Database dashboard's dot went red on a state that had
-- been checked an hour earlier. The sweep stamps checked_at on every session it
-- compares and finds unchanged; the dashboard reads the newer of the two.
-- The sweep adds the column itself if it is missing; this file is the record.
alter table "LegiscanDatasets" add column if not exists checked_at timestamptz;
