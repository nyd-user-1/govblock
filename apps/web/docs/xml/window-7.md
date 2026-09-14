# Window 7: acquisition — report

Report to the lead. Newest milestone first. Each part is taken by the window
that claims its item in `apps/web/lib/xml/todo.ts`, under its own heading.

## Part 3, California (`ca-captures`, claimed by window 4)

### Milestone 1 — the count, why the drop rule missed them, the compile fixed (2026-09-14, 14:15 UTC)

**The count.** California's `state_link` texts with any text: **581**, all
in the 2025 session. Every one is a leginfo page: "Bill Text - AB-1969 …",
then `/* Hide page by default*/ html { display : none; }` and the frame-busting
script. (The other `state_link` rows, 2017–2023, hold no text: the walker
recorded robots.txt's refusal.) Counted by session and source, the text
read only from its first 4,000 characters, no random order.

| Kind | Captures |
|---|---|
| Amended | 283 |
| Enrolled | 249 |
| Chaptered | 46 |
| Introduced | 3 |

**Window 5's reading holds, and it is worse than a name.** The clean feed
(`ca-pubinfo`) names a printing "Amended Assembly (v96)", the capture
"Amended", so the drop rule in `printings.mjs` dropped none of the 581. Matched
by the version number in each capture's own link (`…AB1969#96AMD` against
`(v96)`):

- 170 captures are printings the clean feed already holds, 169 of them under
  the loader's synthetic ids.
- 408 are **newer printings the clean feed does not hold**: its 2025 rows were
  last loaded 2026-08-29, before the enrollments and chapters. So re-fetching
  is needed, not only dropping.
- 3 bills (ACA 24, HR 141, SCR 198) have no clean text at all.

**The compile, fixed** (`scripts/xml/sources/printings.mjs`):

- A captured web page is never a printing, whatever it is called. Its row
  still dates the printings around it.
- The loader's synthetic-id copy of a printing that is also stored under its
  real id counts once, under the real id.
- Tested on a California-shaped bill: the page is dropped and v96 is kept once.
  **Found, not fixed (window 2's or window 8's to rule):** printings are
  ordered by `|document_id|`, and the loader's synthetic ids run to hundreds of
  millions, so a synthetic introduced printing sorts after a real amended one
  and takes the later date.

**The reader** says so in the source line instead of drawing a captured page
("The stored text of this printing is the legislature's web page, not the bill,
so it is not drawn; a clean copy is being fetched."):
`lib/typeset/xml-document.ts` flags it, and the bill page passes it into
`XmlMeta`. Bounded type check: 0 diagnostics.

**The re-fetch, next.** The existing loader, livingston
`api/_lib/text-sources/ca-pubinfo.ts`, over the Legislative Counsel's
2025 dump (`pubinfo_2025.zip`, 1.28 GB, refreshed 2026-09-14 04:26 UTC). It
writes each version under the LegiScan `document_id` its link names, so a
capture's row is replaced by the bill in the loader's own upsert. It runs where
the loader reaches Aurora's private endpoint (not this Mac): the livingston
worker box. It waits on Brendan's word for this write, asked directly.

**Virginia, same check:** 14:05 UTC, 473 tried, 448 stored, 0 refused,
0.78/s (34.4 h left). Window 8's controller is on the same box now (500 MB);
Virginia's pace dropped from 0.90 to 0.78 a second, which is the Data API
sharing, not the legislature refusing.

## Part 1, Virginia (`va-refetch`, claimed by window 4)

### Milestone 3 — the full run is going, on the pipeline box (2026-09-14, 13:58 UTC)

| | |
|---|---|
| Started | **2026-09-14 13:54:55 UTC**, on the pipeline box (`govblock-xml`, i-09c2fbf8624d91bdf, now at 100.54.86.169) |
| Targets | 97,015 documents, sessions 2010–2024, every one a legacy LIS link under its own bill |
| Pace | one request at a time, 1,000 ms pause at the fastest (slowing by half on each refusal, to 8 s) |
| Measured, first three minutes | **0.90 documents a second**, 0 refusals, 0 not a bill; 84 stored of the first 109 (the rest in the open batch of 50) |
| Projected finish | **about 2026-09-15 19:50 UTC** (29.9 h at 0.90/s), later if legacy LIS starts refusing |

The pace is the one the trial and the refusals set: the 13 refusals in the
ranking came at 2.5 a second, none has come at 0.9. The box has no stop timer,
so a day-long run survives; it holds 125 MB.

**Watching it.** On the box, `~/govblock-xml/logs/va-refetch/`:

- `run.log`: a line a minute with tried, stored, not a bill, refused, the pace
  and the hours left.
- `failures.jsonl`: every document not stored, and why.
- `cursor`: the last document settled; the run resumes after it.

A restart is the same line:
`cd ~/govblock-xml && (setsid nohup node --max-old-space-size=1024 scripts/xml/va-refetch.mjs --run --pause-ms 1000 >> logs/va-refetch/run.log 2>&1 < /dev/null &)`.
Documents refused four times each are asked again at the end with
`--retry-refused`.

**Sharing the box.** Window 8's rebuilds run on the same box and the same Data
API. The re-fetch writes 50 rows about every minute. If the two contend, the
re-fetch yields: it is the longer job and bound by the legislature's pace
anyway.

**After the run.** Count what is still 323 characters, retry the refused, then
queue Virginia's bills from the Ingestion page (Run, Virginia, bills, "Again,
if built") and re-measure its coverage line. Before stopping the box, check
that the queue is empty and that no other window's controller or jobs are
pending.

### Milestone 2 — the trial, a wrong join caught and corrected (2026-09-14, 13:50 UTC)

**The trial (300 documents from the Mac, 750 ms pause) found a bug in the
target list before the full run.** `"Documents".document_id` is not unique:
document 86655 is a Maryland veto letter, Virginia's HB1535 as introduced and
Virginia's HB2125 amendments, three rows. The first target query joined on
`document_id` alone, so it listed 124,967 links for 97,015 documents, and the
dedupe kept an arbitrary one.

What that cost, counted from the trial's log and the rows:

- **About 170 requests went to other legislatures' hosts** (Maryland 84,
  Louisiana 15, Utah 13, Arizona 11, Wyoming 10, Indiana 8, Kansas 7,
  Mississippi 7, and a few each elsewhere), one at a time with the pause. None
  of those pages has legacy LIS's bill division, so none was stored; each is
  named in `logs/va-refetch/failures-trial-bad-join.jsonl`.
- **100 rows were written. 92 held the right bill** (the number printed in the
  text equals the row's bill). **8 held a sibling Virginia document's
  amendment page** (HB1535's row held HB2125's committee amendments, and so
  on).
- **Corrected at 13:50 UTC**: the 8 re-fetched from their own links
  (`--only`, 8 bills, 137,040 characters), upserted over the wrong text. A
  recheck of all 100 rows: 0 whose printed number differs from their bill.
  Their `"Bills"` stamps take the longest text, so the right bill's length
  stands.

**Fixed.** Targets join `"Documents"` on the document and the text's own
bill, with a legacy LIS link: **97,015 targets, 0 links off legacy LIS, 0
repeats**, sessions 2010–2024. (97,115 texts are 323 characters; the other
100 have no Virginia link under their own bill.) The trial's cursor was
discarded with its target list; the full run starts from the first document,
and the 92 good rows cost a request and no write.

**The pipeline box was started at 13:50 UTC** for the full run.

### Milestone 1 — what the 323-character texts are, and the source (2026-09-14, 13:35 UTC)

**The captures.** Every one of them is the same 323 characters: legacy LIS's
"Sorry, your query could not be completed. Please reload/refresh this page to
retry your last request…" followed by the address it refused (107.22.138.174,
an AWS address). The walker fetched sessions 2010–2024 at about 45 documents a
second from AWS boxes (livingston `prompts/2026-08-29-native-text.md`: "legacy
CGI 2010–2024 115,688 documents in 0.71 h"), and legacy LIS answered the pace
with this page.

**How many.** The database holds **97,115** Virginia texts of exactly 323
characters, more than the 84,630 the pipeline counted in the 2026-09-01 lake
export:

| Session | Captures | Session | Captures |
|---|---|---|---|
| 2010 | 6,259 | 2018 | 7,748 |
| 2011 | 6,241 | 2019 | 7,167 |
| 2012 | 6,330 | 2020 | 9,647 |
| 2013 | 6,185 | 2021 | 6,139 |
| 2014 | 7,076 | 2022 | 7,341 |
| 2015 | 6,329 | 2023 | 6,584 |
| 2016 | 6,658 | 2024 | 937 |
| 2017 | 6,542 | 2025–2026 | 16 (counted by length; not error pages) |

Sessions 2025 and 2026 are real texts from the LIS API (18,997 rows). Counted
from `chars`, grouped by session, no text read and no random order.

**The source, ranked on fifty.** The sample was drawn through `"Bills"` (four
documents per session, 2010–2022, by `bill_id % 53`), one request at a time
from the Mac with a 250 ms pause:

| Source | Bill text | Refused | Median |
|---|---|---|---|
| `state_link` (legacy LIS: `lis.virginia.gov/cgi-bin/legp604.exe?161+ful+HB2+hil`, now redirected to `legacylis.virginia.gov`) | **37** | 13, in one unbroken run, then bills again | 137 ms |
| LIS API (`/LegislationText/api`) | — | — | not measured: it answers 401 without a key, and Brendan's registered `VA_LIS_API_KEY` is not configured on this Mac, in either repo's `.env.local`, or in SSM or Secrets Manager |

`state_link` wins. The page holds the whole bill in `<div id="mainC">`: its
number, the dates, the title, the patrons, the enacting clause and every
section, with new matter in `<i class=new>` (kept as the loader keeps inserted
matter, `{+…+}`). The thirteen refusals are the error page itself, drawn after
about thirty requests at 2.5 a second and gone seconds later: a pace limit,
not a missing bill. `robots.txt` on legacylis allows every agent. The dev box's
AWS address is answered too.

**The run, next.** `scripts/xml/va-refetch.mjs`:

- `--targets` lists the 97,115 from `"BillTexts"` by session and `chars`.
- `--run` asks legacy LIS for one document at a time. A refused document is
  waited on and asked again, up to four times, and every refusal slows the
  pace by half (750 ms at the fastest, 8 s at the slowest), speeding back up
  after 300 clean documents. Three documents in a row refused four times
  each stops the run with the cursor before them.
- A response that is not a bill is never stored; it is named in
  `logs/va-refetch/failures.jsonl`.
- Bills go into `"BillTexts"` in `TextBuffer`'s shape: 50 at a time or 1.5 MB,
  upserted on `document_id` and rewritten only when the hash or error differs,
  with the loader's tsvector cut. Each bill's `"Bills"` row is stamped after,
  keeping the longest text.

At one a second the run is about 27 hours, so it goes on the pipeline box
under `nohup` (no stop timers there, unlike the dev box), after a measured
trial of a few hundred documents.

### Milestone 0 — claimed (2026-09-14)

- Claimed after window 4's brief was accepted. Brendan's word, to window 4's
  session: claim it, the upsert into `"BillTexts"` allowed, through the
  existing loaders' shape, no deletes; compile on the pipeline box and stop it
  after.
- The loaders' shape, read before any write: livingston
  `api/_lib/text-shared.ts` `TextBuffer`. Rows go in 50 at a time (or 8 MB, or
  30 s), upserted on `document_id`, rewritten only when `text_hash` or `error`
  differs, then `"Bills".text_fetched_at` and `text_chars` are stamped per bill.
  Virginia's sources today: `api/_lib/text-sources/va-lis.ts` (the 2026
  session, LIS API with a key) and the `state_link` walker (earlier sessions,
  legacy LIS).
- Next: list the 84,630 by `document_id` from the lake Parquet with the
  pipeline's own error-page test, rank `state_link` against LIS on fifty of
  them, then the run.

### Files touched

- `apps/web/lib/xml/todo.ts` (the claim), `apps/web/docs/xml/window-7.md`
