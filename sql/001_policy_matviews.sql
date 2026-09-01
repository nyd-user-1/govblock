-- govblock · policy matviews
--
-- The stream and the newsroom are derived, read-constantly, hourly-changing
-- and small. livingston-v3 computed them per request with a fan-out of one
-- query per jurisdiction (the 4–10 s newsroom). Here they are computed once,
-- refreshed hourly, and read with one indexed query. Neon computes; the lake
-- (S3) will mirror; the site serves.
--
-- Semantics are v3's lib/policy/queries.ts getStream / getNewsroom, kept
-- exactly: latest session per state from "LegiscanDatasets"; the prime sponsor
-- is sponsor_type_id = 1 by position; dates are the text YYYY-MM-DD columns.

-- The newest session that actually has bills, per state.
create or replace view public.v_policy_latest_session as
select state,
       coalesce(max(year) filter (where bills > 0), max(year))::bigint as session
from "LegiscanDatasets"
group by state;

-- ── stream: each state's latest session, its 40 most recently acted-on bills ──
drop materialized view if exists public.mv_stream_latest;
create materialized view public.mv_stream_latest as
with ranked as (
  select b.bill_id, b.state, b.session_id,
         row_number() over (partition by b.state order by b.last_action_date desc, b.bill_id desc) as rank
  from "Bills" b
  join public.v_policy_latest_session s on s.state = b.state and s.session = b.session_id
  where coalesce(b.last_action_date, '') <> '' and b.title <> ''
)
select b.bill_id, b.state, b.session_id, r.rank,
       b.bill_number, b.title, b.description, b.status_desc, b.last_action, b.last_action_date,
       b.committee, b.body, b.url, b.state_link, b.text_chars,
       sp.name as sponsor, sp.party as sponsor_party, sp.people_id as sponsor_id,
       now() as refreshed_at
from ranked r
join "Bills" b on b.bill_id = r.bill_id
left join lateral (
  select p.name, p.party, p.people_id from "Sponsors" s join "People" p using (people_id)
  where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1
) sp on true
where r.rank <= 40
with no data;

create unique index mv_stream_latest_state_bill on public.mv_stream_latest (state, bill_id);
create index mv_stream_latest_state_rank on public.mv_stream_latest (state, rank);

-- ── newsroom: one row per state, the sections as jsonb ──
drop materialized view if exists public.mv_newsroom_latest;
create materialized view public.mv_newsroom_latest as
with since as (
  select to_char(now() - interval '14 days', 'YYYY-MM-DD') as d,
         to_char(now(), 'YYYY-MM-DD') as today,
         to_char(now() + interval '60 days', 'YYYY-MM-DD') as horizon,
         to_char(now() + interval '1 year', 'YYYY-MM-DD') as cap
),
cur as (
  select b.bill_id, b.state, b.session_id, b.status_desc, b.committee, b.last_action_date
  from "Bills" b
  join public.v_policy_latest_session s on s.state = b.state and s.session = b.session_id
  where coalesce(b.last_action_date, '') <> ''
),
picks as (
  select 'enacted' as section, bill_id, state, session_id, rn from (
    select c.*, row_number() over (partition by state order by last_action_date desc, bill_id desc) rn
    from cur c where status_desc ~* '(signed|veto|chaptered|enacted)') x where rn <= 6
  union all
  select 'passed', bill_id, state, session_id, rn from (
    select c.*, row_number() over (partition by state order by last_action_date desc, bill_id desc) rn
    from cur c, since where status_desc ~* '(passed|delivered|adopted)' and last_action_date >= since.d) x where rn <= 8
  union all
  select 'committee', bill_id, state, session_id, rn from (
    select c.*, row_number() over (partition by state order by last_action_date desc, bill_id desc) rn
    from cur c, since where coalesce(committee, '') <> '' and last_action_date >= since.d) x where rn <= 8
  union all
  select 'introduced', bill_id, state, session_id, rn from (
    select c.*, row_number() over (partition by state order by last_action_date desc, bill_id desc) rn
    from cur c, since where status_desc ~* 'introduc' and last_action_date >= since.d) x where rn <= 8
),
bills as (
  select p.section, p.state, p.rn,
         jsonb_build_object(
           'bill_id', b.bill_id, 'bill_number', b.bill_number, 'title', b.title, 'description', b.description,
           'status_desc', b.status_desc, 'last_action', b.last_action, 'last_action_date', b.last_action_date,
           'committee', b.committee, 'body', b.body, 'url', b.url, 'state_link', b.state_link, 'text_chars', b.text_chars,
           'sponsor', sp.name, 'sponsor_party', sp.party, 'sponsor_id', sp.people_id) as row
  from picks p
  join "Bills" b on b.bill_id = p.bill_id
  left join lateral (
    select pe.name, pe.party, pe.people_id from "Sponsors" s join "People" pe using (people_id)
    where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1
  ) sp on true
),
sections as (
  select state, section, jsonb_agg(row order by rn) as rows from bills group by state, section
),
rollcalls as (
  select state, jsonb_agg(row order by rn) as rows from (
    select b.state,
           row_number() over (partition by b.state order by r.date desc, r.roll_call_id desc) rn,
           jsonb_build_object('roll_call_id', r.roll_call_id, 'date', r.date, 'chamber', r.chamber, 'description', r.description,
             'yea', r.yea::int, 'nay', coalesce(nullif(r.nay, '')::int, 0),
             'bill_id', b.bill_id, 'bill_number', b.bill_number, 'title', b.title) as row
    from "Roll Call" r
    join "Bills" b using (bill_id)
    join public.v_policy_latest_session s on s.state = b.state and s.session = b.session_id, since
    where r.date <= since.cap
  ) x where rn <= 6 group by state
),
hearings as (
  select state, jsonb_agg(row order by rn) as rows from (
    select b.state,
           row_number() over (partition by b.state order by c.date, c.time, c.description, b.bill_number) rn,
           jsonb_build_object('date', c.date, 'time', c.time, 'type', c.type, 'description', c.description, 'location', c.location,
             'bill_id', b.bill_id, 'bill_number', b.bill_number, 'title', b.title, 'committee', b.committee, 'body', b.body, 'status_desc', b.status_desc) as row
    from "Calendar" c
    join "Bills" b using (bill_id)
    join public.v_policy_latest_session s on s.state = b.state and s.session = b.session_id, since
    where c.date >= since.today and c.date <= since.horizon
  ) x where rn <= 6 group by state
)
select s.state, s.session,
       (select d from since) as since,
       coalesce((select rows from sections where sections.state = s.state and section = 'enacted'), '[]'::jsonb) as enacted,
       coalesce((select rows from sections where sections.state = s.state and section = 'passed'), '[]'::jsonb) as passed,
       coalesce((select rows from sections where sections.state = s.state and section = 'committee'), '[]'::jsonb) as committee,
       coalesce((select rows from sections where sections.state = s.state and section = 'introduced'), '[]'::jsonb) as introduced,
       coalesce((select rows from rollcalls where rollcalls.state = s.state), '[]'::jsonb) as roll_calls,
       coalesce((select rows from hearings where hearings.state = s.state), '[]'::jsonb) as hearings,
       now() as refreshed_at
from public.v_policy_latest_session s
with no data;

create unique index mv_newsroom_latest_state on public.mv_newsroom_latest (state);

-- ── refresh, hourly ──
-- CONCURRENTLY: readers keep the previous rows while the new ones build. It
-- needs the unique indexes above and a populated view, so the very first
-- population is a plain `refresh materialized view` run once by hand.
create or replace function public.refresh_policy_matviews() returns void language plpgsql as $$
begin
  refresh materialized view concurrently public.mv_stream_latest;
  refresh materialized view concurrently public.mv_newsroom_latest;
end $$;

-- Schedule: nightly on the worker box, after the syncs — the livingston
-- manifest ops/box/jobs.d/lv-refresh-matviews.json runs
-- scripts/box/refresh-matviews.mjs. The inputs change at night; a clock would
-- refresh an unchanged view. ops/refresh-matviews.sh here is the by-hand run.
-- Not pg_cron. On this Neon project the extension can only be created in the
-- `postgres` database, where neondb_owner has no CREATE privilege — and pg_cron
-- only fires while the compute is awake anyway, so an external clock is the
-- right owner of the schedule. Tried 2026-09-01.
