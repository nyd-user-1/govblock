-- Clips on S3, not Cloudflare Stream.  2026-09-14, clips window.
--
-- Additive only: two new columns on `clips` and one new check on
-- `clip_cuts`.  Nothing dropped or altered; `stream_uid` stays, unused.
--
--   node scripts/clips/migrate.mjs sql/021_clips_s3.sql

-- Where a clip's video and poster sit in the private clips bucket
-- (govblock-clips-638175140432): 'clips/clp_…/video.webm', 'clips/clp_…/poster.jpg'.
alter table clips add column if not exists video_key text;
alter table clips add column if not exists poster_key text;

-- A reader's upload is held in the bucket and named 's3://…' in source_url.
-- As with a Stream upload before it, the table refuses one without the
-- reader's word that they have the right to post it.
alter table clip_cuts add constraint clip_cuts_upload_rights check (source_url not like 's3://%' or rights_attested_at is not null);
