-- Transcripts for pasted video links.  2026-09-14, clips window.
--
-- Additive only: one new table, one new column.
--
--   node scripts/clips/migrate.mjs sql/024_clip_transcripts.sql

-- A YouTube video's captions, read once and kept: the transcript page shows
-- them, and a pasted link is cut into clips from them.  Keyed by the video,
-- so a second reader pasting the same link reads nothing twice.
create table if not exists clip_transcripts (
  video_id    text primary key,                 -- YouTube's 11-character id
  source      text not null check (source in ('supadata', 'youtube', 'worker')),
  language    text,
  title       text,
  channel     text,
  duration    real,                             -- seconds, to the last caption's end
  segments    jsonb not null,                   -- [{ "start": s, "end": s, "text": "…" }]
  fetched_at  timestamptz not null default now()
);

-- The video a pasted link names, so the queue and the dashboard can join a
-- cut to its transcript.
alter table clip_cuts add column if not exists video_id text;
create index if not exists clip_cuts_video on clip_cuts (video_id) where video_id is not null;
