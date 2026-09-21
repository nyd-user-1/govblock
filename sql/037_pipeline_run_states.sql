-- The Database dashboard's run log: what each run did for each jurisdiction it
-- owned (Brendan, 2026-09-20: "a run log table that shows all the work you just
-- did per state"). A throwaway box leaves only its log in S3, and the next run
-- of the same name overwrites it; scripts/pipeline/launch.mjs `ledger` reads
-- every finished run's log while it is there and writes a row a jurisdiction
-- here, keyed by the run's name and the moment its box first reported.
create table if not exists "PipelineRunStates" (
  run text not null,
  started timestamptz not null,
  state text not null,
  mode text,
  finished timestamptz,
  exit int,
  discover_source text,
  discover_result text,
  discover_exit int,
  fetch_source text,
  considered int,
  stored int,
  skipped int,
  note text,
  primary key (run, started, state)
);
