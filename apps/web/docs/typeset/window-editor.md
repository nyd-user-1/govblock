# Window typeset-editor — report

Report to the lead (govblock-93). Newest milestone first. Brief:
`apps/web/docs/prompts/2026-09-15-typeset-windows.md`.

## State of the items

Stopped 2026-09-15 06:00 EDT on the lead's word, every item done. Brendan's
to look at in a browser: typing on the reader (item 1), the block handle
(item 4).

| Item | State |
|---|---|
| 1. Editing on the reader | done: 8c1064f, 9917996. Verified through the routes; not typed in a browser |
| 2. Mount from the server's HTML | done: ee72f68. Mount 1,681 → 1,092 ms warm, 3,813 → 1,108 ms cold |
| 3. Typeset's URLs | done: ec209e7, and the Library's paths in cbce0d1 |
| 3. The flip | done: b3667d6 (milestone 6) |
| 4. The block view | done: a445006. Not looked at in a browser |
| The first paint sent once | not done, on purpose: milestone 5 says why. It is not to be retried on dev-server numbers |

## Milestone 6 — the flip (2026-09-15 06:00 EDT, b3667d6)

### Done, as the lead specified

1. The bill's bare address draws the Tiptap reader. It is the view called
   Typeset, 01 in the File menu.
2. `xml` is an old slug. `/xml` answers 307 to the bare address, so the
   reader is listed once.
3. Plate lives at `plate`, last in the File menu as "Plate (legacy)".

In `views.ts`:

- the two views swapped slugs and labels, and Plate moved to the end of the list
- `xml` joined `LEGACY_SLUGS`
- `viewFromSlug` returns the view whose slug is empty, where it had "typeset"
  written in
- `typesetHref`'s default view is the reader, so a link with no view named
  ("open in Typeset" on the bill record page, Git's file actions, My Files)
  opens the reader, not Plate

`/workspace/typeset` with no bill opens the default view the same way.

### Verified, on 3001 (box at b3667d6)

Bounded type check over the flip and every file that reads the views:
0 diagnostics.

The File menu's links, as `typesetHref` builds them for H.R. 6644, and what
each draws:

| # | Menu item | URL | Answer | Page title |
|---|---|---|---|---|
| 01 | Typeset | `/workspace/typeset/us/bill/119/hr/6644` | 200 | H.R. 6644 · Typeset |
| 02 | Outline | `…/6644/outline` | 200 | H.R. 6644 · Outline |
| 03 | Redline | `…/6644/redline` | 200 | H.R. 6644 · Redline |
| 04 | Git | `…/6644/git` | 200 | H.R. 6644 · Git |
| 05 | Diff | `…/6644/diff` | 200 | H.R. 6644 · Diff |
| 06 | Library | `…/6644/library` | 200 | H.R. 6644 · Library |
| 07 | Plate (legacy) | `…/6644/plate` | 200 | H.R. 6644 · Plate (legacy) |
| | old slug | `…/6644/xml` | 307 → `…/6644` | |

- The bare address draws the reader: 4,008 USLM units in its first paint,
  no Plate paragraphs.
- `/plate` draws Plate: 3,812 Plate paragraphs, no USLM units.
- `/workspace/typeset/bill/2058568` and `/workspace/typeset/work/us/bill/119/hr/6644`
  both land on the bare address; `/workspace/typeset` goes there by way of the
  old id route.
- No new server errors in the dev log.

### Files

`apps/web/lib/typeset/views.ts`, `apps/web/app/workspace/typeset/page.tsx`.

## Milestone 5 — the Library's paths read us/ny; the first paint, measured (2026-09-15 05:35 EDT, cbce0d1)

### Built

- `libraryHref` writes a state's prefix as `us/ny`
  (`/workspace/typeset/library/us/ny/code/agm`), so every link the Library
  and its rail build takes the new form. `librarySegments` reads the URL's
  form back to the store's, in `resolveLibrary` and `libraryTitle`, so the page
  and `/api/typeset/library?path=` take either.
- A page link still saying `us-ny` gets a 307 to `us/ny`, with its query.

### Verified, on 3001

| URL | Answer |
|---|---|
| `/workspace/typeset/library/us/ny/code/agm` | 200 |
| `/workspace/typeset/library/us-ny/code/agm?sort=newest` | 307 → `…/library/us/ny/code/agm?sort=newest` |
| `…/library/us/ny`, `…/library/us/ny/bill/2025` | 200, 200 |
| `…/library/us/usc/t10`, `…/library/agricultural-law` | 200, 200 |
| `/api/typeset/library?path=us/ny/code/agm` and `?path=us-ny/code/agm` | 200, 200 |

New York's Library page carries 288 links in the `us/ny` form and none in
the old one. Bounded type check over the four files: 0 diagnostics.

### The first paint sent once: measured, and not recommended

H.R. 6644's XML view is 2.67 MB of HTML and **276 KB on the wire**, gzipped.
The React payload inside it is 1.45 MB of that, 127 KB gzipped, and the
reader's copy of the first paint is most of it: about 110 KB gzipped, 40% of
what crosses the wire.

Removing it is not the small change milestone 3 guessed. Anything a server
component draws is serialized into the React payload so the browser can
hydrate it, including markup set as inner HTML, so passing the markup
differently does not help. The only way to send it once is to hand the HTML
from the server render to the server-side render of the client component
outside React, through a process-wide store keyed per request, and hydrate
an empty element over it. That works in one Node process, but it is fragile
where the two renders do not share one (Amplify's compute), and it leaves the
views reached by client navigation without a first paint. They would fetch
the JSON instead.

Recommendation: leave it. The 5.4 s from request to mount was measured on the
dev server, whose scripts are unminified; the production build is where that
number means something.

### Files

`apps/web/lib/xml/library.ts`, `apps/web/lib/xml/library-data.ts`,
`apps/web/app/workspace/typeset/library/[[...path]]/page.tsx`,
`apps/web/app/api/typeset/library/route.ts`.

## Milestone 4 — the block view (2026-09-15 05:10 EDT, a445006)

### Where it went

It was never a route: `views.ts` has had no block view in any commit
(8f4218c, 777d8bd, 5a61345, a1ced9f). It was Plate's blocks layout inside
the Typeset editor:

- a grip in the left gutter of every block on hover ("Drag to move")
- a click selects the block; a drag moves it, with a drop line
- a right-click opens the block menu (Ask AI, Delete, Duplicate, Turn into,
  Align)

It left on 2026-09-13 in 777d8bd, "one editor for every view". The editor's
kit changed from the template's `EditorKit` to `BillKit`, without `DndKit`,
`BlockSelectionKit` or `BlockMenuKit`. The reason is in `docs/typeset-perf.md`:
drag and drop wrapped every block in a draggable, a gutter, a handle and a
tooltip, 30,000 DOM nodes on H.R. 6644, 2.3 s of mount and 7 ms a keystroke.

### Built, on the new reader

`components/workspace/typeset-block-handle.tsx`, on the XML view (while
reading and while the copy is made) and on the Fork view. Each unit of the
law is a block: a level, or a block at the top of the document.

- **One handle, not one per block.** It follows the pointer to the unit it
  rests on and sits in the left gutter at the unit's first line, indented with
  it, the grip and "Drag to move" as Plate drew them. It stays on the last
  unit while the pointer crosses the gutter, so it can be reached. It adds one
  element to the page, however long the bill.
- **Click** selects the unit, tinted as Plate tinted a selected block.
- **Drag** moves the unit to wherever the schema lets it stand, with a drop
  line (Tiptap's drop cursor). ProseMirror's own drop does the move, so the
  schema's rank rules decide.
- **Right-click** on a unit opens its menu: Add a unit after, Add a unit
  under, Duplicate (a copy with no identifiers, so it reads as new law), Delete,
  Copy address (the unit's identifier).
- Plate's Turn into and Align have no meaning for a unit of law and are not
  there; Ask AI is typeset-search's, in its own layer.
- Every change goes through the editor. On the XML view the first one makes
  the reader's copy, as a keystroke does, and signed out it meets the door.

No Plate slug, per Brendan's ruling.

### Verified

- Bounded type check over the four files: 0 diagnostics.
- On 3001 at a445006: `…/us/bill/119/hr/6644/xml`, `…/6644/fork`,
  `/workspace/typeset/fork/331` and `…/us/usc/t10/s130i` answer 200. No errors
  from them in the dev log.
- **Not looked at:** the handle, the drag, the drop line and the menu in a
  browser. That is Brendan's: hover a subsection on the XML view, drag it by
  its grip, right-click a section.

### Files

`apps/web/components/workspace/typeset-block-handle.tsx`,
`typeset-xml-reader.tsx` and `typeset-fork.tsx` (one mount and one extension
each), `typeset-xml-reader.css` (the selected unit).

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
