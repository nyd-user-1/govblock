-- 025: the lobbyist → filings map, precomputed (2026-09-15).
--
-- "LobbyingActivities" keeps the lobbyists named on each activity as a text
-- array. Every lookup by lobbyist name unnested all 677,465 rows, about ten
-- seconds a query; the lobbyist entity page ran seven of them, and crawlers
-- walking the lobbyist pages spent 1,270 hours of cluster time on that one
-- pattern between 2026-08-11 and 2026-09-14. This view answers the same
-- question from an index in milliseconds.
--
-- Refresh after any lobbying load: `refresh materialized view concurrently
-- lobbyist_filings` (the unique index makes the concurrent form possible, so
-- readers are never blocked). Additive: nothing existing is touched.

create materialized view if not exists lobbyist_filings as
  select distinct upper(l) as lobbyist, a.filing_uuid
    from "LobbyingActivities" a, unnest(a.lobbyists) l
   where l <> '';

create unique index if not exists lobbyist_filings_pk on lobbyist_filings (lobbyist, filing_uuid);
create index if not exists lobbyist_filings_filing_idx on lobbyist_filings (filing_uuid);
