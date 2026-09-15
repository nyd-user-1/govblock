-- Generated clips saved as a template and its data.  2026-09-14, clips window.
--
-- Additive only: one new column on `clips`.
--
--   node scripts/clips/migrate.mjs sql/022_clips_composition.sql

-- A generated clip plays live in the viewer's browser from this: the
-- template's id and the props it was fed ({"template":"bill-history","props":{…}}).
-- No video file is kept for it.
alter table clips add column if not exists composition jsonb;
