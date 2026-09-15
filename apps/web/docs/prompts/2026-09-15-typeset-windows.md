# Typeset, the road test's second half: two windows

Written by the lead (govblock-93) on 2026-09-15 at 01:10 EDT from Brendan's
road test of 2026-09-14. Two windows, `typeset-editor` and `typeset-search`,
each with its own part below and the shared rules at the end. The lead is the
one window Brendan looks at: report to it by message at every milestone and
with every question; nothing goes to Brendan's terminal.

## Read first, both windows

1. `apps/web/docs/xml/lead-handoff.md`: the road-test list at its foot is the
   source of every item here, in Brendan's words.
2. `apps/web/docs/prompts/2026-09-14-legislative-xml-program.md`, whole: the
   product (GitHub for the law), the terms, the rules on forks.
3. `apps/web/docs/xml/window-1.md` (the reader), `window-5.md` (forks and the
   amendment engine), `window-6.md` (citations, `@`, `/`, the in-context view),
   `window-4.md` (the Library and the Work page), and `reader.md`.
4. `apps/web/docs/read-cache.md`: since 2026-09-15 nothing reads the database
   on page load or on a timer except through the cached executor; a reader's
   own rows (forks, commits, comments) are never cached.
5. The code you will touch: `apps/web/lib/typeset/views.ts` (the seven views
   and the Git views), `components/workspace/typeset-workspace-2.tsx` (the bill
   page's views), `typeset-xml-reader.tsx` and `typeset-xml-extensions.ts` (the
   Tiptap reader), `typeset-fork.tsx` and `typeset-editor.tsx` (the Fork
   editor), `typeset-file-chrome.tsx` and `typeset-footer-parts.tsx` (the file
   row and footer on every view), `typeset-inline-menu.tsx` (`@` and `/` in
   the editor), `typeset-work.tsx` and `lib/typeset/expression-document.ts`
   (the Work page), `typeset-library.tsx`, `components/command-menu.tsx` (⌘K),
   `components/plate/ui/block-discussion.tsx` and `comment.tsx` and
   `components/plate/editor/bill-kit.tsx` (the comments demo).

## Window `typeset-editor`

Report to `apps/web/docs/typeset/window-editor.md`, newest milestone first.

1. **Editing on the XML view itself** (road-test item 6, the payoff Brendan
   named). Today the XML view is read-only and editing exists only after a
   fork. Make the XML view editable in place: the rich-text toolbar acts on
   the Tiptap document, and the first keystroke turns the view into the
   reader's fork of that printing, silently or with one line, the way
   "Duplicate to edit" works. The official printing underneath never changes;
   the fork lives in My Files (window 5's tables: `Forks`, `Commits`, sql/011).
   From that moment the view offers what the Fork view offers: the amendment
   instructions, the redline, In context. A signed-out reader who types gets
   the sign-in door, nothing else. Verify on H.R. 6644 (bill 2058568) and a
   New York bill.
2. **Mount from the server's HTML when read-only** (item 8). The reader
   fetches 1.8 MB of ProseMirror JSON after first paint, which is why Git
   loads faster. Read-only, the reader mounts on the server-rendered HTML and
   fetches the JSON only when editing begins (item 1's first keystroke).
   Measure before and after on H.R. 6644 with `data-mount-ms` and put both
   numbers in the report.
3. **The flip.** The bare route `/workspace/typeset/bill/{id}` renders the
   XML reader; Plate moves to the slug `plate` and keeps working; nothing else
   in `views.ts` changes. Prepare it as one small commit and hold it: it lands
   when the lead says, after Brendan has road-tested items 1 and 2 on 3001.
4. **The block view** (item 7). Brendan asks where it went. Find whether it
   dropped out of `views.ts` on 2026-09-12 or 2026-09-13 (777d8bd "one editor
   for every view" and the wip commit before it are where to look) and, if
   so, restore it: on the new reader if the reader can draw it, otherwise as a
   Plate slug until parity. Say which in the report.

## Window `typeset-search`

Report to `apps/web/docs/typeset/window-search.md`, newest milestone first.

1. **Search** (item 3). Two faults. First: ⌘K for "6644" returns H.Res. 1299,
   whose title mentions the number, and not H.R. 6644. A bill number typed
   bare finds the bill first, in every form Brendan types it (6644, HR 6644,
   H.R. 6644, hr6644). Second: there is no search across the XML store. The
   `expressions` index in Aurora holds every Expression's address, kind,
   jurisdiction and work, and `xml_library` (sql/012) holds the catalogue of
   codes, titles and constitutions with their headings. Build the smallest
   search that answers "find § 16 of the Agriculture and Markets law", "7 USC
   1", "any section about milk pricing" from the Library page and from the
   reader's search field, and opens the Work page. Full text over five million
   Expressions is not in scope unless it fits an additive index you announce
   in the report and the lead approves; headings and addresses are.
2. **Comments that save** (item 2). The discussion plugin is Plate's
   in-memory demo (Alice, Bob, Charlie). A table under `sql/026_comments.sql`,
   additive, announced in the report before it runs: keyed to the bill, the
   document and the block, with the reader, the text, the time and a thread
   id; the plugin reads and writes it through a route; a comment on the XML
   view anchors to the USLM unit's address, not a Plate block id, so it
   survives a re-render. Comments are a reader's own rows: the table goes on
   `VOLATILE` in `lib/policy/db.ts`, and nothing reads it without the view
   open. Verify by writing a comment, reloading, and reading it back.
3. **Keys on the read-only readers** (item 4). `@`, `/` and ⌘J did nothing on
   the Work page (`/workspace/typeset/work/us/usc/t7/s1`). They exist in ⌘K
   and in the Fork editor (window 6, `typeset-inline-menu.tsx`). Wire `@`
   (citations and references), `/` (the library) and ⌘J (jump to a section)
   on the Work page and the XML view, the same way, without the editor.
4. **A section sidebar for the Library** (item 5), like the Git view's
   outline. `typeset-file-chrome.tsx` already reads a page's USLM sections for
   its Outline; the Library page and the Work page get a sidebar built on the
   same reading.

## The rules, both windows

- **One branch, one checkout, one server.** The branch is `feature/typeset-flip`.
  Both windows and the lead share the Mac checkout `~/Code/govblock`; stage by
  path, never `git add -A`, never stash or `--autostash`, `git pull --rebase`
  before every push, push to `origin/feature/typeset-flip` (the lead merges to
  `main`). After a push, `ssh govblock-dev-direct 'cd ~/govblock && git pull
  --ff-only'` puts it on `localhost:3001`, the one dev server, which reloads
  on its own. Never start a dev server or a build on the Mac. Never restart
  the box's server without the lead's word. The box stops itself after 20
  idle minutes; if 3001 is dead, tell the lead, and Brendan starts it.
- **Type check** the files you touched, from `apps/web`:
  `node --max-old-space-size=2048 ../../scripts/typeset/bounded-check.cjs <files>`.
  Whole-project checks are banned on this Mac. Never chain a commit behind a
  piped check; gate on its exit.
- **The database.** Nothing reads Aurora on page load or on a timer except
  through the cached executor; a reader's own data loads with the view that
  shows it and is never cached. Additive DDL only, under `sql/`, announced in
  the report before it runs, numbered after the highest file there.
- **Voice.** Plain words; say what a thing is, not the program's name for it;
  never "the record"; no sentence that restates what the layout shows; the
  product speaks in the third person and never names the model.
- **Brendan's rulings stand:** forks never appear under the official
  printing's versions; a gate that does not gate is worse than none; copy
  chips for bills, committees and people, plain text for dates and counts;
  every dropdown wide enough for its longest item on one row.
- **Context.** Over 60 % of your context, stop taking new items: put the
  state of each item at the top of your report and tell the lead.
