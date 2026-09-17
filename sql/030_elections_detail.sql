-- Election history, competition and seats against votes.  2026-09-16.
--
-- Additive only: three new columns on each results table and three new
-- tables. Brendan approved the election tables on 2026-09-16.
--
--   node scripts/clips/migrate.mjs sql/030_elections_detail.sql
--
-- Loaded by scripts/elections/load.mjs (klarner, fec, chambers, members).

-- Who a result belongs to and how it ended. candidate_id is the source's own
-- person key: Klarner's candid for state legislators, the FEC candidate id
-- for Congress; it is what joins a result to a member.
alter table election_results add column if not exists candidate_id text;
alter table election_results add column if not exists incumbent boolean;
alter table election_results add column if not exists won boolean;

-- The district plan a race was run under (Klarner's regime: the year the
-- plan took effect) and whether any incumbent ran.
alter table election_races add column if not exists regime text;
alter table election_races add column if not exists open_seat boolean;
alter table election_races add column if not exists post text;

-- One chamber in one cycle: how many of its seats anyone contested, how many
-- were safe, and how the seats each party won compare with its votes.
create table if not exists chamber_results (
  year              smallint not null,
  state             text not null,
  office            text not null,              -- STATE HOUSE | STATE SENATE | US HOUSE
  seats_up          smallint not null,
  uncontested       smallint not null,          -- seats with no more candidates than seats
  safe              smallint not null,          -- uncontested, or won by 20 points or more
  close             smallint not null,          -- won by less than 5 points
  open_seats        smallint,
  dem_seats         smallint not null,
  rep_seats         smallint not null,
  other_seats       smallint not null,
  dem_votes         bigint,                     -- two-party votes in single-seat contests, uncontested seats counted at 75–25
  rep_votes         bigint,
  dem_vote_share    real,                       -- percent of the two-party vote
  dem_seat_share    real,                       -- percent of the seats the two parties won
  efficiency_gap    real,                       -- percent; positive favours Republicans
  gap_seats         real,                       -- the gap in seats
  excluded_seats    smallint not null default 0,-- free-for-all multi-member seats left out of the gap
  source            text not null,
  primary key (year, state, office)
);

-- A member's elections, for their page: every primary and general they ran
-- in that the sources hold, with the result and who else ran.
create table if not exists member_elections (
  people_id    bigint not null,
  year         smallint not null,
  state        text not null,
  office       text not null,
  district     text not null default '',
  stage        text not null,                   -- GEN | PRI
  party        text,
  votes        bigint,
  share        real,
  won          boolean,
  incumbent    boolean,
  unopposed    boolean,
  opponents    jsonb not null default '[]',     -- [{ "name", "party", "votes" }]
  source       text not null,
  primary key (people_id, year, office, district, stage)
);
create index if not exists member_elections_people on member_elections (people_id, year desc);
