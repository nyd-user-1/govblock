# The night shift, 2026-09-14: the lead's log for Brendan

Read this first in the morning. Each window's own report is beside it: `window-1.md` (reader), `window-2.md` (pipeline), `window-3.md` (grammars and the Compiler page, the lead's own work), `reader.md` (the reader's numbers), `sources.md` (the acquisition review with measured coverage), `schema.md` (the address and the node list, the shared contract), and `grammars/`.

## Where things stand

- **The XML reader works and proves the thesis.** H.R. 6644 and H.R. 2289 render in Tiptap from their USLM with zero rank violations on both federal dialects; the same bills through the old Typeset HTML drop every quote closing, cap three ranks at h6, and cannot draw USLM 2 printings at all. Texas and California bills round-trip exactly. `/workspace/typeset/bill/2058568/xml` on the 3002 server.
- **The corpus is compiling.** At 09:58 UTC the store held 1,983,207 expressions (federal bills 134,727; US Code 59,849; state statutes 703,674; state bills 1,125,388) at a sustained 1,312 a second, with about 4.0 million to go including rebuilds on the final front end, for a finish around 10:50 UTC (06:50 EDT), or 12:15 UTC at the 500 a second floor the production load imposed for a while. Pipeline detail in `window-2.md`, milestone 3.
- **The corpus is compiling, continued.** Every federal printing of the 113th to 119th Congresses is stored as native XML (134,727 printings, one fell out). The US Code, New York's statutes and every state's bills were running through the pipeline box at over two thousand expressions a second when this was written; the Ingestion page (`/workspace/dashboard/ingestion`) shows the queue and takes run controls, and `/api/xml/uslm/<address>` serves any Expression as XML, at a date, with its DocHistory.
- **Every state has a front end and a measured number, for bills and for statutes.** Federal 99.5%; New York 99.4% on bills and 96% on statutes; Texas and California ten of ten clean after Window 1's round trips; statutes at 95% or better for nine of ten states sampled. 25 of 43 coverage lines are at 95% or better and 4 under 85%. The Compiler page (`/workspace/dashboard/compiler`) is the grid; `sources.md` is the table; `window-3.md` the log of how each number moved.
- **The `/` command is stubbed in ⌘K** (`/119`, `/6644`, `/new-york-code`, full addresses); `@` is routed to it for the citations window.

## Decisions taken on your authority

- The store is S3 objects with an index in Aurora (`sql/005_expressions.sql`, run), not sliced blobs in Aurora. The pipeline writes the index with batch statements; the cluster's IAM role was not touched.
- USLM's path form is the address (`/us/bill/119/hr/6644@2025-12-11_ih`, `/us-ny/code/agm/s3`), with Akoma Ntoso's IRI as a documented rewrite.
- State units take the USLM element for their rank with the state's own word in `role` (`<subsection role="subdivision">`), so one diff and one amendment engine serve every jurisdiction.
- A second box, `govblock-xml` (c7g.4xlarge, 16 vCPU, 100 GB, about $0.58 an hour), runs the pipeline alone; the dev box keeps the two dev servers. **Stop it when the corpus is done.** An image of the dev box was started and abandoned (deregistered; snapshot `snap-0ecb0409d70017d7a` can be deleted once it finishes).
- No subagents after your word; the lead did the grammars, the Compiler page and the box work itself.

## What went wrong, and what it cost

- The dev box stopped at 09:00 UTC: `govblock-stop.timer`, your daily shutdown, not memory. Its idle timer was stopped for the shift and restarted at 09:43 UTC once the pipeline had moved off it and Window 1 was done, so it stops itself an hour after its dev server last answered; `~/bin/govblock-dev-up` brings it back. The stop timer fires again tomorrow at 09:00 UTC. The pipeline box has no timers.
- Five orphaned coverage statements of mine (random order over `BillTexts`) pinned the cluster at its 8 ACU ceiling for about forty minutes from 09:30 UTC; the pipeline window found and cancelled them. The script no longer samples that way.
- Two of my commits swept Window 1's unfinished files by staging a directory; no harm done, and every later commit staged by path.

## For you

- **Production was under load from outside the program.** The site's access log for 09:14 to 09:38 UTC shows ClaudeBot (Anthropic's crawler, from 216.73.217.22) making 2,444 requests in twenty minutes across bill, committee and lobbying pages, every one a fresh read of the bill's text and lobbying joins, and your own open tabs (47.20.253.93, referers /workspace/blocks, /home, /) polling six policy API routes about thirty-five times a minute for the session aggregates over Sponsors, History and Roll Call; fifty-one of those answers were 503. Together they held the cluster at its 8 ACU ceiling and cut the pipeline's rate from about 2,900 to about 500 expressions a second. The site has no robots.txt. `app/robots.ts` is on the branch, ready: AI crawlers off the site, every crawler off the API, the workspace and the doors. It ships to main on your word. The polling is the home and blocks pages' cards refetching; worth a look.

- `sql/010` (Window 1) is written and not run; the browser mount numbers ride `data-mount-ms`.
- Window 4 (the library and My Files) waits for you to open a window; Window 1 declined to take it without your word, correctly. Windows 5 and 6 (fork and amend, citations) follow.
- Data: California's `state_link` captures are leginfo web pages for a share of printings (the pipeline now prefers the clean feed); Virginia captured its legislature's error page in place of some bills; Illinois and Massachusetts hold synopsis and petition texts as printings. Each is in `sources.md`.
- The Typeset comparison in `reader.md` is the argument for retiring Plate once the reader reaches parity.
