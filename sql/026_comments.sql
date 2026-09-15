-- Comments that save.  2026-09-15, window typeset-search.
--
-- Typeset's comments were Plate's in-memory demo (Alice, Bob, Charlie) and
-- vanished on reload.  One row per comment: the reader who wrote it, the bill
-- and the document it sits on, the block it is anchored to, the words it was
-- opened on, its text, its time, and the thread it belongs to.  A thread is
-- the first comment and its replies.
--
--   document  Plate's view: 'plate:<page>:<bill id>:<printing>'
--             the XML view:  the Expression's address, '/us/bill/119/hr/6644@2026-06-25_enr'
--   block     Plate's view: the top-level block's index, 'b412'
--             the XML view:  the USLM unit's identifier, '/us/bill/119/hr/6644/s2/a',
--                            so a comment survives a re-render of the document
--
-- A reader's own rows: read only by the reader, with the view open, never
-- cached (`comment` is on VOLATILE in apps/web/lib/policy/db.ts).
-- Additive only: one new table, two indexes.  No change to any table the site reads.
--
--   node scripts/xml/migrate.mjs sql/026_comments.sql

create table if not exists comments (
  id          bigserial primary key,
  thread_id   text not null,                  -- the thread's id, minted by the browser when the thread opens
  reader      text not null,                  -- identify(): 'u-…' for a signed-in reader
  bill_id     bigint,                         -- the bill, when the document is a bill's printing
  document    text not null,
  block       text not null,
  quote       text,                           -- the words the thread was opened on; the anchor's second key
  body        text not null,                  -- the comment as plain text
  rich        jsonb,                          -- Plate's rich value of the comment, where it has one
  resolved    boolean not null default false, -- set on every row of a thread at once
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index if not exists comments_reader_document on comments (reader, document, created_at);
create index if not exists comments_thread on comments (thread_id, created_at);
