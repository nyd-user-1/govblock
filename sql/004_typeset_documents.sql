-- Typeset documents.  2026-09-13.
--
-- A bill version's page in Typeset, built once: the HTML read out of the
-- document's USLM XML (or its stored plain text), the Slate value that HTML
-- reads into, and that value drawn as static markup for a page to show before
-- the editor mounts.  Opening Typeset used to fetch GovInfo's XML, parse it,
-- build the HTML and parse that again in the browser on every open; a
-- published version never changes, so it is built once and read after.
--
-- All three are stored gzipped.  The site reads the database over the RDS Data
-- API, which refuses a result over 1 MB, and H.R. 6644 alone is 348 KB of
-- HTML, 460 KB of value and 1.1 MB of snapshot (73, 77 and 140 KB gzipped).
-- Readers and writers move the bytes in slices under the cap
-- (apps/web/lib/typeset/document-store.ts).
--
-- `builder` is the version of the code that built the row (TYPESET_BUILDER).
-- When the builder changes the constant goes up and older rows are rebuilt on
-- read.  A row is written with builder 0 and marked only once it is complete.
--
-- Written on first read by apps/web/lib/typeset/document.ts and ahead of time
-- by scripts/typeset/backfill.mjs.  See apps/web/docs/typeset-perf.md.

create table if not exists typeset_documents (
  document_id     bigint primary key,       -- "Documents".document_id
  bill_id         bigint not null,
  version         text,
  doc_date        text,                     -- the version's own date, as "Documents" has it
  builder         integer not null,
  html_gz         bytea not null,
  value_gz        bytea not null,
  snapshot_gz     bytea not null,
  html_bytes      integer not null,         -- before gzip
  value_bytes     integer not null,
  snapshot_bytes  integer not null,
  built_at        timestamptz not null default now()
);

create index if not exists typeset_documents_bill on typeset_documents (bill_id, document_id desc);
