-- Window typeset-editor: a fork's working document, saved as the reader types.  2026-09-15.
--
-- The XML view is editable in place (Brendan, 2026-09-15): the first
-- keystroke makes the reader's fork of the printing on screen, and from then
-- on the fork autosaves the way Google Docs does, so a closed window or a
-- crash loses nothing and the unnamed copy waits in My Files.  A commit stays
-- what it was, a named version; this row is the text between commits.  See
-- apps/web/docs/prompts/2026-09-15-typeset-windows.md and
-- apps/web/docs/typeset/window-editor.md.
--
-- A new table and nothing else.  One row per fork, overwritten on each save.
-- A reader's own rows: `fork_drafts` is on VOLATILE in apps/web/lib/policy/db.ts
-- and is read only by the fork's own route.

create table if not exists fork_drafts (
  fork_id bigint primary key references "Forks"(id) on delete cascade,
  doc_gz bytea not null,            -- the working document: ProseMirror JSON of the USLM schema, gzipped
  doc_bytes integer not null,       -- the JSON's size before gzip
  doc_schema integer not null,      -- apps/web/lib/typeset/fork-store.ts DOC_SCHEMA
  parent_commit_id bigint,          -- the commit it was edited from; null for the base
  saved_at timestamptz not null default now()
);
