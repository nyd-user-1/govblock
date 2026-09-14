-- Typeset documents: the XML reader's form beside the Slate value.  2026-09-14.
--
-- The XML view (apps/web/components/workspace/typeset-xml-reader.tsx) draws a
-- bill from its USLM through the reader's ProseMirror schema (apps/web/lib/xml).
-- Beside each stored printing it keeps that ProseMirror document as JSON, the
-- document drawn as HTML for the page's first paint, and the parse report.
-- H.R. 6644's House amendment is 1.8 MB of JSON, gzipped in the same way as
-- the columns beside it and read in slices under the Data API's 1 MB cap.
--
-- `pm_builder` is XML_BUILDER in apps/web/lib/typeset/xml-document.ts; a row
-- with an older builder, or none, is rebuilt on read.  Additive only: three
-- nullable columns, no existing column touched, nothing backfilled.
--
-- Written, not run (window 1 brief, 2026-09-14).  Until it runs, the reader
-- builds on read and keeps the result in memory.

alter table typeset_documents add column if not exists pm_builder     integer;
alter table typeset_documents add column if not exists pm_json_gz     bytea;
alter table typeset_documents add column if not exists pm_html_gz     bytea;
alter table typeset_documents add column if not exists pm_report      jsonb;
alter table typeset_documents add column if not exists pm_json_bytes  integer;
alter table typeset_documents add column if not exists pm_html_bytes  integer;
