-- What Aurora held at a moment, so the Database dashboard's tiles can say what a
-- day's runs added (Brendan, 2026-09-20: "a change in the stat cards with a
-- corresponding diff stat"). The tiles' change numbers were removed on
-- 2026-09-06 because nothing consistent stood behind them: a count of rows
-- fetched in a day counts New York's 42,645 unchanged rows, re-stamped by every
-- run, as new. A snapshot is the honest base. scripts/pipeline/launch.mjs writes
-- one before every launch; the tiles compare with the first snapshot of the
-- last 24 hours, which is the record as it stood before the day's runs began.
create table if not exists "CorpusSnapshots" (
  at timestamptz primary key default now(),
  bills int,
  texts int,
  texts_filled int,
  documents int,
  rollcalls int,
  people int,
  note text
);

-- The same, a row a jurisdiction, for the dashboard's Updates chart: each
-- jurisdiction's bills and bills holding text now, less what it held before the
-- span's first run. Counting rows stamped in a day cannot say this: the Volume
-- chart drew the 3.5M-text backfill of August 30 and nothing of a fleet that
-- added 853 bills across 52 jurisdictions on September 20.
create table if not exists "CorpusSnapshotStates" (
  at timestamptz not null,
  state text not null,
  bills int not null,
  with_text int not null,
  primary key (at, state)
);
