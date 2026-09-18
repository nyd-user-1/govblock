-- LinkedIn posts, scheduled from /posts.  2026-09-17.
--
-- Additive only: two new tables.
--
--   node scripts/clips/migrate.mjs sql/031_linkedin.sql
--
-- An admin connects their LinkedIn account once, and the calendar at /posts
-- schedules posts to their profile, the company page, or both. The publisher
-- (POST /api/linkedin/publish, run each minute) sends the ones that are due.
-- Both tables are one reader's rows: `linkedin_` is on VOLATILE in
-- apps/web/lib/policy/db.ts, so neither is ever read from the cache.

-- One LinkedIn connection per reader. The access token is sealed with
-- AES-256-GCM (apps/web/lib/linkedin/seal.ts) before it is written.
create table if not exists linkedin_accounts (
  user_id       text primary key,
  member_urn    text not null,          -- urn:li:person:<sub>
  name          text,
  picture       text,
  token_sealed  text not null,
  scope         text not null default '',
  expires_at    timestamptz not null,
  org_urns      jsonb not null default '[]'::jsonb,   -- the pages this member administers, when the organization scopes were granted
  connected_at  timestamptz not null default now()
);

-- One post. `status` walks draft → scheduled → publishing → posted, or ends
-- at failed; only a scheduled post is ever sent, so a post drawn on the
-- calendar by accident goes nowhere until it is scheduled.
create table if not exists linkedin_posts (
  id            uuid primary key,
  user_id       text not null,
  title         text not null default '',
  body          text not null default '',
  target        text not null default 'profile' check (target in ('profile', 'company', 'both')),
  publish_at    timestamptz not null,
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'posted', 'failed')),
  error         text,
  posted_urns   jsonb not null default '[]'::jsonb,
  claimed_at    timestamptz,
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists linkedin_posts_user on linkedin_posts (user_id, publish_at);
create index if not exists linkedin_posts_due on linkedin_posts (publish_at) where status = 'scheduled';
