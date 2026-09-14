-- Window 5: a fork names a Work address; a commit holds a structured Expression.  2026-09-14.
--
-- A reader forks a published unit (a section of a state code, a subsection
-- of the US Code, a bill's printing) from its dated base Expression in
-- `expressions`, edits it as a document, and commits.  The fork engine
-- (apps/web/lib/typeset/amend.ts) diffs the commit's document against that
-- base, so both are kept here: the base by its address, the commit's
-- document as the ProseMirror JSON of the reader's USLM schema
-- (apps/web/lib/xml/schema.ts), gzipped.  See
-- apps/web/docs/prompts/2026-09-14-fork-and-amend.md and
-- apps/web/docs/xml/window-5.md.
--
-- Additive columns and one constraint relaxation ("Forks".bill_id may be
-- null, for a fork of a statute).  No data changes; Duplicate to edit rows
-- keep their bill and read as before.

-- ---------------------------------------------------------------------- Forks

alter table "Forks" add column if not exists work text;             -- the forked address: '/us-ny/code/agm/s16/2', '/us/bill/119/hr/6644/tI/s101'
alter table "Forks" add column if not exists base_work text;        -- the stored Work the base was read from: '/us-ny/code/agm/s16'
alter table "Forks" add column if not exists base_expression text;  -- that Work's Expression: '2026-02-20', '2026-06-25_enr'
alter table "Forks" add column if not exists kind text;             -- the address's kind: 'bill' | 'usc' | 'code' | 'const' | 'pl'
alter table "Forks" add column if not exists label text;            -- what a reader calls the unit: '§ 16(2)', 'H.R. 6644 § 101'
alter table "Forks" alter column bill_id drop not null;

create index if not exists forks_owner_work_idx on "Forks" (owner, work) where work is not null;

-- -------------------------------------------------------------------- Commits

alter table "Commits" add column if not exists doc_gz bytea;        -- the fork's document at this commit: ProseMirror JSON, gzipped
alter table "Commits" add column if not exists doc_bytes integer;   -- the JSON's size before gzip
alter table "Commits" add column if not exists doc_schema integer;  -- the schema version the JSON was written against
