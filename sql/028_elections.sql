-- Election results, for the simulator.  2026-09-16.
--
-- Additive only: three new tables. Brendan approved the tables on 2026-09-16.
--
--   node scripts/clips/migrate.mjs sql/028_elections.sql
--
-- Loaded by scripts/elections/load.mjs. The public files it reads:
--   MIT Election Data + Science Lab, Harvard Dataverse (House, Senate and
--   President 1976–2024; state and House precinct returns 2022 and 2024)
--   Otis, "Single winner ranked choice voting CVRs", doi:10.7910/DVN/AMK8PJ, CC0

-- One ranked-choice contest, recounted from its ballots. The ballots
-- themselves stay in the lake (lake/v1/elections/rcv-ballots/); the distinct
-- rankings and how many ballots cast each are a public file at profile_url,
-- which the simulator fetches when a reader opens the contest and recounts in
-- the browser.
create table if not exists rcv_contests (
  id                  text primary key,          -- newyorkcity-2025-06-24-dem-mayor
  file                text not null unique,      -- the ballot file's name in the lake
  jurisdiction        text not null,             -- New York City
  state               text not null,             -- NY
  level               text not null,             -- city | county | state | federal | territory
  election_date       date not null,
  office              text not null,             -- Mayor
  party               text,                      -- the primary's party; null for a general
  special             boolean not null default false,
  title               text not null,
  candidates          text[] not null,           -- most first choices first
  ballots             integer not null,          -- ballots ranking at least one candidate
  ranks               smallint not null,         -- how many rankings the ballot allowed
  rounds              jsonb not null,            -- [{ "votes": [n per candidate, null once out], "exhausted": n, "out": i }]
  winner              text not null,
  first_round_leader  text not null,
  comeback            boolean not null,          -- the winner was not ahead on first choices
  condorcet_winner    text,                      -- beats every rival head to head; null when none does
  profiles            integer not null,          -- distinct rankings
  profile_url         text not null,
  loaded_at           timestamptz not null default now()
);
create index if not exists rcv_contests_state_date on rcv_contests (state, election_date desc);

-- A candidate's votes in one race, as MIT publishes them: district returns for
-- Congress and the presidency, and precinct returns summed to the district for
-- state legislative seats.
create table if not exists election_results (
  source     text not null,              -- medsl-house | medsl-senate | medsl-president | medsl-state-2022 | medsl-state-2024 | medsl-house-precinct-2022 | …
  year       smallint not null,
  state      text not null,              -- postal code
  office     text not null,              -- US HOUSE | US SENATE | US PRESIDENT | STATE HOUSE | STATE SENATE
  district   text not null default '',   -- '' statewide; House '0' at large
  stage      text not null,              -- GEN | PRI | RUNOFF
  special    boolean not null default false,
  candidate  text not null,
  party      text not null default '',
  writein    boolean not null default false,
  votes      bigint not null,
  primary key (source, year, state, office, district, stage, special, candidate, party)
);

-- One race: who won, by how much, and whether anyone ran against them.
create table if not exists election_races (
  year            smallint not null,
  state           text not null,
  office          text not null,
  district        text not null default '',
  stage           text not null,
  special         boolean not null default false,
  seats           smallint not null default 1,
  candidates      smallint not null,
  total_votes     bigint not null,
  winners         text[] not null,
  winner_party    text,
  winner_share    real,                  -- percent of the race's votes
  runner_up       text,
  runner_up_party text,
  margin          real,                  -- points between the last seat won and the first lost; null when uncontested
  contested       boolean not null,
  source          text not null,
  primary key (year, state, office, district, stage, special)
);
create index if not exists election_races_office_year on election_races (office, year);
