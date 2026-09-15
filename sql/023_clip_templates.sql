-- Studio templates.  2026-09-14, clips window.
--
-- Additive only: one new table.
--
--   node scripts/clips/migrate.mjs sql/023_clip_templates.sql

-- A video template a reader builds in /clips/studio: its format, theme and
-- scenes as JSON (components/clips/studio/spec.ts). A clip posted from it
-- carries its own copy in clips.composition, so editing a template never
-- changes a posted clip.
create table if not exists clip_templates (
  id          text primary key,                 -- 'tpl_' + 16 hex
  owner_id    text not null,                    -- readers.id
  name        text not null,
  spec        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clip_templates_owner on clip_templates (owner_id, updated_at desc);
