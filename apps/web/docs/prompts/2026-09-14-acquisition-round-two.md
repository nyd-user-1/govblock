# Acquisition, round two: Virginia, Colorado, California, Utah, and the leftovers

Brief for one window, `window-9-acquisition`. Written by the lead on
2026-09-14 (22:40 EDT) from Brendan's decisions of that hour. Report to
`apps/web/docs/xml/window-9.md`, newest milestone first. The lead is the
session at `uds:/tmp/cc-socks/24171.sock` (pid 24171); message it at every
milestone and with every question. If that socket is not in your list, say so
on the report's first line and put every question there; the lead reads it.
Nothing goes to Brendan's terminal; his answers come through the lead.

## Read first

1. `apps/web/docs/prompts/2026-09-14-legislative-xml-program.md`, whole.
2. `apps/web/docs/prompts/2026-09-14-acquisition.md`, whole (the first round).
3. `apps/web/docs/xml/window-7.md` and `window-7b.md`, whole: what window 4
   and window 6b found, tried, and left.
4. `apps/web/docs/xml/window-2.md`: the pipeline (jobs, `enqueue.mjs`,
   `run.mjs --watch`, the controller), and `window-8.md`'s "safe restart" line.
5. `~/Code/livingston/prompts/2026-08-29-text-fleet.md`,
   `~/Code/livingston/docs/TEXT-FLEET.md` and
   `~/Code/livingston/docs/LEDGER-2026-08-30.md`: the bulk text fleet of
   2026-08-29/30 that fetched every state's bill text (HTML and PDF) into S3
   and ran the text extraction. `scripts/box/text-backfill.mjs` and
   `scripts/box/fleet-launch.sh` there are the machinery.

## The rules

- Time. No job runs longer than an hour. If one must, tell the lead why
  before it starts, with the number and the shape; a one-request-a-second
  crawl of 97,000 documents is the wrong shape, not a reason.
- Machines. Long runs go on a box under `nohup` with a log, never on the
  Mac in the background. The pipeline box `govblock-xml`
  (i-09c2fbf8624d91bdf, ssh `govblock-xml-direct`, c7g.4xlarge, $0.58/h) is
  stopped; start it for compiles and fetches, stop it when idle; it comes
  back on a new address, so `ssh -o HostName=<ip>` or fix `~/.ssh/config`.
  Its role cannot delete from S3; deletes run from the Mac's credentials.
  The livingston worker (`livingston-worker-2`, i-0843042df1a5fb003, ssh
  `ubuntu@<ip>` with `~/.ssh/livingston-worker-2.pem`) is stopped since
  2026-09-15 00:20 EDT; its California loader tmux was already gone by then.
  Start it only if Part 4 needs it, stop it when Part 4 is done.
- The database. `"BillTexts"` is written only through the existing loaders'
  shape (`TextBuffer` in `scripts/xml/va-refetch.mjs` shows it), never deleted
  from, never sampled with `order by random()`. One long statement at a time;
  a statement timeout is not retried (03651f5 fixed the helper, but check the
  cluster's CPU on the RDS console before a long read). No DDL beyond
  additive statements under `sql/`, announced in the report before they run.
- Money. No LegiScan API key spend without the lead's word, which it gets
  from Brendan. Count what any route would cost before proposing it.
- Git. Your branch is `feature/typeset-flip`. The lead creates it from the
  freshly merged `main` within the hour; until
  `git fetch && git rev-parse origin/feature/typeset-flip` succeeds, commit
  nothing: read, plan, run read-only checks, start Part 1. Then
  `git worktree add ~/Code/govblock-acq feature/typeset-flip` and work there;
  `~/Code/govblock` is the lead's checkout, read it, write nothing in it.
  Stage by path, never `git add -A`, never stash or `--autostash`, never
  `main`, `git pull --rebase` before every push. Push your own commits on
  that branch; nothing else is pushed.
- Words. Say what a thing is ("Virginia's leftover files"), not the
  program's name for it. No "the record". No subagents.

## Part 1. Virginia's leftover files: delete them

Brendan's word, 2026-09-14 22:30 EDT through the lead: they are junk, delete.
`window-7b.md` and `scripts/xml/orphans.mjs` have the dry run: 4,396 objects
(3.6 MB) under `lake/v1/xml/` that no `expressions.s3_key` names, 4,091 of
them Virginia's, listed in `logs/orphans-dryrun-2026-09-14.tsv` on the Mac.
Delete from the Mac's credentials, in batches of 1,000, rechecking at the
moment of deletion that each key still has no `expressions` row; before and
after counts (objects listed, index keys, difference) in the report. Nothing
else under `lake/` is touched.

## Part 2. Colorado 2010 to 2015: find the text we already have

Brendan's position: the fleet of 2026-08-29/30 fetched every state's bill
text into S3 and ran extraction over it, Colorado included, and no session
before 2026-09-14 ever reported Colorado as unobtainable. Window 4 looked in
three places (`window-7.md`, Part 4, milestone 1) and concluded the
2010–2015 printings were never stored. Do the inventory it did not:

- The fleet's own account of Colorado: the ledger, the `s3-text:` stub rows,
  the parked-PDF converter, the `text/CO/` sink partitions by date, and
  every bucket in the account (`aws s3 ls`, then every prefix that could
  hold Colorado under any casing: `CO`, `co`, `colorado`, `jurisdiction=co`,
  `state=CO`, and by `document_id` ranges).
- What `"BillTexts"` holds for Colorado 2010–2015 today, by session: rows,
  characters, `source`, `error`, `fetched_at`; and what `"Documents"` holds as
  their links (`state_link`, `url`, `mime`).
- The lake's Parquet for `jurisdiction=co`, every partition, not the one
  window 4 sampled.

Report exact counts per session before drawing a conclusion. If the text is
there under another name, load it through the existing shape and move on to
the compile. If, after all of that, the 2010–2015 printings are truly absent,
the source is the documents' own links followed properly: Colorado's old
CLICS archive (`leg.state.co.us/clics/clics20XXa/...`) answered with a
banner at the fleet's pace; find the link shape and pace that serves the PDF
(single requests, the `bn=yes` wrapper, the file-name form, the state
archive's mirror, the Wayback Machine's CDX index), prove it on twenty
documents, and run it under the hour rule. Only if every free route fails,
write up what LegiScan would cost (its price list is
`apps/web/docs/legiscan/LegiScan_Price_List.pdf`, its schema beside it; a dataset pull is priced per session, a `getBillText` per
document) and stop for the lead's word. "Cannot be got" is never the first
line of a milestone.

## Part 3. Virginia: a shape that finishes in an hour

Window 4 measured legacy LIS refusing one IP faster than about 0.8 a second
and stopped at 4,529 of 97,015 (`scripts/xml/va-refetch.mjs`, resumable,
`logs/va-refetch/` on the Mac and the pipeline box). Brendan stopped it: a
27-hour crawl is the wrong shape. Politeness is per IP; speed comes from
breadth or from a bulk source. In this order:

1. A bulk source. Virginia's LIS publishes session data files (the
   Legislative Information System's data-file downloads, and the newer LIS
   site's API); GovInfo has none for states; Open States' bulk has links, not
   text. Find whether full bill text (HTML or PDF) exists as bulk for
   2010–2024, and if so take it whole. Read the fleet ledger's Virginia lines
   first (VA was skipped by fleet 2 and handled separately).
2. If not, fan out: N workers with N distinct egress addresses, each at the
   pace one address is allowed (measure it: 0.8/s held; 2.5/s was refused),
   sharded by `document_id`, writing through the same `TextBuffer` shape,
   resumable, so 92,486 documents finish inside an hour. The fleet's
   `fleet-launch.sh` (t4g.medium shards, each its own public IP) is the
   proven way; Lambda's egress pool or Cloudflare Workers are worth a
   twenty-document trial only if the fleet path is blocked. Terminate every
   shard when its slice is done; an idle shard costs money.
3. Never store a non-bill page; window 4's dedupe and bill-join fixes stay.

Then compile Virginia through the pipeline (Part 6).

## Part 4. California: finish the loader

Window 4 left `ca-pubinfo` running in tmux `ca-pubinfo-2025` on the
livingston worker, loading the 1.28 GB pubinfo dump; by 2026-09-15 00:20 EDT
that tmux no longer existed and the worker was stopped (see The rules), so
first establish from `"BillTexts"` and the loader's own state what it got (`scripts/laws/adapters/ca.mjs`
and `scripts/xml/sources/printings.mjs` show the shape). Find out whether it
finished; finish it. Then the `ca-captures` item in `apps/web/lib/xml/todo.ts`
(claimed by window 4; take the claim over as `window-9`): the captured
leginfo pages are never printings (88916ad), pubinfo's synthetic copies count
once, and window 5's finding stands: pubinfo names its version
"Introduced (v99)" while the clean rows say "Introduced", so the drop rule in
`printings.mjs` must match them or the captures survive. Counts before and
after, then the compile.

## Part 5. Utah: the refused pages, replaced

Window 8 found 17,570 stored Utah "printings" that are a firewall's "URL
rejected" page; window 4 counted them and found the PDFs served over https
(`window-7.md`, Part 5). Fetch the PDFs into the bill-PDF bucket in the
fleet's shape (`pdf/UT/<date>/<document_id>.pdf`), run the fleet's converter
over them, upsert through the loader shape, under the hour rule. Then the
compile.

## Part 6. The compile, and the store's numbers

First, a serializer fault found 2026-09-15 by typeset-editor: the stored
H.R. 6644 (`/us/bill/119/hr/6644@2026-05-20_eah`) carries ten stray spaces
before punctuation (`” ;` where GovInfo's XML has `”;`), and the XML view now
draws the stored Expression, so readers see them. Find where the compile
inserts the space (the text run serializer in the pipeline's USLM writer),
fix it, and rebuild the federal printings; then the rest of Part 6.

After each state's texts land: queue rebuild jobs with
`scripts/xml/enqueue.mjs` on the pipeline box, run the controller as
`window-8.md`'s restart line says, prune the old index rows (a job with
fall-outs skips the prune; say how many remain), and put the state's
before-and-after in the report: printings stored, Expressions in the index,
coverage from `scripts/xml/coverage.mjs`. Stop the pipeline box when the
queue is empty. Update `apps/web/lib/xml/todo.ts`: `va-refetch` and
`ca-captures` to `done` with your name when they are, and add rows for
Colorado and Utah so the dashboard's To Do shows them.

## Finish line

Every part reported with counts; the pipeline box stopped; every shard
terminated; the To Do current; nothing pushed to `main`. Over 60 % of your
context, claim nothing new: put the state of each part at the top of the
report and tell the lead.
