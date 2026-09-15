# Window typeset-editor — report

Report to the lead (govblock-93). Newest milestone first. Brief:
`apps/web/docs/prompts/2026-09-15-typeset-windows.md`.

## State of the items

| Item | State |
|---|---|
| 1. Editing on the XML view | planned; DDL announced below, not run |
| 2. Mount from the server's HTML | not started |
| 3. Typeset's URLs, then the flip | not started |
| 4. The block view | not started |

## Milestone 0 — the plan for item 1, and the DDL (2026-09-15 03:10 EDT)

### What was found

- **The XML view's document and the fork's base are not the same document.**
  The XML view builds the printing from GovInfo (`lib/typeset/xml-document.ts`);
  a fork's base is the stored Expression in S3 (`lib/typeset/expression-document.ts`).
  On H.R. 6644 (`/us/bill/119/hr/6644@2026-05-20_eah`) the two JSONs differ by
  10 bytes, first at § 1(a): `”.` in the XML view, `” .` in the store. An edit
  made on the XML view's document and diffed against the stored base would
  show changes the reader never made. So when editing begins the view swaps to
  the base, and the held keystroke lands at the same place, found by the unit's
  identifier and the words around the caret, not by position.
- The Tiptap reader is `editable: false`, so today no keystroke reaches it.

### Plan

1. **The reader takes keystrokes** on the bill's XML view and the Work page.
   Nothing changes the document until a copy exists.
   - Signed out: a keystroke opens the sign-in door (Cancel, Sign in) and
     nothing else.
   - Signed in: the keystroke is held. The printing on screen is forked
     (`POST /api/policy/forks` with `work@expression`, the existing route), the
     fork's base loads, and the view becomes the Fork view in place: the
     toolbar gains Redline, Amendment, In context and Commit…. The held
     keystrokes (typing, Backspace, Delete, Enter, paste) are replayed where
     they were typed.
2. **Autosave, the way Google Docs does.** The fork's working document is
   saved 1 s after typing stops, at least every 5 s while typing, and when the
   tab is hidden, gzipped in the browser. A copy in the browser's IndexedDB
   covers a crash between saves and is taken on reopening when it is newer.
   `GET /api/typeset/fork` returns the working document, and the Fork view opens
   on it. A status in the toolbar: Saving…, Saved. Commit… stays, for a named
   version.
3. **Coming back.** The copy is a `"Forks"` row from the first keystroke, so
   My Files lists it. The URL stays on the XML view; a browser that made a copy
   of the printing shows one line on the XML view ("Your copy · edited 3 min
   ago · Open"), read from localStorage, no database read on load.
4. **The toolbar on the Tiptap document.** Undo, Redo and the unit buttons are
   live once editing begins (they are today on the Fork view). Bold and Italic
   act on the schema's `b` and `i` marks.

### DDL, announced before it runs: `sql/027_fork_drafts.sql`

A new table, nothing else on the cluster changes:

```sql
create table if not exists fork_drafts (
  fork_id bigint primary key references "Forks"(id) on delete cascade,
  doc_gz bytea not null,            -- the working document: ProseMirror JSON of the USLM schema, gzipped
  doc_bytes integer not null,       -- the JSON's size before gzip
  doc_schema integer not null,      -- lib/typeset/fork-store.ts DOC_SCHEMA
  parent_commit_id bigint,          -- the commit it was edited from; null for the base
  saved_at timestamptz not null default now()
);
```

A reader's own rows: `fork_` joins `VOLATILE` in `lib/policy/db.ts`, and the
table is read only by the fork's own route, when the view opens.

### Questions for the lead

1. `027`: 026 is the comments table in typeset-search's brief.
2. The URL after the first keystroke: stays on the XML view (planned), or
   `history.replaceState` to `/workspace/typeset/fork/<id>` so a restored tab
   reopens the copy?
3. Underline and Strikethrough: the schema's nearest marks are `ins` and `del`,
   which are how New York prints new and struck matter, and the engine writes
   those itself. Planned: left disabled.
