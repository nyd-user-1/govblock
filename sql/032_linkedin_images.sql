-- LinkedIn posts carry images.  2026-09-17.
--
-- Additive only: one new column. Brendan approved it on 2026-09-17.
--
--   node scripts/clips/migrate.mjs sql/032_linkedin_images.sql
--
-- A post's images, in the order they appear: each is { key, name, type },
-- the key an object in the uploads bucket under linkedin/. The publisher
-- uploads them to LinkedIn under the post's author when it sends the post.

alter table linkedin_posts add column if not exists images jsonb not null default '[]'::jsonb;
