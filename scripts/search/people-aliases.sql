-- govblock · scripts/search/people-aliases.sql
--
-- "holmes" has to find Eleanor Holmes Norton. Our "People" row calls her
-- "Eleanor Norton" — LegiScan's name — so a search over `name` alone cannot.
-- Every token that is missing we already hold: `middle_name` is 'Holmes'
-- (9,334 rows carry one, 2,294 a nickname), and for the 552 US members that
-- join congress.gov by bioguide_id, `congress_members.name` carries the
-- bioguide form "Norton, Eleanor Holmes". Thirteen of those 552 add a real
-- token of their own — Gilbert for Gil Cisneros, Jefferson for Jeff Van Drew,
-- Patrick for Pat Ryan, Lizzie for Elizabeth Fletcher.
--
-- So this builds no new source. It writes the name forms a person might be
-- typed under into one column, ' | '-delimited so a %wildcard% cannot bridge
-- two of them, and `searchAll` matches name OR aliases. State legislators keep
-- their LegiScan names; they simply gain their own middle name and nickname.
--
-- Idempotent, ~22 k rows, under a second. Re-run after a LegiScan people sync
-- or a congress.gov member refresh — a row inserted since the last run has a
-- null `aliases` and is still found by `name`, so drift degrades to today's
-- behaviour rather than to a hole.
--
--   . ~/.govblock/aurora.env && psql "$AURORA_POLICY_URL" -f scripts/search/people-aliases.sql

\timing on

alter table "People" add column if not exists aliases text;

update "People" p
   set aliases = f.value
  from (
        select p.people_id,
               nullif(btrim(regexp_replace(
                 concat_ws(' | ',
                   -- given + middle + family, the form a full-name search types
                   nullif(btrim(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix)), ''),
                   -- the nickname people actually use
                   nullif(btrim(concat_ws(' ', p.nickname, p.last_name)), ''),
                   -- family-first, for "norton eleanor"
                   nullif(btrim(concat_ws(' ', p.last_name, p.first_name, p.middle_name)), ''),
                   -- the bioguide's own "Norton, Eleanor Holmes", comma dropped
                   nullif(btrim(replace(m.name, ',', '')), ''),
                   -- and the same, turned around
                   nullif(btrim(concat_ws(' ', split_part(m.name, ', ', 2), split_part(m.name, ', ', 1))), '')
                 ), '\s+', ' ', 'g')), '') as value
          from "People" p
          left join congress_members m on m.bioguide_id = p.bioguide_id
       ) f
 where f.people_id = p.people_id
   and p.aliases is distinct from f.value;

analyze "People";

select count(*) filter (where aliases is not null) as with_aliases,
       count(*) as total
  from "People";
