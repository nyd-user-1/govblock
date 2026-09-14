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
