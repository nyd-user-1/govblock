-- The title above each code in the library.  2026-09-19.
--
-- Additive only: three nullable columns on `xml_library`, which the site reads
-- (the laws pages group a jurisdiction's codes by them) and
-- scripts/xml/library.mjs writes.
--
--   node scripts/xml/migrate.mjs sql/033_library_titles.sql
--   node scripts/xml/library.mjs          fills them
--
-- The XML store addresses each jurisdiction's law by the unit its source
-- publishes — an Alaska chapter (/us-ak/code/c01.05), an Illinois act, a New
-- York law — and until now the library listed those units flat. Most codes
-- have a level above that unit, the title (Alaska's Title 1, General
-- Provisions, holds chapters 01.05, 01.10 and 01.15), and the source carries
-- it inconsistently: in the unit's id, after a dash in the chapter's heading,
-- or not at all. scripts/xml/lib/titles.mjs derives it, per jurisdiction, and
-- where the source is silent reads the jurisdiction's own table of titles
-- (scripts/xml/sources/titles/). Null where the code has no such level: its
-- units are already titles (Arizona), whole codes (California) or chapters
-- with nothing above them (Kansas).

alter table xml_library add column if not exists title text;         -- 'Title 1', 'Title 10A', 'Title XXXVIII', 'Chapter 5' (Illinois)
alter table xml_library add column if not exists title_name text;    -- 'General Provisions'
alter table xml_library add column if not exists title_order integer; -- the titles' reading order within a jurisdiction
