# Window typeset-search — report

Report to the lead (govblock-93). Newest milestone first.

## State of the items

1. Search: done, a7f1e22 and fe0043e.
2. Comments that save: done, fdd11ff, 65cf6ce, bd29e0d; not yet tried in a browser.
3. ⌘J and Ask AI: done, d5754d8, 73f860f, 420b978; not yet tried in a browser.
4. A section sidebar for the Library: in progress.

## Milestone 3 — ⌘J and Ask AI, Plate's way (2026-09-15)

### Built

- **The box** (`components/workspace/typeset-ai-menu.tsx`), Plate's AI menu in
  shape: "Ask AI anything…" over a list, under the text it was asked about.
  - **⌘J** opens it under the paragraph at the cursor (the caret a click
    leaves, else where the pointer last pressed, else the top of the view),
    about the unit holding it: Explain this section, Summarize, Say it
    plainly, Comment, Continue drafting.
  - **Ask AI**, the selection toolbar's first button, opens it under the
    selected words: Improve the wording, Make shorter, Make longer, Fix
    spelling and grammar, Comment.
  - Words typed in the box and Enter ask them as a question; typed words then
    an item add to its instruction.
  - The answer streams into the box, with Stop (Esc). After it: Keep as a
    comment (a Comment answer, where the view keeps comments), Replace
    selection and Insert below (only where the text is editable), Copy, Try
    again, Discard.
- **The route**: every item calls `/api/agents/chat` for the **Drafter**
  (`lib/agents/registry.ts`), a tool-less agent on Sonnet in a new
  `DESK_AGENTS` list that `agent()` also reads, so /agents shows no new card.
  It is sent the unit's number, heading and identifier, its text (up to
  12,000 characters), the selected words, and the instruction. Nothing is
  asked until an item is pressed.
- **Where**: the XML reader, through the comments layer already mounted
  (`typeset-xml-comments.tsx`); the Fork editor, through `AiLayer`, two lines in
  `typeset-fork.tsx` added with typeset-editor's word. `@` and `/` on the
  read-only readers stay held.

### Verified

- The Drafter on 3001 through `/api/agents/chat`, with N.Y. Agriculture and
  Markets § 258-m: "Explain this section" answered in 5.2 s (four bullets,
  and a note that "marketing area" and "representative period" are defined
  elsewhere); "Make shorter" on subdivision 2 answered in 1.2 s with only the
  replacement sentence. A first answer opened "Here is what it does:", closed
  "In short" and named "the Commissioner of Agriculture" where the text says
  "the commissioner"; the prompt now forbids all three, and the second answer
  kept to it.
- `/workspace/typeset/bill/2058568/xml` and `/workspace/typeset/fork/168`
  answer 200 on 3001. Bounded type check over every touched file: 0.

### Open

- **Not tried in a browser**: the box's placement, ⌘J's unit, the streaming,
  Replace selection and Insert below in the Fork editor.
- Chrome binds ⌘J to Downloads; the page takes it while the reader has focus,
  as Plate's did.
- The Plate view keeps Plate's own AI menu, which still calls
  `/api/ai/command`.

### Files

- `apps/web/components/workspace/typeset-ai-menu.tsx`, `typeset-units.ts` (the unit around a position, shared with comments)
- `apps/web/components/workspace/typeset-xml-comments.tsx` (Ask AI in its toolbar), `typeset-fork.tsx` (two lines)
- `apps/web/lib/agents/registry.ts` (the Drafter)

## Milestone 2 — comments that save (2026-09-15)

### Built

- **The table ran**: `sql/026_comments.sql`, as announced below, on
  2026-09-15 (421 ms, two indexes under 100 ms each).
- **`/api/typeset/comments`** (`app/api/typeset/comments/route.ts`), with the
  browser's calls in `lib/typeset/comments.ts`: a document's comments for the
  signed-in reader; add, edit, delete a comment; resolve or delete a thread.
  Signed out, reads return none and writes answer 401. Never cached.
- **Plate's view**: the demo's Alice, Bob and Charlie are gone from
  `discussion-kit.tsx`. `typeset-plate-comments.tsx` reads the reader's threads
  once the editor holds the page and lays each open thread's mark again over
  its quoted words in its block (or the nearest block holding them, twelve
  either side), outside the undo history. `comment.tsx` writes every add,
  reply, edit, delete and resolve through the route, and a saved comment takes
  the id it was saved under. Signed out, the comment form is "Sign in to
  comment." with a Sign in button. The document key is
  `plate:<page>:<bill id>:<printing>`.
- **The XML view**: `typeset-xml-comments.tsx`, mounted by the reader while it
  reads (three lines in `typeset-xml-reader.tsx`, on top of typeset-editor's
  ee72f68). Select words and the toolbar over them offers Comment
  (`typeset-selection-toolbar.tsx`, which reads the browser's selection, so it
  works on the read-only reader); the words stay highlighted by a decoration,
  never written into the document; a click opens the thread in Plate's shape,
  with replies, edit, delete and resolve. A thread's anchor is the USLM unit's
  `identifier` and its quoted words, looked for in that unit and then the
  whole document, so it finds its place when the reader mounts afresh from the
  server's HTML. The document key is the Expression's address.

### Verified

- The route's handlers against Aurora, bundled with a stand-in signed-in
  reader: a comment written with its rich value, a reply, the document read
  back with both, an edit (`edited_at` set), the thread resolved (both rows),
  a delete of one and of the thread, the document read back empty. Times
  come back as ISO strings.
- On 3001, signed out: `GET …?document=plate:typeset:2058568:` answers
  `{"comments":[],"signedIn":false}`; `POST` answers 401 "Sign in to keep
  comments."; `/workspace/typeset/bill/2058568` and `…/xml` answer 200.
- Bounded type check over every touched file: 0 diagnostics.

### Open

- **Not tried in a browser.** Writing a comment, reloading and reading it back
  needs a signed-in session; the route did it end to end against Aurora, the
  views have not. The lead or Brendan: select words on
  `localhost:3001/workspace/typeset/bill/2058568/xml`, Comment, reload.
- Comments on the Fork view are a separate mount there (typeset-editor's
  file); not built.
- A comment on Plate's view does not appear on the XML view of the same
  printing, or the reverse: the two anchor differently.

### Files

- `sql/026_comments.sql`
- `apps/web/app/api/typeset/comments/route.ts`, `apps/web/lib/typeset/comments.ts`
- `apps/web/components/plate/editor/plugins/discussion-kit.tsx`, `apps/web/components/plate/ui/comment.tsx`, `apps/web/components/plate/editor/use-chat.ts` (the author id may be null)
- `apps/web/components/workspace/typeset-plate-comments.tsx`, `typeset-editor.tsx` (the hook, one prop)
- `apps/web/components/workspace/typeset-xml-comments.tsx`, `typeset-xml-comments.css`, `typeset-selection-toolbar.tsx`, `typeset-xml-reader.tsx` (three lines)

## Milestone 2, announced — `sql/026_comments.sql`, before it runs (2026-09-15)

Additive only: one new table, `comments`, and two indexes on it. No change to
any table the site reads.

| Column | Holds |
|---|---|
| `thread_id` | the thread: the first comment and its replies |
| `reader` | who wrote it, from `identify()` (`u-…`, signed in) |
| `bill_id` | the bill, when the document is a bill's printing |
| `document` | Plate's view: `plate:<page>:<bill id>:<printing>`; the XML view: the Expression's address |
| `block` | Plate's view: the top-level block's index; the XML view: the USLM unit's identifier, so a comment survives a re-render |
| `quote` | the words the thread was opened on, which re-anchors it inside the block |
| `body`, `rich` | the text, and Plate's rich value where there is one |
| `resolved`, `created_at`, `edited_at` | |

Indexes: `(reader, document, created_at)` for a view's comments,
`(thread_id, created_at)` for a thread. The table name starts with `comment`,
which `VOLATILE` in `lib/policy/db.ts` already names, so it is never cached;
it is read only by its reader with the view open. Writing needs a signed-in
reader; signed out, the view shows no comments and Comment opens the sign-in
door. Run with `node scripts/xml/migrate.mjs sql/026_comments.sql`.

## Milestone 1 — search (2026-09-15)

### A bill number finds the bill first

`searchAll` in `lib/policy/db-queries.ts` (⌘K, `/search`, the file row's
session and all scopes). "6644" made the number pattern `6644%`, which never
prefixes `HB6644`, so only titles matched and H.Res. 1299 (its title names
H.R. 6644) came first. A term that reads as a bill number now matches the
number exactly past the letters and the zero padding (`A06644`), and that match
sorts first in both tiers. Congress is stored in LegiScan's letters (H.R. is
`HB`, H.Res. is `HR`), so typed federal letters are translated for Congress's
rows only.

| Typed, scope US | First rows |
|---|---|
| `6644` | H.R. 6644, H.Res. 1299, N.Y. S06644 |
| `HR 6644`, `hr6644` | H.R. 6644 |
| `H.R. 6644` | H.R. 6644, H.Res. 1299 |
| `hres1299` | H.Res. 1299 |
| `climate` | unchanged: titles |

In New York's scope `6644` gives S06644 and A06644, then H.R. 6644; `S 1234`
gives S01234 first. 300–830 ms against Aurora; on 3001,
`/api/policy/search?q=6644&state=US&all=1` returns HB6644 first.

### The law, by citation and by heading

`lib/typeset/find.ts` and `GET /api/typeset/find?q=&jurisdiction=&within=`.
What was typed is read three ways, each ending on a Work the `expressions`
index holds, looked up by `work = any(...)` on the address index:

- **An address or a citation**: `/us/usc/t10/s130i`, "7 USC 1", "§ 16 of the
  Agriculture and Markets law", through window 6's recognizer (`cite.ts`).
- **A code named and a number**: "agriculture and markets 16", "penal law
  125.25", matched against the catalogue's code names (`xml_library`).
- **Words in a section's heading**: "any section about milk pricing", on
  `"Laws".title`'s trigram index, each row mapped to the address
  `scripts/xml/sources/statutes.mjs` stored it under (the plain address, or
  under its container where a number restarts).

A citation that lands is the answer; words are read as a heading only when
nothing was named. Every answer carries its heading from `"Laws"`, and opens
through `workHref`, so the address scheme typeset-editor is moving to carries
over. Open to every reader, as the Library is; the gate stays on the Work.

No DDL. Full text was measured and left out: `"Laws".tsv` already indexes
headings (weight A) and text (weight B), but a heading-only query on it
rechecks every row whose text holds the word, and "health" took 45 s.
Headings on the trigram index take 6 ms ("milk"), 246 ms ("health"), 1.2 s
("definitions").

| On 3001, `jurisdiction=us-ny` | Answer |
|---|---|
| `7 USC 1` | 7 U.S.C. 1, Short title → `/workspace/typeset/statute/us/usc/t7/s1` (200) |
| `Agriculture and Markets 16` | Agriculture & Markets § 16, General powers and duties of department → `…/statute/us-ny/agm/s16` (200); Vermont's Agriculture, Food and Markets § 16 second |
| `any section about milk pricing` | 14 sections: General Business § 396-RR (Price gouging; milk), Agriculture & Markets § 258-M, 7 U.S.C. 7251, Maine, Connecticut… |
| `milk`, `within=/us-ny/code/agm` | Agriculture & Markets § 51 Milk inspection, § 252 Division of milk control… (0.23 s) |
| `penal law 125.25` (script) | Penal § 125.25, Murder in the second degree |

The first request after a server start pays 4–7 s to load the catalogue, which
stays in memory for an hour, as the `/` command's does.

### Where a reader meets it

- **The reader's search box** (`components/policy/file-row.tsx`): a fourth
  scope, `law:all`, "Search the law", on every view that wears the row,
  Git's pane included. Its answers list in the Results panel with their
  heading and jurisdiction; a click opens the Work.
- **The Library** (`typeset-library.tsx`): the filter box asks the route as
  typing pauses or on Enter, bounded by the library it is in (a code, a
  jurisdiction, or everywhere from a family or the top), and the sections it
  finds list above the library's own rows. Nothing is asked when the page
  loads, even with `?q=` in the address.

### Verified

- Bounded type check over the six touched or dependent files: 0 diagnostics.
- The queries above, against Aurora from the Mac (bundled `searchAll` and
  `findLaw` over the Data API) and on 3001 through the routes.
- `/workspace/typeset/library` and `/workspace/typeset/library/us-ny/code/agm`
  answer 200 on 3001. Not looked at in a browser.

### Open

- The scope and the Library's list are not yet seen in a browser.
- Headings match words, lightly stemmed ("pricing" finds "prices"); a section
  whose heading does not say what it is about is not found. The text search
  needs its own index (a heading-only tsvector column or a GIN on
  `to_tsvector('english', title)`), additive, if the lead wants it later.
- ⌘K does not list sections of law; the brief puts that search on the Library
  and the reader's box.

### Files

- `apps/web/lib/policy/db-queries.ts` (`searchAll`)
- `apps/web/lib/typeset/find.ts`, `apps/web/app/api/typeset/find/route.ts`
- `apps/web/components/policy/file-row.tsx` (the search half only)
- `apps/web/components/workspace/typeset-library.tsx`
- `apps/web/docs/typeset/window-search.md`
