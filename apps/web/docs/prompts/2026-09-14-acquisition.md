# Window 7: acquisition — Virginia's bills again, the orphaned objects, the captured web pages

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first, then
`apps/web/docs/xml/window-2.md` ("What fell out", "The floor", "Open") and
`apps/web/docs/xml/sources.md`. This brief is your scope only. Runs now;
the corpus is compiled and the pipeline box is stopped.

## What this window fixes

Three things the night's compile found in the record it was given. None is
a parser problem; each is a document that was never the document.

1. **Virginia.** 84,630 of Virginia's stored bill texts, 74% of them, are
   its legislature's error page, saved by the scraper as if it were the
   bill. The pipeline removed their index rows and objects and logged each
   as a fall-out naming a re-fetch. Virginia's other 30,872 printings are
   real. Fetch the missing printings again from a source that returns the
   bill: rank LegiScan's `state_link` against Virginia's LIS
   (`lis.virginia.gov`) by fetching a sample of fifty and measuring which
   returns bill text, then run the winner over the 84,630, write the text
   into `"BillTexts"` the way the loaders already do (no new shape), and
   queue the compile from the Ingestion page (`/workspace/dashboard/ingestion`,
   Run, Virginia, bills). A response that is not a bill — an error page, a
   web page of menus and script, an empty body — is not stored; it is
   counted and named in the report. Politeness: one request at a time to
   the legislature, a pause between, a user agent that says who is asking.
2. **Orphaned objects in S3.** A rebuild that re-addressed a printing
   removed the old index row but left the old object, because the pipeline
   box's role cannot delete. Reconcile `lake/v1/xml/` against
   `expressions.s3_key`: list the prefix, subtract the keys the index names,
   report the count and the bytes by jurisdiction, then delete the
   difference from a role that can (your Mac's credentials can; the box's
   cannot). Virginia alone shows 4,091. Dry run first, numbers in the
   report, then the delete. The stream is sold as a dataset once this is
   clean.
3. **California's captured web pages.** For a share of California printings
   the stored text is `leginfo.legislature.ca.gov`'s page — navigation and
   script — not the bill. The pipeline now ranks the clean feed above
   `state_link`, so new compiles prefer the real text; the stored captures
   remain. Count them (a body that is mostly script and menu text is the
   test the pipeline already uses; reuse it), re-fetch them from the clean
   feed the same way as Virginia, and queue the compile.

## Rules that bind here

- `"BillTexts"` is a table the site reads. Writes to it happen only through
  the shape the existing loaders use; read `scripts/` for the Virginia and
  California loaders before writing a byte. Never a delete from it; a
  re-fetched text replaces by the loader's own upsert.
- Never sample `"BillTexts"` by random order over the Data API; five such
  statements pinned the cluster for forty minutes on 2026-09-14. Sample
  through `"Bills"` and join.
- The pipeline box (`govblock-xml`, `i-09c2fbf8624d91bdf`) runs the compile:
  start it, `ssh govblock-xml-direct`, the `run.mjs --watch` line in
  window-2.md, stop it when the queue is empty. Its clone is
  `~/govblock-xml` on the branch; pull before running.
- Fetching is a long run: under `nohup`, log under `logs/`, resumable, with
  a count of done / failed / skipped in the log every minute.

## Done looks like

Virginia's bill printings at the count `"Bills"` says it should have, each
compiled, its coverage line on the Compiler page re-measured; the orphan
count under `lake/v1/xml/` at zero with the before-and-after in the report;
California's captures counted, re-fetched and compiled. Report at
`apps/web/docs/xml/window-7.md` at every milestone, committed by path.
