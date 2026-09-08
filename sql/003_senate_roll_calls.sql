-- Senate roll-call votes.  2026-09-07.
--
-- congress.gov's vote API is House-only: /v3/house-vote answers the 117th,
-- 118th and 119th and there is no Senate endpoint at all.  The Senate publishes
-- its own XML instead — a list per session at
-- legislative/LIS/roll_call_lists/vote_menu_<congress>_<session>.xml and one
-- document per vote under roll_call_votes/vote<congress><session>/ — and that
-- is the only machine-readable source for how a senator voted.
--
-- Shaped after congress_house_votes so the roll-call pages read one thing.
-- Where the House says legislation_type/legislation_number, the Senate says
-- document_type/document_number, so both spellings are stored: the Senate's
-- verbatim, and congress.gov's translation of it beside, with the congress_key
-- that joins congress_bills.  A vote on a nomination (PN) or a motion carries
-- no bill and leaves those null.
--
-- Loaded by scripts/senate-votes/load.mjs.  See apps/web/docs/federal-sources.md.

create table if not exists congress_senate_votes (
  key                  text primary key,          -- "119-1-659"
  congress             integer not null,
  session_number       text not null,
  roll_call_number     text not null,
  vote_date            timestamptz,
  modify_date          timestamptz,
  question             text,
  vote_question_text   text,
  vote_title           text,
  vote_document_text   text,
  vote_result          text,
  vote_result_text     text,
  majority_requirement text,
  document_type        text,                      -- the Senate's own: PN, S, HR, SJRes…
  document_number      text,
  document_name        text,
  document_title       text,
  amendment_number     text,
  amendment_purpose    text,
  legislation_type     text,                      -- congress.gov's: HR, S, HRES…
  legislation_number   text,
  congress_key         text,                      -- "119-HR-1", where the vote is on a bill
  bill_id              bigint,                    -- the LegiScan adapter, where the mirror holds it
  yea                  integer,
  nay                  integer,
  present              integer,
  absent               integer,
  positions            integer,
  tie_breaker          text,
  source_url           text,
  payload              jsonb,
  updated_at           timestamptz not null default now()
);

create index if not exists congress_senate_votes_congress_idx on congress_senate_votes (congress, session_number, roll_call_number);
create index if not exists congress_senate_votes_key_idx on congress_senate_votes (congress_key);
create index if not exists congress_senate_votes_bill_idx on congress_senate_votes (bill_id);
create index if not exists congress_senate_votes_date_idx on congress_senate_votes (vote_date desc);

create table if not exists congress_senate_vote_positions (
  vote_key       text not null references congress_senate_votes (key) on delete cascade,
  lis_member_id  text not null,
  bioguide_id    text,
  people_id      bigint,
  member_full    text,
  first_name     text,
  last_name      text,
  vote_party     text,
  vote_state     text,
  vote_cast      text,
  updated_at     timestamptz not null default now(),
  primary key (vote_key, lis_member_id)
);

create index if not exists congress_senate_positions_member_idx on congress_senate_vote_positions (people_id);
create index if not exists congress_senate_positions_bioguide_idx on congress_senate_vote_positions (bioguide_id);
