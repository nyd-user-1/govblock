-- Legislative XML: the expressions index, the run queue, the fall-outs.  2026-09-14.
--
-- Every Expression the compiler produces (a printing of a bill, a statute
-- section as it stood on a date) is one USLM document in S3, gzipped, under
--
--   s3://govblock-lake-638175140432/lake/v1/xml/<work address>/<expression date>.xml
--
-- and one row here.  The documents stay in S3 because the Data API moves a
-- megabyte a request and there are millions of them; this table is what finds
-- them.  See apps/web/docs/prompts/2026-09-14-legislative-xml-program.md,
-- decision 10, and apps/web/docs/xml/window-2.md.
--
-- Additive only: three new tables, no change to any table the site reads.
-- Written by scripts/xml/run.mjs (the controller on the box); read by
-- app/api/xml/* and the Legislative XML dashboard.

-- ---------------------------------------------------------------- expressions

-- A new fetch becomes a new Expression rather than an overwrite: the
-- controller hashes the source text it read and inserts a new row only when
-- the Work's latest Expression was built from different source text.  An
-- unchanged Work costs a `seen_at` touch.  The same source built again by a
-- better front end (a new builder, a state's grammar replacing plain text)
-- is the same Expression in a better Manifestation, so it replaces that row
-- and its object in place.  "Laws" keeps its upsert; this table is the dated
-- trail beside it.
--
-- The Expression in force on a date is the Work's row with the greatest
-- expression_date on or before it (apps/web/lib/xml/store.ts expressionAt).

create table if not exists expressions (
  id               bigserial primary key,
  work             text not null,             -- the Work's address (apps/web/docs/xml/schema.md): '/us/bill/119/hr/6644', '/us-ny/code/agm/s3'
  expression_date  date not null,             -- the printing's date, or the date the statute text is known to stand
  kind             text not null,             -- 'bill' (a printing) | 'statute' (a section of a code)
  jurisdiction     text not null,             -- 'us', 'ny', … lower case
  session          text,                      -- bills: the legislature's session ('2025'); statutes: null
  unit             text not null default '',  -- the stage (schema.md): a bill's printing ('ih', 'amended-2'); '' for a statute section
  label            text,                      -- what a reader calls it: 'H.R. 1', '10 U.S.C. 130i'
  fidelity         text not null,             -- 'native-xml' | 'structured-html' | 'plain-text' | 'pdf'
  coverage         real,                      -- 0..1, the share of this document that parsed cleanly
  dialect          text,                      -- the front end's name for what it read ('bill-dtd', 'uslm-2', 'ny-laws')
  front_end        text not null,             -- 'us', 'ny', …  (lib/xml/frontends/<jurisdiction>.ts)
  builder          integer not null,          -- the controller's build number; a bump rebuilds
  source_url       text,
  source_ref       text,                      -- where it came from in our own store: 'BillTexts:123', 'Laws:NY/PEN/§10', 'govinfo:BILLS-119hr1ih'
  s3_key           text not null,
  source_hash      text not null,             -- sha256 of the source text the front end read
  content_hash     text not null,             -- sha256 of the USLM before gzip
  bytes            integer not null,          -- USLM before gzip
  gz_bytes         integer not null,
  job_id           bigint,
  built_at         timestamptz not null default now(),
  seen_at          timestamptz not null default now()
);

-- Two printings of a bill can share a date, so the printing is part of the key.
create unique index if not exists expressions_work_date_unit on expressions (work, expression_date, unit);
create index if not exists expressions_work_date on expressions (work, expression_date desc);
create index if not exists expressions_juris_kind_session on expressions (jurisdiction, kind, session);
create index if not exists expressions_job on expressions (job_id);

-- ---------------------------------------------------------------------- jobs

-- One job is one jurisdiction and one session (bills) or one jurisdiction and
-- one code title (statutes).  The dashboard's run controls insert 'queued'
-- rows; the controller claims them with `for update skip locked`, heartbeats
-- while it works, and a job whose heartbeat is ten minutes old is taken back
-- into the queue.  A jurisdiction with no front end yet is 'waiting', not
-- skipped, so the queue shows it.

create table if not exists xml_jobs (
  id            bigserial primary key,
  jurisdiction  text not null,
  kind          text not null,                -- 'bill' | 'statute'
  unit          text not null,                -- a session ('2025') or a code title / law id ('USC10', 'PEN')
  status        text not null default 'queued', -- 'queued' | 'waiting' | 'running' | 'done' | 'failed' | 'blocked'
  priority      integer not null default 100, -- lower runs first
  reason        text,                         -- why it waits or is blocked: 'no front end for ak', 'no XML before the 113th Congress'
  total         integer,                      -- documents in the job, once counted
  built         integer not null default 0,   -- new Expressions written
  unchanged     integer not null default 0,   -- Works whose latest Expression already matched
  fell_out      integer not null default 0,   -- documents that did not parse or validate
  coverage      real,                         -- the job's mean coverage
  bytes         bigint not null default 0,
  worker        text,                         -- host:pid of the controller that holds it
  run           text,                         -- 'nightly-2026-09-15', 'dashboard', 'backfill-2026-09-14'
  requested_by  text,
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  heartbeat_at  timestamptz,
  finished_at   timestamptz
);

create unique index if not exists xml_jobs_open on xml_jobs (jurisdiction, kind, unit) where status in ('queued', 'waiting', 'running');
create index if not exists xml_jobs_status on xml_jobs (status, priority, id);
create index if not exists xml_jobs_run on xml_jobs (run);

-- ----------------------------------------------------------------- fall-outs

-- What did not compile, a sample per job (the controller keeps the first
-- fifty of each reason), for the dashboard and the acquisition review.

create table if not exists xml_fallouts (
  id          bigserial primary key,
  job_id      bigint not null,
  jurisdiction text not null,
  work        text,
  source_ref  text,
  stage       text not null,                  -- 'source' | 'parse' | 'validate' | 'store'
  reason      text not null,
  detail      text,
  at          timestamptz not null default now()
);

create index if not exists xml_fallouts_job on xml_fallouts (job_id);
create index if not exists xml_fallouts_juris_stage on xml_fallouts (jurisdiction, stage, reason);

-- ------------------------------------------------- the address, 05:00 EDT

-- Window 1 froze the address in apps/web/docs/xml/schema.md after the tables
-- above were created, empty.  `work` is the Work ('/us/bill/119/hr/6644'),
-- `expression` is the date and the stage ('2025-12-11_ih'), and the address
-- is work || '@' || expression.  `unit` carries the stage alone ('ih',
-- 'amended-2'; '' for a statute section).  `date_basis` says how the date
-- was known, since schema.md marks an inferred date here and not in the
-- address: 'printed' (the printing's own date), 'active' ("Laws".active_date),
-- 'release' (the publisher's release date), 'history' (the BillHistory
-- action that produced the printing), 'fetched' (only the day it was read).

alter table expressions add column if not exists expression text not null;
alter table expressions add column if not exists date_basis text;
create unique index if not exists expressions_address on expressions (work, expression);

-- What a job already holds is read by jurisdiction and kind in id order
-- (scripts/xml/lib/store.mjs holdings): a LIKE on `work` cannot use the
-- address index under the cluster's collation.
create index if not exists expressions_juris_kind_id on expressions (jurisdiction, kind, id);
