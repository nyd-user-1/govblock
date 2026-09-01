-- govblock · scripts/search/bill-text-chunks.sql
--
-- The last 1.91 GB of bill text, made searchable.
--
-- "BillTexts".search_tsv is a stored generated column over left(text, 1000000),
-- and it has to be: the ceiling is on the tsvector *output*, 1,048,575 bytes,
-- and it is hard. Measured on the worst document we hold — Ohio HB96, the FY
-- 2026-27 operating budget, 11,429,601 characters:
--
--   to_tsvector('english', left(text, 4000000))  ->  993,214 bytes   (95% of the ceiling)
--   to_tsvector('english', text)                 ->  ERROR: string is too long for
--                                                    tsvector (1881646 bytes, max 1048575)
--
-- So the bound cannot simply be raised, and changing a stored generated column's
-- expression rewrites a 36 GB table under an ACCESS EXCLUSIVE lock. Chunking is
-- the fix: 2,110 documents across 907 bills run past a megabyte, holding 4.02 GB
-- of text of which only the first 2.11 GB is indexed. This table indexes the
-- rest — and it is the bills people search hardest that need it. Ohio's
-- operating budget, Ohio HB775, New York's appropriations bill S09003.
--
-- No text is stored: only the tsvector, plus the three columns the search cuts
-- on. ~290 MB projected against the corpus's measured 103 KB of tsvector per MB
-- of this kind of text and 48.6 MB of GIN per GB of source.
--
-- FRESHNESS: nothing refreshes this today, because nothing refreshes
-- "BillTexts" on Aurora on a schedule either — the chunker joins the nightly at
-- the ingestion cutover. Until then it is a snapshot of the same moment the
-- generated column is, and a bill re-fetched after that date has its first
-- megabyte searchable and its tail not. Re-run this whole file to rebuild; it is
-- idempotent.
--
--   . ~/.govblock/aurora.env && psql "$AURORA_POLICY_URL" -f scripts/search/bill-text-chunks.sql
--   . ~/.govblock/aurora.env && bash scripts/search/bill-text-chunks.sh   # then populate

\timing on

create table if not exists "BillTextChunks" (
  document_id bigint   not null,
  chunk_no    int      not null,
  bill_id     bigint   not null,
  state       text     not null,
  session_id  int,
  tsv         tsvector not null,
  primary key (document_id, chunk_no)
);

-- The same shape as billtexts_scope_search_idx, because the text arm of
-- searchAll asks both tables the same question and must get the same plan:
-- state, session and the tsquery cut together, inside the index.
create index if not exists billtextchunks_scope_search_idx
  on "BillTextChunks" using gin (state, session_id, tsv);

comment on table "BillTextChunks" is
  'Bill text past the first megabyte, as tsvectors. See scripts/search/bill-text-chunks.sql.';
