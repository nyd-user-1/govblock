-- Top-two primaries, for the simulator.  2026-09-16.
--
-- Additive only: one new table. Brendan approved the election tables on 2026-09-16.
--
--   node scripts/clips/migrate.mjs sql/029_top_two.sql
--
-- Loaded by scripts/elections/load.mjs top-two from the FEC's "Federal
-- Elections" workbooks (2016–2022), which give every House and Senate
-- candidate's primary and general votes.

-- One race: every candidate who ran in any party's primary, the two who drew
-- the most primary votes across all parties, and the two who met in November.
create table if not exists top_two_races (
  year              smallint not null,
  state             text not null,
  office            text not null,             -- US HOUSE | US SENATE
  district          text not null default '',  -- '' for the Senate; House '0' at large
  label             text not null default '',  -- the FEC's own district label: 'S-Unexpired Term', '02-FULL'
  system            text not null,             -- party primaries | top-two | top-four | Louisiana open primary
  complete          boolean not null,          -- every November nominee of the two major parties had counted primary votes
  missing           text,                      -- why not: who ran unopposed, or was named at a convention
  candidates        jsonb not null,            -- [{ "name", "party", "primary", "mark", "general", "winner", "incumbent" }]
  top_two           text[],                    -- null when not complete
  top_two_parties   text[],
  general_two       text[] not null,
  general_winner    text,
  same_party        boolean,
  differs           boolean,                   -- the top two are not the two who met in November
  primary key (year, state, office, district, label)
);
create index if not exists top_two_races_year on top_two_races (year, office);
