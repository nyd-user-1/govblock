-- Clips: every short video on /clips, whatever made it.  2026-09-14, clips window.
--
-- Additive only: three new tables and their indexes.  No change to any table
-- the site reads.  Numbered 020 to stay clear of the XML window's 005–012.
--
--   node scripts/clips/migrate.mjs sql/020_clips.sql
--
-- The video itself is in Cloudflare Stream (lib/policy/cloudflare-stream.ts);
-- a row here is what the record knows about it: its origin, its desk, and
-- what it is keyed to, as the record's own ids and never as free text.

-- ------------------------------------------------------------------- clips

create table if not exists clips (
  id                 text primary key,             -- 'clp_' + 16 hex; the /clips?c= address
  stream_uid         text unique,                  -- the Stream video; null until its upload is made
  origin             text not null check (origin in ('recorded', 'cut', 'generated')),
  status             text not null default 'processing'
                     check (status in ('processing', 'review', 'published', 'removed')),
  visibility         text not null default 'private' check (visibility in ('private', 'public')),
  desk               text,                         -- a desk's id ('govblock', 'ny', 'house-ag'); null for a reader's own
  owner_id           text,                         -- readers.id ('u-…') of the reader who made it; null for a desk's
  title              text not null,
  caption            text not null default '',
  duration           real,
  width              integer,
  height             integer,

  -- What it is keyed to.  Federal ids name the congress_* tables; a state's
  -- name openstates.* under its jurisdiction.
  jurisdiction       text not null default 'us',   -- 'us', 'us-ny'
  hearing_key        text,                         -- congress_committee_meetings.key: the event the video is of
  bill_key           text,                         -- congress_bills.key ('119-HR-4795')
  roll_call_chamber  text check (roll_call_chamber in ('house', 'senate')),
  roll_call_key      text,                         -- congress_house_votes.key ('11922026295') or congress_senate_votes.key ('119-2-231')
  member_key         text,                         -- congress_members.bioguide_id

  -- How it came to be.
  cut_id             text,                         -- clip_cuts.id, for a cut clip
  source_start       real,                         -- seconds into the source, for a cut clip
  source_end         real,
  template           text,                         -- 'roll-call-tally', for a generated clip

  created_at         timestamptz not null default now(),
  published_at       timestamptz,
  removed_at         timestamptz,

  check (desk is not null or owner_id is not null)
);

create index if not exists clips_feed on clips (status, visibility, created_at desc);
create index if not exists clips_owner on clips (owner_id, created_at desc) where owner_id is not null;
create index if not exists clips_desk on clips (desk, created_at desc) where desk is not null;
create index if not exists clips_hearing on clips (hearing_key) where hearing_key is not null;
create index if not exists clips_roll_call on clips (roll_call_chamber, roll_call_key) where roll_call_key is not null;
create index if not exists clips_bill on clips (bill_key) where bill_key is not null;

-- --------------------------------------------------------------- clip_cuts

-- A long video on its way through the cut (scripts/clips/cut): the record's
-- own hearing video by its address, or a reader's upload held in Stream.  The
-- keys are carried onto every clip it yields.  An upload cannot be queued
-- without the reader's word that they have the right to post it.

create table if not exists clip_cuts (
  id                  text primary key,            -- 'cut_' + 16 hex
  status              text not null default 'queued'
                      check (status in ('queued', 'running', 'review', 'done', 'failed')),
  source_url          text,                        -- a hearing's video (YouTube or congress.gov)
  source_stream_uid   text,                        -- a reader's upload
  desk                text,
  owner_id            text,
  rights_attested_at  timestamptz,                 -- "I have the right to post this video", ticked
  title               text,
  jurisdiction        text not null default 'us',
  hearing_key         text,
  bill_key            text,
  roll_call_chamber   text check (roll_call_chamber in ('house', 'senate')),
  roll_call_key       text,
  member_key          text,
  clips               integer,
  log                 text,                        -- the worker's log path
  error               text,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,

  check (source_url is not null or source_stream_uid is not null),
  check (source_stream_uid is null or rights_attested_at is not null)
);

create index if not exists clip_cuts_status on clip_cuts (status, created_at);

-- ------------------------------------------------------------ clip_reports

-- Report and takedown, from a clip's menu.  No foreign key: a report can name
-- any clip the feed shows, a stock one included.

create table if not exists clip_reports (
  id           text primary key,                   -- 'rpt_' + 16 hex
  clip_id      text not null,
  reason       text not null check (reason in ('copyright', 'privacy', 'harmful', 'other')),
  details      text not null default '',
  contact      text,                               -- an email address to answer
  reporter_id  text,                               -- readers.id, or null when signed out
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text check (resolution in ('removed', 'kept'))
);

create index if not exists clip_reports_open on clip_reports (created_at) where resolved_at is null;
create index if not exists clip_reports_clip on clip_reports (clip_id);
