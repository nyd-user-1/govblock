# Window typeset-editor — report

Report to the lead (govblock-93). Newest milestone first. Brief:
`apps/web/docs/prompts/2026-09-15-typeset-windows.md`.

## State of the items

| Item | State |
|---|---|
| 1. Editing on the XML view | built, 8c1064f and 9917996; routes verified; typing in a browser is Brendan's |
| 2. Mount from the server's HTML | built, ee72f68; measured |
| 3. Typeset's URLs, then the flip | URLs built, ec209e7; the flip waits for the lead's word |
| 4. The block view | started |

## Milestone 3 — Typeset's URLs are addresses (2026-09-15 04:45 EDT, ec209e7)

### Built

- **One route for every Work,** `app/workspace/typeset/us/[[...path]]/page.tsx`:
  jurisdiction, kind, path, then the view. `lib/xml/address.ts` reads it both
  ways: `typesetPathOf(address)` writes `us-ny` as `us/ny`, and
  `addressOfTypesetPath(segments, VIEW_SLUGS)` reads the path back to the stored
  address and the view segment.
  - A bill's Work is session/type/number, so a fourth segment is its view.
  - A statute's last segment is a view only when it names one; a statute has
    the reader alone, and `/xml` on it is the same page.
  - A portion below a bill (`…/6644/tI/s101`) opens the bill. A stored bill
    with no row in `"Bills"` is drawn as a Work.
  - `@expression` on a bill opens that printing in the XML view.
  - `?at=YYYY-MM-DD` is the text in force on a date, as before.
  - `/workspace/typeset/us` alone goes to the Library's United States.
- **The pages.** The bill page's body is `components/workspace/typeset-bill-route.tsx`
  and the statute page's is `typeset-statute-route.tsx`, both drawn at the
  address. The bill is found by its Work (`billIdOfWork`, one cached read of
  `"Bills"`), so no LegiScan id appears in a Typeset URL.
- **What redirects** (307, keeping the query):
  - `/workspace/typeset/bill/<id>[/<view>]` goes to the address; a bill with no
    address is still drawn there.
  - `/workspace/typeset/work/<address>` goes to a bill's XML view or a
    statute's reader.
  - `/workspace/typeset/statute/…` goes to the address.
  - An old view slug (`comp`, `versions`, `actions`) goes to its view's.
- **Who builds the new form:**
  - `typesetHref` takes a bill, an address or an id. A bill or an address
    gives the new URL; an id alone gives the old one, which redirects.
  - `workHref` gives a bill's XML view or a statute's reader. Through it the
    Library, the `/` command, the citations, In context and find all build the
    new form with no change of their own.
  - The bill views carry `route.address`: the rail, prefetch, file actions,
    the file chrome, the File menu and the Git pane.
  - The bill record page's Typeset links, the `/` command's bills and the
    parse tile pass the bill.
  - The finder's rows carry no jurisdiction, so they keep the id and redirect.
- `lib/routes.generated.ts` regenerated.

### Verified, on 3001 (box at ec209e7)

- Bounded type check over the 20 touched files: 0 diagnostics.

| URL | Answer |
|---|---|
| `/workspace/typeset/us/bill/119/hr/6644` | 200 (first compile 22.8 s) |
| `…/us/bill/119/hr/6644/xml` | 200 |
| `…/us/bill/119/hr/6644@2026-05-20_eah/xml` | 200 |
| `…/us/bill/119/hr/6644/git` | 200 |
| `…/us/bill/119/hr/6644/comp` | 307 → `…/6644/redline` |
| `/workspace/typeset/bill/2058568` | 307 → `/workspace/typeset/us/bill/119/hr/6644` |
| `/workspace/typeset/bill/2058568/xml?version=123` | 307 → `…/6644/xml?version=123` |
| `/workspace/typeset/work/us/bill/119/hr/6644` | 307 → `…/6644/xml` |
| `/workspace/typeset/work/us/usc/t10/s130i?at=2026-05-01` | 307 → `/workspace/typeset/us/usc/t10/s130i?at=2026-05-01` |
| `/workspace/typeset/statute/us-ny/agm/s16` | 307 → `/workspace/typeset/us/ny/code/agm/s16` |
| `…/us/usc/t7/s1`, `…/us/usc/t10/s130i/a/1` | 200, 200 |
| `…/us/ny/code/agm/s16`, `…/us/ny/const/artI/s11` | 200, 200 |
| `…/us/ny/bill/2025/s/7721/git` | 200 |
| `…/us/pl/119/21` | 404: no public laws are in the store |
| `…/us/nonsense` | 404 |
| `/workspace/typeset/us` | 307 → `/workspace/typeset/library/us` |

- H.R. 6644's XML view at its address: 0 links to `/workspace/typeset/bill/2058568`
  in the page, and the address throughout.
- `/api/typeset/slash`: `/hr6644` lists `/workspace/typeset/us/bill/119/hr/6644/xml`,
  `/workspace/typeset/us/ct/bill/2025/hb/6644/xml` and
  `/workspace/typeset/us/bill/118/hr/6644/xml`. `/us/usc/t10/s130i` lists
  `/workspace/typeset/us/usc/t10/s130i`.
- No server errors from these requests in the dev log.

### Where a warm page's time goes (the lead's question)

The server is not the long pole once warm. `GET …/6644/xml` took 925 ms
(Next.js 445 ms, the page's own code 481 ms). What follows is the page
itself, 2.6 MB. The 1.06 MB first paint rides in it twice: once as markup and
once as the string prop the reader mounts from, in the React payload. Then the
scripts load and hydrate. **Proposal, not done:** a server component draws the
first paint and the reader parses it from the DOM it finds, so the HTML
crosses once and the page drops to about 1.5 MB.

### For the flip (held)

- When the bare address becomes the XML view and Plate moves to `plate`, the
  `xml` slug must stay as an old slug that opens the XML view (`LEGACY_SLUGS`).
  Every link built today says `/xml`, and without it they would 404. That is
  one line in `views.ts` beyond the two slugs.
- `workHref` asks `typesetHref(address, "xml")`, so it follows the flip on its
  own.

### Open

- **The Library's own paths still read `us-ny`**
  (`/workspace/typeset/library/us-ny/code/agm`); only its links to Works
  changed. Turning them to `us/ny` touches `library-data.ts`, its route and
  `typeset-library.tsx`, where typeset-search is working now. Left for the
  lead to decide when.
- `@expression` on a bill's Plate, Git and Diff views is ignored; those views
  choose a printing by document id (`?version=`, `?doc=`).
- A fork's own URL stays `/workspace/typeset/fork/<id>`, built only by
  `forkHref`. A fork is a reader's file, not an address in the law.

### Files

`apps/web/lib/xml/address.ts`, `apps/web/lib/typeset/views.ts`,
`apps/web/lib/xml/library.ts`, `apps/web/lib/typeset/bill-href.ts`,
`apps/web/app/workspace/typeset/us/[[...path]]/page.tsx`,
`apps/web/app/workspace/typeset/bill/[id]/[[...view]]/page.tsx`,
`apps/web/app/workspace/typeset/statute/[...address]/page.tsx`,
`apps/web/app/workspace/typeset/work/[...address]/page.tsx`,
`apps/web/components/workspace/typeset-bill-route.tsx`, `typeset-statute-route.tsx`,
`typeset-workspace-2.tsx`, `typeset-file-chrome.tsx`, `typeset-file-menu.tsx`,
`typeset-git-pane.tsx`, `typeset-work.tsx`,
`apps/web/app/(records)/bills/[id]/page.tsx`, `apps/web/app/api/typeset/slash/route.ts`,
`apps/web/app/api/typeset/uslm-parse/route.ts`, `apps/web/lib/routes.generated.ts`.

## Milestone 2 — the reader mounts on the server's HTML (2026-09-15 04:10 EDT, ee72f68)

### Built

- The read-only reader builds its editor from the first paint the server
  already sent (`content` is the snapshot's HTML), so a reader who only reads
  never fetches the ProseMirror JSON. The JSON arrives when editing begins, in
  the fork's payload. A reader with no first paint fetches the JSON as before.
- The carry from item 1 still holds. The HTML parses back to the stored
  document position for position, so the reader's steps land on the fork's
  base unchanged.

### Measured, H.R. 6644's XML view (`/workspace/typeset/bill/2058568/xml`)

The browser numbers came from one headless Chromium on the Mac against 3001,
on the lead's word, reading only `[data-xml-reader]`'s two attributes, two
loads each (`scratchpad/mount-ms.mjs`). No screenshots, nothing clicked.
Milliseconds from the reader's first render:

| | JSON fetched and parsed (`data-json-ms`) | Editor mounted (`data-mount-ms`) | Page request to mount |
|---|---|---|---|
| Before (8c1064f), first load | 2,991 | 3,813 | 7,584 |
| Before, second load | 821 | 1,681 | 7,016 |
| After (ee72f68), first load | not fetched | 1,108 | 6,790 |
| After, second load | not fetched | 1,092 | 5,428 |

The editor holds the document about 590 ms sooner on a warm load and 2.7 s
sooner on a cold one, and 1.06 MB of JSON (158 KB gzipped) is no longer sent
to a reader who only reads.

Node proxy over the same document (`scratchpad/rt-check.mjs`, the schema and
converters bundled with esbuild), five runs each:

- `JSON.parse` + `nodeFromJSON`: 19–21 ms. HTML through linkedom and the
  schema's parse rules: 381–412 ms. linkedom is far slower than a browser's
  own parser, so this proxy says little about the browser and the table above
  is the measure. The JSON path's real cost was the fetch.
- Round trip, JSON → HTML → document: content size 310,786 both ways, text
  equal, 14,644 nodes at the same positions. The only differences are 2,094
  nodes without GPO's random `id` attribute, which the HTML leaves out on
  purpose.

### Files

`apps/web/components/workspace/typeset-xml-reader.tsx`.

## Milestone 1 — editing on the XML view (2026-09-15 03:55 EDT, 8c1064f, 9917996)

### Built

- **The XML view takes keystrokes**, on a bill's XML view and on the Work
  page. The reader draws its own toolbar.
  - Signed out, a keystroke opens the sign-in door (Cancel, Sign in) and
    changes nothing.
  - Signed in, the first keystroke makes the reader's fork of the Expression
    on screen (`POST /api/policy/forks`). The edits go on showing while it is
    made ("Making a copy…" in the toolbar). Once the fork's editor holds its
    text, the edits are carried onto it as the same steps, the cursor and the
    unit at the top of the window with them, and the view is the Fork view
    where it stands: Redline, Amendment, In context, Commit…. The URL does
    not change.
  - A printing not in the XML store says it cannot be copied, on the keystroke.
- **One text.** Per the lead's steer, a stored printing's XML view draws from
  its stored Expression (`storedPrinting` in `lib/typeset/xml-document.ts`, the
  page's first paint from `getExpressionDocument`, the JSON from
  `/api/typeset/work`). The fork's base is that document, so the steps land
  where they were typed without any mapping. A printing the store lacks is
  built from its source as before and cannot be copied. A printing with no
  date (New York's) finds its stored Expression by its stage: S. 7721's
  "Original" is `/us-ny/bill/2025/s/7721@2025-05-01_original`.
- **Autosave** (`lib/typeset/use-autosave.ts`): the working document goes to
  `PUT /api/typeset/draft` gzipped in the browser, 1 s after typing stops, at
  least every 5 s while it goes on, when the tab is hidden and on leaving.
  The toolbar says Saving…, Saved to My Files, or Not saved yet, trying again
  (it retries every 5 s). Between saves a copy is kept in the browser's
  IndexedDB; the Fork view opens on it when the server's is older and saves it.
  `GET /api/typeset/fork` hands the owner the draft saved since the last
  commit, and the Fork view opens on it, on the bill and in My Files alike.
- **Coming back.** The fork is a `"Forks"` row from the first keystroke, so My
  Files lists it. The browser that made it shows "Your copy · Open" in the XML
  view's toolbar (localStorage, no database read). A reader who types on a
  printing they already hold a copy of gets that copy with its saved changes,
  and a line saying so; the new keystrokes are not carried onto it.
- **Toolbar.** Bold and Italic act on the schema's `b` and `i` marks (⌘B, ⌘I),
  in Plate's places; Underline and Strikethrough stand disabled with the
  tooltip "The redline marks what changed". Undo, Redo and the unit buttons as
  on the Fork view.
- Citations still open on a plain click while the view is being read; once
  editing, a modifier click, as on the Fork view.
- `forkHref(id)` in `lib/policy/forks.ts` is where a fork's own URL is built
  for new code; item 3 decides it.

### `sql/027_fork_drafts.sql`: ran

2026-09-15 03:20 EDT, on the lead's word, one statement. `fork_drafts` has the
six columns milestone 0 lists; `fork_` is on `VOLATILE`.

### Verified, on 3001 (box at 9917996)

- Bounded type check over the 17 touched files: 0 diagnostics.
- `/workspace/typeset/bill/2058568/xml`: 200 in 7.9 s; its JSON is
  `/api/typeset/work?address=/us/bill/119/hr/6644@2026-05-20_eah`.
  `/workspace/typeset/bill/2027908/xml` (New York S. 7721): 200 (the gate,
  anonymously). No server errors from these requests in the dev log.
- Through the routes, as a throwaway browser identity
  (`scratchpad/verify-draft.mjs`):
  - the fork of `/us/bill/119/hr/6644@2026-05-20_eah`: made, fork 331, 2.3 s
  - a save of the whole bill with one word changed: 200, 158 KB gzipped
    (1.06 MB of JSON), 1.35 s
  - a save by a stranger: 403; a save of something not a document: 400
  - the fork reopened as its owner: the draft, byte-identical, no head;
    reopened by anyone else: no draft
  - the fork's base against the XML view's document: identical
  - My Files (`GET /api/policy/forks`) lists "331 H.R. 6644"
- **Not verified here:** typing, the carry, the door, Saved, and closing the
  tab and coming back, in a browser. The dev server is up, so that look is
  Brendan's: signed in, open `http://localhost:3001/workspace/typeset/bill/2058568/xml`,
  type a word in § 1, watch "Making a copy…" become the Fork view's buttons
  and "Saved to My Files", close the tab, reopen the bill's XML view ("Your
  copy · Open") and My Files.

### Open

- **The store's H.R. 6644 has ten extra spaces** where the GovInfo build has
  none (`” ;`, `( `), all after an inline element. The XML view now shows them.
  A rebuild of the stored Expression with today's builder fixes it; the
  pipeline's, not this window's.
- A second tab editing the same fork: the last save wins.
- Test row: fork 331 and its draft, under a throwaway claim.

### Files

`sql/027_fork_drafts.sql`, `apps/web/lib/typeset/use-autosave.ts`,
`apps/web/app/api/typeset/draft/route.ts`, `apps/web/app/api/typeset/fork/route.ts`,
`apps/web/lib/typeset/fork-store.ts`, `apps/web/lib/typeset/xml-document.ts`,
`apps/web/app/workspace/typeset/bill/[id]/[[...view]]/page.tsx`,
`apps/web/components/workspace/typeset-xml-reader.tsx`, `typeset-fork.tsx`,
`typeset-xml-toolbar.tsx`, `typeset-toolbar.tsx`, `typeset-cite-layer.ts`,
`typeset-workspace-2.tsx`, `typeset-work.tsx`,
`apps/web/components/plate/ui/fixed-toolbar-buttons.tsx`,
`apps/web/lib/policy/forks.ts`, `apps/web/lib/policy/db.ts`.

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
