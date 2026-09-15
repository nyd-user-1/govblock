-- The library: its catalogue, and Works inside a code by address.  2026-09-14, window 4.
--
-- Additive only: one new table and one new index on `expressions`.  No change
-- to any table the site reads.
--
--   node scripts/xml/migrate.mjs sql/012_library.sql
--   node scripts/xml/library.mjs          fills xml_library

-- ------------------------------------------------------------- xml_library

-- What the store holds, one row per library that is a prefix of addresses
-- (docs/xml/schema.md): a state's code (/us-ny/code/agm), the US Code's
-- titles (/us/usc/t10), a constitution (/us-ny/const), a session of bills
-- (/us-ny/bill/2025).  The Library page's top level and the `/` command read
-- it instead of grouping five million rows of `expressions` per request.
-- `name` is what a reader calls the code, from "Laws".law_name.  Written by
-- scripts/xml/library.mjs, a jurisdiction at a time; families of law are
-- rules over these rows (apps/web/lib/xml/families.ts), not rows.

create table if not exists xml_library (
  prefix        text primary key,          -- '/us-ny/code/agm', '/us/bill/119', '/us-ny/const'
  jurisdiction  text not null,             -- 'us', 'us-ny'
  kind          text not null,             -- 'bill' | 'usc' | 'code' | 'const'
  unit          text not null,             -- the session ('2025', '2025s1', '119') or the code segment ('agm', 't10'); '' for a constitution
  name          text,                      -- 'Agriculture & Markets', 'Armed Forces'; null for a session
  works         integer not null,
  expressions   integer not null,
  coverage      real,                      -- mean over the Expressions
  first_date    date,
  latest_date   date,
  refreshed_at  timestamptz not null default now()
);

create index if not exists xml_library_jurisdiction_kind on xml_library (jurisdiction, kind, unit);

-- -------------------------------------------------- a code's Works, by address

-- The Library lists one code's sections from `expressions`.  The code is the
-- fourth segment of the Work's address, and no index reaches it: a LIKE on
-- `work` cannot use the address index under the cluster's collation (sql/005),
-- so listing California's Food and Agricultural Code read all 161,426
-- California sections, 5.7 s over the Data API.  Keyed by the code segment and
-- then the Work, a code's sections come back in address order from the index.
-- Built concurrently, so the pipeline's writes are not blocked meanwhile.

create index concurrently if not exists expressions_code_work
  on expressions (jurisdiction, kind, (split_part(work, '/', 4)), work);
