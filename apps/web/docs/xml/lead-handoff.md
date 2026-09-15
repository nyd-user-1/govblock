# Lead handoff, 2026-09-15 (the night of the 14th)

For Brendan in the morning, and for any lead that takes over from govblock-93.
The section from the afternoon of the 14th follows, unchanged, below.

## What landed overnight (all on origin)

- **main is the fresh baseline**, pushed at e43e6a4 with 175 commits: the XML
  program, clips, Sunday's hero and rails, the read cache, the lobbyist view.
  Amplify built it (job 278, 188 MB of the 220 MB cap) and serves it. Nothing
  else was pushed to main; the night's work is on `feature/typeset-flip`.
- **One box, one server.** The dev box's single clone is on
  `feature/typeset-flip`, serving localhost:3001. The 3002 and 3003 servers,
  tunnels and clones are gone. The box shuts itself down after 20 idle
  minutes and at 5 AM; `~/bin/govblock-dev-up` brings it back. Its old
  working copy is kept on the box's local branch `box/stale-2026-09-14`.
- **Costs.** The cluster paused at zero for the first time in a week. The
  bill-page crawler from Meta's ranges is blocked at Amplify's firewall (Bot
  Control is an AWS charge, about $10 a month); Leuk on Vercel has the same
  wall. The lobbyist scan is a 4 ms index lookup. The read cache answers
  public pages (`apps/web/docs/read-cache.md`). livingston's two disks are
  snapshots now; its worker and the pipeline box are stopped; the FEC bulk
  and bill PDF buckets are moving to Glacier Instant Retrieval. Expected
  steady day: $5 to $8. The snapshot archive tier and a smaller dev box are
  the two cuts left, both Brendan's call.
- **Typeset, by the lead:** a statute's own URL (`/workspace/typeset/statute/us-ny/agm/s16`)
  and a bill address that redirects to the bill's XML view; the footer's
  version chip spelled out ("Enrolled · 2026-06-25") and opening the panel;
  Versions ▾ History as one switcher, two panels; every Versions row the
  same shape (stage chip that explains itself, name, date, the address as a
  copy chip); the glossary's Bill text versions table; lines, loc and size
  named on hover; Open in Typeset gone; the floating Fork chip gone; the
  search dropdown over the toolbar; a File menu at the front of every
  toolbar holding the seven views, the numbers gone from the footer; the
  finder beside the workspace switcher (a bill opens, a member or committee
  opens the left rail with their bills, My Files opens the drafts).
- **Two windows on the branch**, briefed by
  `apps/web/docs/prompts/2026-09-15-typeset-windows.md`, reporting to
  `apps/web/docs/typeset/window-editor.md` and `window-search.md`:
  typeset-editor (editing in place with autosave, mount from HTML, the address
  URLs with the vendor id gone, the block view, then the flip after the lead's
  Q/A) and typeset-search (search, comments that save, ⌘J and Ask AI as Plate
  had them, the Library sidebar). `@` and `/` on the read-only readers are
  held for Brendan's own road test.
- **Acquisition** waits for a window: `2026-09-14-acquisition-round-two.md`
  (Virginia's leftovers deleted, Colorado 2010–2015 found or explained, a
  Virginia re-fetch under an hour, California finished, Utah's refused pages
  replaced). The Colorado LegiScan-key question is answered: no key spend.

## The windows' finish lines (05:20 EDT), all on main

Both windows finished every item and stopped; the branch was type-checked
whole (64 changed source files, 0 diagnostics) and fast-forwarded to `main`
at 8653018; Amplify job 279 builds it.

- **typeset-editor** (`window-editor.md`): editing in place on the reader,
  the first keystroke making the copy and autosaving (sql/027, the draft
  route, an IndexedDB copy against a crash, "Your copy · Open" on return);
  the read-only reader mounted from the server's HTML (the JSON fetched only
  when editing begins: 2.7 s sooner cold, 0.6 s warm, one bounded headless
  read for the numbers); every Typeset URL on the address form
  (`/workspace/typeset/us/bill/119/hr/6644/git`, `/us/ny/code/agm/s16`), the
  vendor id gone, every old form redirecting; the block view restored on
  the reader (one shared handle, drag through the schema, a right-click
  menu); the Library paths reading us/ny; and the flip: the bare address is
  the Tiptap reader, called Typeset, `/xml` redirects to it, Plate lives at
  `/plate` as "Plate (legacy)". First-paint-sent-once was measured and
  declined, reasons in the report.
- **typeset-search** (`window-search.md`): a bare bill number finds the bill
  first; "Search the law" as a fourth scope and on the Library, by citation
  and heading, through `/api/typeset/find`; comments that save (sql/026,
  Plate's demo users gone, anchored to the unit on the XML view); ⌘J and
  Ask AI in Plate's shape through a tool-less Drafter, each press a call,
  answers streaming; the Library's section sidebar and the Work page's rail.

## Production (06:05 EDT)

`main` is at 16dcc6f, Amplify job 281, and every Typeset page answers on
policy.nysgpt.com. Two builds before it (279, 280) served the pages as
"Internal Server Error": Turbopack had left `@aws-sdk/client-s3` external
under a hashed name (two copies resolve in the workspace since Remotion
arrived) and Amplify's node_modules never carried the alias, so every route
reading the XML store failed at load. `next.config.ts` now bundles that
client; `/api/typeset/health?read=1` loads the reader's modules one at a time
and names the one that fails, on the box and on the site. The anonymous
`/api/xml/uslm/…` 403 is the app's own door, not the firewall.

## For Brendan in the morning

- Road-test 3001, in the browser, which no window did: type on the bare
  6644 page and watch the copy save, close the tab, come back, find it in
  My Files; drag a unit by its handle; write a comment, reload, read it;
  ⌘J on a unit and Ask AI on a selection; the File menu, the finder,
  Versions ▾ History, the statute URL, the glossary's new table.
- Decide `@` and `/` on the readers (Plate's `@` was people; window 6 made
  it citations).
- Fire the acquisition window when the day's cost picture is clear.
- Say yes or no to the snapshot archive tier and the smaller dev box.

# Lead handoff, 2026-09-14 (afternoon)

For the session that takes over as lead when govblock-27 reaches its
limit. Read this, then `lead.md` (the night shift), then `window-*.md`
and `window-7b.md` for the day's work. You are the lead: the one window
Brendan looks at. Windows report to you by message and by committing
their report; questions reach Brendan only through you, never as prompts
in a worker's terminal. No subagents. When he says do a thing, do it.

## The state of things

- **Branch:** `feature/legislative-xml`, head bd055fc, pushed. The Mac
  checkout at `~/Code/govblock` is on it. `main` has a stack of commits in
  the worktree at the scratchpad path `main-wt` (root hero, /sign-in,
  /sign-up, the right-rail second screen with Clips and the Map inside it,
  robots.txt, the dev-only x on gates) — **committed, not pushed**; Brendan
  said no Amplify builds unless he asks. `git -C <scratchpad>/main-wt log
  origin/main..HEAD` lists them. Robots (5a416aa) is the one thing pushed
  to main today.
- **Servers:** the dev box `govblock-dev` runs `~/govblock` (main + the
  worktree's files rsynced in, uncommitted there) on 3000 → localhost:3001,
  and `~/govblock-xml` (the branch, clean, at head) on 3002 → localhost:3002.
  `~/bin/govblock-dev-up` brings the box and the 3001 tunnel back;
  `ssh -f -N -L 3002:127.0.0.1:3002 govblock-dev-direct` the 3002 tunnel.
  The pipeline box `govblock-xml` (i-09c2fbf8624d91bdf) is **stopped**.
- **Windows:** all closed. Window 8 (grammars) done, seventeen of
  seventeen ≥ 90%. Window 6 (citations, in-context view) done; fork 202
  is the redline to show. Window 4's re-fetches: Virginia stopped by
  Brendan at 4,529 of 97,015 (a one-a-second pace was "never
  acceptable"; do not restart it that way); California's ca-pubinfo
  loader was left running in a tmux on the livingston worker; Colorado's
  2010–2015 printings were never stored (the S3 PDFs are 2016–2026) and
  the only source is LegiScan's metered key, which Brendan refused to
  spend; Utah's refusal pages counted, PDFs on https, not run. Window 7b
  found 4,396 leftover S3 objects under `lake/v1/xml/` (4,091 Virginia,
  from the night's rewrite); Brendan has not said whether to delete them.
- **clips-2** (Brendan's other account) is building
  `docs/prompts/2026-09-14-clips.md` on `feature/clips`; it reports to the
  lead; it is not reachable from this account's socket list.

## What Brendan is doing

Road-testing the Tiptap reader against Plate on 3002 to flip the switch
(the bare bill route renders the XML reader; Plate moves to a slug). His
findings so far and what was done are in the commits since 4985552. Open
from his testing, in his words:

1. **The console header on every view**: the file row (search, Raw,
   copy, download, edit, History) above, the rich-text toolbar below it in
   the main container, on all seven Typeset views. Done on Git's views
   (the pane takes a `toolbar` slot); the row still has to be lifted out
   of `bill-text-pane.tsx` for Plate, XML, Fork and Library.
2. **Comments must save.** The discussion plugin is Plate's in-memory
   demo; a table keyed to bill and block, additive DDL, is the fix.
3. The Git view loads fastest; the XML reader fetches 1.8 MB of JSON
   after first paint. Mount from the server's HTML when read-only.
4. He hates every gate that does not gate, and every sentence that
   explains what the layout already says.

## Rules learned today, the hard way

- Never `git add -A`, never stash or `--autostash` in the shared checkout.
- Never chain a commit behind a piped type check: `set -o pipefail` and
  gate on the check's exit, or the broken file ships (20a6176 did).
- No perl one-liners with `|` inside the pattern over TSX; use the Edit
  tool or a small Python script that asserts the line it replaces.
- A window's question goes to the lead, never into Brendan's terminal.
- Say what a thing is in plain words ("Virginia's leftover files"), not
  the program's name for it ("the orphan dry run").

## Brendan's road-test list, 2026-09-14 12:20, in his order

Open, on `feature/legislative-xml`, for the lead or one window:

1. **The Git view's header and footer on every Typeset view.** Done
   2026-09-14 evening by clips-2 taking over the lead's list. The row is
   `components/policy/file-row.tsx`; Git's pane wears it as before, and
   `components/workspace/typeset-file-chrome.tsx` puts it over Typeset
   (01), Outline (02), Redline (03), Diff (05), XML (06), Library (07),
   the bill's Fork view and the Work page, with the rich-text toolbar
   under it wherever the view has no editor of its own. Find in this file
   marks matches on the page as drawn (CSS Custom Highlight API, rules set
   at run time because Turbopack's CSS parser refuses `::highlight`);
   Enter walks them. Outline reads the page's headings and USLM sections;
   History lists the printings (a choice opens it in Git); the pencil opens
   the Fork view; the size line goes to the footer. `TypesetFrame` wears
   the Git footer's parts (`typeset-footer-parts.tsx`), with the bill's
   pills on a bill's Work. Not on the standalone Library page or the
   standalone fork page (`/workspace/typeset/fork/<id>`): they open no file.
   `/` focuses the search on every view but XML and the Work page, left
   free for item 4.
2. **Comments save.** A table keyed to bill, document and block; the
   discussion plugin reads and writes it instead of the in-memory demo.
3. **Search.** ⌘K for "6644" returns H.Res. 1299 (its title mentions the
   number) and not H.R. 6644 itself: a bill number typed bare must find
   the bill first. And search across the XML store (the Expressions in
   S3, indexed) from the Library and the reader: none exists.
4. **The XML reader's keys.** Partly done 2026-09-14 evening, in the Fork
   editor only: `@` typed in the text names a person (members), `/` opens
   the unit commands and the references (citations, defined terms,
   committees), Plate's way (`typeset-inline-menu.tsx`); the toolbar's `@`
   button is gone. The read-only readers still take neither. Before that: `@`, `/` and ⌘J did nothing on the Work page
   (`/workspace/typeset/work/us/usc/t7/s1`); they exist in ⌘K and the Fork
   editor (window 6) but the read-only reader does not wire them. Wire
   `@` (citations), `/` (the library) and ⌘J (jump to a section) on every
   reader.
5. **A section sidebar for the Library**, like the Git view's outline.
6. **Editing on the XML reader.** Plate's toolbar acts on Plate; the XML
   view is read-only until a fork. Brendan expects the toolbar's editing
   on the XML view itself (the Tiptap editor window 5 built for forks,
   on the bill).
7. **The block view** — Brendan asks where it went (the Plate "blocks"
   layout). Find whether it is a view that dropped out of `views.ts` on
   2026-09-12 (Activity and Versions did) and restore it if so.
8. The reader loads slower than Git: mount from the server HTML without
   fetching the JSON when read-only.
9. The XML reader's links go to full-size PDFs; fine, but note it.

`main`'s commits in the `main-wt` worktree are ready; Brendan pushes
when he wants the build.
