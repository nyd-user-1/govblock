# Window 2: the pipeline

Report to the lead. Newest milestone first.

## Finish line — the corpus is compiled (2026-09-14, 10:24 UTC / 06:24 EDT)

### Stored

**5,021,727 USLM Expressions, 14.97 GB gzipped**, under `s3://govblock-lake-638175140432/lake/v1/xml/`, each with its row in `expressions`. The queue is empty: 2,886 jobs done (440 of them rebuilds on corrected front ends), 0 failed, 2 blocked by design. Run window: 08:55 to 10:24 UTC, 89 minutes, over the dev box and the pipeline box.

| Class | Expressions |
|---|---|
| Federal bill printings, 113th–119th Congresses | 134,727 |
| United States Code sections and court rules | 59,849 |
| State bill printings, every state and D.C. | 2,865,305 |
| State statute sections, every state and D.C. | 1,961,846 |

Blocked, with the reason on the job: the 111th and 112th Congresses. GovInfo publishes no bill XML before the 113th, and `"BillTexts"` holds no federal text before 2013.

**Validation:** 800 documents sampled at random pass `xmllint --noout` (300 across the store, 300 state bills and statutes built in the final hour, 200 state statute sections), 0 failures. S3 and the index agree object for object where they were compared (Delaware 18,976, Wyoming 9,892).

**Rate:** 2,000–2,600 expressions/s sustained on the pipeline box once the cluster cleared (2,578/s over the last five minutes of the rebuilds). The best minute was 2,885/s.

### Coverage by jurisdiction, on the front ends as they stood at the end

Coverage is the mean over every stored document of the share that parsed cleanly into the vocabulary. The fidelity tier stays `native-xml` federally and `plain-text` for the states, whose sources are text.

| Jurisdiction | Bill printings | Coverage | Statute sections | Coverage |
|---|---|---|---|---|
| `us` | 134,727 | 99.9 % | 59,849 | 99.6 % |
| `us-ak` | 13,205 | 94.4 % | 20,226 | 93.0 % |
| `us-al` | 39,529 | 97.4 % | 48,530 | 98.7 % |
| `us-ar` | 17,182 | 98.6 % | 38,188 | 94.5 % |
| `us-az` | 45,938 | 98.7 % | 24,960 | 98.9 % |
| `us-ca` | 170,178 | 95.9 % | 161,426 | 99.5 % |
| `us-co` | 57,350 | 73.0 % | 35,101 | 97.1 % |
| `us-ct` | 60,217 | 92.9 % | 29,671 | 96.7 % |
| `us-dc` | 12,202 | 97.2 % | 23,492 | 98.3 % |
| `us-de` | 11,076 | 80.4 % | 10,020 | 99.6 % |
| `us-fl` | 61,810 | 93.6 % | 24,866 | 96.7 % |
| `us-ga` | 50,417 | 95.3 % | 29,411 | 95.9 % |
| `us-hi` | 150,483 | 99.1 % | 10,120 | 99.2 % |
| `us-ia` | 29,239 | 99.1 % | 26,680 | 98.0 % |
| `us-id` | 7,305 | 99.4 % | 20,465 | 99.3 % |
| `us-il` | 157,825 | 91.6 % | 72,646 | 89.9 % |
| `us-in` | 36,724 | 97.1 % | 80,485 | 72.2 % |
| `us-ks` | 2,717 | 95.9 % | 46,930 | 56.4 % |
| `us-ky` | 28,715 | 77.4 % | 35,484 | 99.3 % |
| `us-la` | 94,632 | 91.6 % | 33,706 | 71.7 % |
| `us-ma` | 69,255 | 72.9 % | 24,150 | 96.1 % |
| `us-md` | 79,533 | 99.8 % | 40,053 | 78.5 % |
| `us-me` | 27,676 | 94.9 % | 32,753 | 99.6 % |
| `us-mi` | 71,851 | 94.5 % | 41,752 | 99.2 % |
| `us-mn` | 82,973 | 99.5 % | 50,191 | 97.3 % |
| `us-mo` | 49,546 | 93.5 % | 29,275 | 99.9 % |
| `us-ms` | 87,342 | 99.4 % | 29,982 | 96.7 % |
| `us-mt` | 43 | 98.4 % | 41,188 | 99.5 % |
| `us-nc` | 51,786 | 96.1 % | 41,291 | 98.5 % |
| `us-nd` | 6,515 | 95.5 % | 16,973 | 99.6 % |
| `us-ne` | 19,881 | 94.9 % | 55,676 | 93.7 % |
| `us-nh` | 27,612 | 73.5 % | 28,122 | 91.6 % |
| `us-nj` | 106,394 | 97.3 % | 56,267 | 90.6 % |
| `us-nm` | 24,254 | 64.8 % | 31,321 | 99.9 % |
| `us-nv` | 21,369 | 98.5 % | 43,461 | 74.6 % |
| `us-ny` | 226,379 | 97.9 % | 40,543 | 97.9 % |
| `us-oh` | 7,551 | 95.5 % | 33,830 | 97.0 % |
| `us-ok` | 146,968 | 79.2 % | 35,658 | 98.6 % |
| `us-or` | 54,539 | 92.7 % | 60,136 | 77.9 % |
| `us-pa` | 58,784 | 87.6 % | 14,045 | 99.7 % |
| `us-ri` | 46,231 | 91.0 % | 32,167 | 99.3 % |
| `us-sc` | 49,119 | 74.5 % | 30,973 | 75.4 % |
| `us-sd` | 10,425 | 99.2 % | 18,012 | 99.6 % |
| `us-tn` | 110,905 | 99.1 % | 35,419 | 95.7 % |
| `us-tx` | 174,255 | 98.9 % | 123,322 | 98.5 % |
| `us-ut` | 36,096 | 66.3 % | 28,310 | 100.0 % |
| `us-va` | 30,872 | 93.3 % | 33,355 | 99.1 % |
| `us-vt` | 13,036 | 74.9 % | 22,349 | 96.1 % |
| `us-wa` | 39,729 | 98.6 % | 51,380 | 78.7 % |
| `us-wi` | 23,461 | 89.5 % | 16,344 | 100.0 % |
| `us-wv` | 52,570 | 97.6 % | 31,297 | 94.3 % |
| `us-wy` | 11,611 | 88.2 % | 19,844 | 97.3 % |

Below 80 %, the profiles to look at next:

- **Statutes:** Kansas 56 %, Louisiana 72 %, Indiana 72 %, Nevada 75 %, South Carolina 75 %, Oregon 78 %, Maryland 79 %, Washington 79 %.
- **Bills:** New Mexico 65 %, Utah 66 %, Massachusetts 73 %, Colorado 73 %, New Hampshire 74 %, South Carolina 75 %, Vermont 75 %, Kentucky 77 %, Oklahoma 79 %.

### What fell out

55,083 documents fell out of the first pass (1.1 %). The index keeps samples, fifty per reason per job.

- **Captured error pages**: Virginia's `"BillTexts"` holds 84,630 error pages where the bill should be (74 % of its bill documents). The first pass stored them as empty bills. They're now fall-outs that name the re-fetch. Their index rows are removed, and 69,630 of their objects are deleted from S3 (the other 15,000 went in the first, interrupted pass). Virginia's 30,872 stored printings are the real ones.
- **Section number repeats in its container**: a state code whose section numbers repeat where the front end declares them code-wide. The second of each pair is held back rather than guessed (2,487 samples).
- **Bill number does not split**: `"Bills".bill_number` values with no leading letters (300 samples).
- **One printing** with no date anywhere, and **one index row** the database refused.

### The floor: how Brendan runs what is left

The Ingestion page (`/workspace/dashboard/ingestion`, admin only) queues jobs; a controller on a box compiles them.

1. Start the pipeline box. `ssh govblock-xml-direct`.
2. `cd ~/govblock-xml && nohup node --max-old-space-size=8192 scripts/xml/run.mjs --watch --slots 3 --workers 4 > logs/watch.log 2>&1 &`
3. On the page, **Run**: pick a jurisdiction (or every state), bills or statutes, optionally sessions or laws. Tick "Again, if built" to rebuild on an improved front end. Progress shows in **Queue** within 30 seconds.

A rebuild on a corrected front end is a job queued again under a run named `rebuild-…` (the page's "Again, if built", or `scripts/xml/enqueue.mjs --run rebuild-<hash>`). It rebuilds in place and removes index rows the earlier build addressed differently.

### The nightly run

`scripts/xml/nightly.mjs` ran once for real at 10:10 UTC. It queued the 119th Congress under `nightly-2026-09-14`, re-read GovInfo's zips, and found all 21,640 printings unchanged, in 2 min 47 s; the unchanged-row touch that took most of that is now batched. No state printing and no law had been written since 09:00 UTC. The last `"BillTexts"` write of any state was before the Parquet export of 2026-09-01, so the Parquet backfill is current. `ops/xml/lv-xml-nightly.json` is the worker box's job definition, shipped `enabled: false`, with what it needs in the file.

### Open

- **Orphan objects.** A rebuild that re-addressed a printing (a duplicate `state_link` copy dropped, a stage renumbered) removed the old index row but not its object; the box cannot delete from S3. Virginia shows 4,091 objects beyond its index rows. The stream under `lake/v1/xml/` should be reconciled before it is sold: list the prefix against `expressions.s3_key` and delete the difference, from a role that can delete.
- **Coverage fall-outs are empty for the states.** The generic front ends report problems in `report.notes`, not unknown element names, so the per-job `coverage` fall-outs only fill for federal documents. Aggregating the notes is the Compiler page's next input.
- **Not exercised in a browser:** the Ingestion page's run controls and the export route under an admin session. Both compile on the branch server and answer 403 unsigned; their SQL was run against the cluster directly.
- **Idle boxes.** The pipeline box is idle and can be stopped. The dev box's idle timer is back on.

### Files since milestone 3

`scripts/xml/run.mjs` (hand-over only when a thread has room, watchdog, index backpressure, rebuild runs and pruning, coverage fall-outs), `scripts/xml/worker.mjs` (error pages fall out), `scripts/xml/lib/store.mjs` (backlog, batched touch), `scripts/xml/lib/emit.mjs` (a section's number and heading from the loader when the front end finds none), `scripts/xml/sources/statutes.mjs` (oversized sections in slices), `scripts/xml/sources/state-bills.mjs` (four histories kept), `apps/web/lib/policy/expressions.ts` and `apps/web/components/admin/pages/ingestion.tsx` (reads that fit the cluster, the Nightly Ingestion card).

## Milestone 3 — on the pipeline box, every jurisdiction compiling, two million stored (2026-09-14, ~06:00 EDT)

### Where it stands at 09:58 UTC

**1,983,207 expressions stored**:

| Class | Stored |
|---|---|
| Federal bills | 134,727 |
| US Code | 59,849 |
| State statutes | 703,674 |
| State bills | 1,125,388 |

Queue: 1,067 jobs done, 16 running, 1,802 queued (the first pass plus the rebuilds below), 2 blocked (the 111th and 112th Congresses).

| | |
|---|---|
| Sustained rate, last 5 minutes | **1,312 expressions/s** (393,606) |
| Best minute | 2,885/s (09:35 UTC, before the cluster filled) |
| What remains | ~1.29 M state statute sections (1,989,119 leaves with text in `"Laws"`), ~1.83 M state printings, ~0.85 M rebuilds on the corrected front ends |
| Finish at 1,300/s | **~10:50 UTC (06:50 EDT)** |
| Finish at the lead's 500/s floor | ~12:15 UTC (08:15 EDT), still inside the window |

**Validation:** 300 of 300 documents sampled at random across the store pass `xmllint --noout` (well-formed).

### The switch

The controllers moved to the pipeline box (`govblock-xml-direct`, c7g.4xlarge, 16 vCPU) at **09:31 UTC**. The dev box has run no controller since. Running there now:

- 1 statutes controller: 6 job slots, 3 threads.
- 4 bills controllers: 3 slots and 4 threads each.
- 1 controller just for Illinois statutes.

Parquet reader recreated at `~/xml-tools`.

### The cluster was at its ceiling from 09:30 UTC

aurora-2525 sat at its 8 ACU maximum with CPU at 100% from 09:30 UTC. Three causes:

1. **Five orphaned coverage queries** from `scripts/xml/coverage.mjs` (the lead's), `order by random()` over `"BillTexts"` joined to `"Bills"`: full scans of 50 GB of text, running 37–41 minutes after their clients had stopped. Cancelled at 09:34 UTC with `pg_cancel_backend`, on the lead's word. The coverage script no longer samples that way.
2. **ClaudeBot on production** (found by the lead in the Amplify access log): 2,444 requests from 09:18 to 09:38 UTC, almost all cache misses, each bill page running `getBillText`; 15 concurrent copies were on the cluster at 09:45. The site has no `robots.txt`; the lead has one ready on the branch.
3. **Brendan's open tabs** polling the session aggregates about 35 times a minute (51 of their responses were 503s).

The pipeline's own index writes are the rest. The site answered a bill-list request in 0.65 s at the worst of it. The compiler's rate fell to ~500/s while all three ran and recovered after.

### The stall on the big sessions: the controller, fixed

New York's 2025 session stalled two controllers in turn, and New York 2021 and 2023 stalled another two: minutes of full CPU with nothing built.

- A V8 profile of the stuck process showed the main thread in the controller's own `wake()` and `compile()`, not in any front end.
- The job loop handed every document to the pool at once without waiting for room. All 34,216 New York printings waited in memory, and every reply from every thread woke all of them to re-check. That's quadratic, and it only shows on the largest sessions.
- **1ca3259** hands a document over only when a thread has room. New York 2025 then compiled dry in 17 s: 34,216 printings, 2,060/s, 99.05 % coverage, 0 fell out.

Two guards stay:

- **A watchdog.** A thread silent for 60 s on one document is replaced; that document falls out naming its work, and the thread's other tasks go again.
- **Index backpressure.** The job stops reading while more than three index batches are waiting, and a waiting result no longer holds its document's text.

### Rebuilds on corrected front ends

The lead's front ends improved three times during the load; each change is a queue, not a restart of the corpus. A job under a `rebuild-` run rebuilds in place and then removes index rows an earlier build of the same unit addressed differently. Objects stay in S3.

- `rebuild-ny-4d4e888`: New York statutes (dotted section numbers, Constitution headings). Done.
- `rebuild-bills-5682861` and `rebuild-statutes-5682861`, 275 jobs at priority 95, after the first pass. They cover every state bill session and state statute unit built before 09:42:44 UTC: inserted units opening blocks, quoted law in all its shapes, a real statute parser for every state (Alabama statutes were at 48 % on the bill parser), and profiles for Michigan, North Carolina and Oregon.
- `rebuild-*-requeued`: jobs caught mid-run by a controller restart, which rebuild what they already held.
- `rebuild-il-700e533`: Illinois statutes (the citation line before "Sec."), rerunning after two fixes below.

### Also built since milestone 2

- **The nightly step:**
  - `scripts/xml/nightly.mjs` queues what the night's loads changed under `run = nightly-<date>` and drains only those: the current Congress again (unchanged printings skipped by source hash), a `delta@<since>` job per state from `"BillTexts".fetched_at`, and a statute job per law `"Laws"` rewrote.
  - `scripts/xml/sources/bill-delta.mjs` reads the delta from Aurora; the dating is shared with the Parquet reader (`printings.mjs`), so a printing gets the same address from either.
  - **`ops/xml/lv-xml-nightly.json`** is the job definition in the worker box's manifest format. What it needs is written in the file: copy it to livingston `ops/box/jobs.d/`, a govblock checkout on the worker box, `apps/web/.env.local`, and an instance role with `s3:PutObject` under `lake/v1/xml/` and `rds-data` on aurora-2525. It ships `enabled: false`.
- **The US Code's appendix titles** read their `<courtRule>`s (`/us/usc/t18a/courtRules/Crim/rule1`), kept as the OLRC writes them.
- **A printing read twice** (a legislature's web page through `state_link` and a clean feed such as `ca-pubinfo` or `nysenate`) keeps the feed.
- **Coverage fall-outs.** Each job writes its twenty most frequent unknown elements to `xml_fallouts` as stage `coverage`, for the Compiler page.
- **Oversized statute sections.** A section over 1 MB on its own (Illinois has them) is read in 200k-character slices. Illinois failed twice getting there: first on the page size, then on an uncast offset.
- **The Ingestion page's Nightly Ingestion card:** each feed's last write, with the XML step as the last line.

### Coverage on the full load, first pass (before the rebuilds)

Measured over every document built, not a sample:

| Jurisdiction | Coverage |
|---|---|
| Federal bills | 99.88 % |
| US Code | 99.60 % |
| New York statutes | 97.42 % |
| Hawaii bills | 99.64 % |
| Minnesota bills (2025) | 99.79 % |
| Maryland bills (2023) | 99.81 % |
| Arizona bills (2026) | 97.9 % |
| Oklahoma bills | 68.71 % |
| Illinois bills | 30.99 % |

Low first passes that the rebuild queue covers: Alabama statutes 48.40 %, Arizona 50.16 % and Arkansas 59.77 %, all read by the bill parser before dc02906.

### For sources.md (window 3)

- California's `state_link` texts are often leginfo web pages (window 1: 581 of the newest 3,000). `ca-pubinfo` is preferred wherever both exist, and the pipeline now drops the `state_link` copy.
- New York's `"BillTexts"` carries 12,549 sponsor memos in its 2025 session alone (and ~11,700 in each of 2021 and 2023). They're left out as not printings.
- `"Documents".date` is null for every state printing checked, so state printings are dated from BillHistory (`date_basis = 'history'`).
- GovInfo's own metadata carries an impossible date ("2019-00-12") on a 116th-Congress printing; the package MODS `dateIssued` stands in.

### Files since milestone 2

`scripts/xml/run.mjs`, `worker.mjs`, `nightly.mjs`, `lib/store.mjs`, `sources/{index,usc,statutes,state-bills,printings,bill-delta}.mjs`, `ops/xml/lv-xml-nightly.json`, `apps/web/components/admin/pages/ingestion.tsx`.

## Milestone 2 — federal bills stored, the corpus queued, the dashboard and the export route (2026-09-14, ~05:30 EDT)

### Stored

Every federal bill printing GovInfo publishes as XML is stored: the **113th through 119th Congresses, 134,727 printings**. 1 fell out, 99.83–99.91 % coverage per Congress, every one `native-xml`, dated from the printing's own Dublin Core. The US Code is loading title by title from the OLRC release point (native USLM), then New York's statutes. 2,463 jobs are queued: the whole corpus in the program's order, visible on the dashboard.

| Congress | Printings | Fell out | Coverage | Minutes | Rate |
|---|---|---|---|---|---|
| 119th | 21,640 | 0 | 99.88 % | 0.9 | 400/s (7 threads) |
| 118th | 22,922 | 0 | 99.91 % | 1.0 | 377/s |
| 117th | 21,399 | 0 | 99.88 % | 1.2 | 286/s |
| 116th | 20,445 | 1 | 99.88 % | 0.9 | 278/s |
| 115th | 18,491 | 0 | 99.84 % | 0.9 | 358/s |
| 114th | 16,078 | 0 | 99.87 % | 0.8 | 353/s |
| 113th | 13,752 | 0 | 99.83 % | 0.7 | 325/s |

Every rate after the 119th is capped at 1 job slot, 4 threads and a 4 GB heap on the dev box (the lead's ruling). Each includes downloading and unzipping that Congress's 16 bulk zips.

**Sustained S3 rate:** 280–400 documents/s end to end while capped, PUTs included. Uncapped the same path measured 400/s with the zips on the same thread; the per-thread compile rate (861/s) says the dedicated box's 16 vCPU will be limited by S3 and the index, not CPU.

**Unchanged detection works:** the dashboard's first re-run of the 119th and the 117th read 43,039 printings and wrote nothing ("unchanged"), in 30–40 s each. That's how the nightly run stays cheap.

`expressionAt` answers against the store: H.R. 1 of the 119th on 2025-06-01 is `/us/bill/119/hr/1@2025-05-22_eh`, the House engrossment, which is right. The reported version of 2025-05-20 came before it, and the Senate's placement on the calendar came after.

### The box stopped at 09:00 UTC; not memory

The dev box shut itself down cleanly at 09:00:01 UTC, one minute after the uncapped federal run started. The previous boot's journal has no OOM and no killed process. **`govblock-stop.timer`** ("Stop the govblock dev box for the night", `shutdown -h now`) fires daily at 09:00 UTC. It fires next at 2026-09-15 09:00 UTC. The lead is disabling it, with the idle timer, on the pipeline box. Two jobs the stop killed were requeued by hand.

### Built

- **The controller** (`scripts/xml/run.mjs`, `worker.mjs`). It claims jobs from `xml_jobs` with `for update skip locked` and heartbeats every 30 s; a job whose heartbeat is 10 minutes old goes back in the queue. Worker threads run the front end, write the document with `lib/xml/ir.ts`'s `toXml`, hash, gzip and PUT. Index rows go back in batches of 1,000; a batch the database refuses is retried row by row, and the bad row becomes a fall-out, not a crash. `--rebuild` rebuilds held Expressions in place when a front end improves without changing its name. `--watch` polls for jobs the dashboard queues.
- **Readers** (`scripts/xml/sources/`):
  - `federal-bills.mjs`: GovInfo bulk zips; a printing with no date of its own takes GPO's `dateIssued` from the package MODS; a calendar-impossible date ("2019-00-12" is in GPO's metadata) doesn't count.
  - `usc.mjs`: the OLRC release point, one Expression per section, native.
  - `statutes.mjs`: `"Laws"` by law, one Work per leaf; addressed under its container where a number repeats (New York's Constitution); page size shrinks under the Data API's megabyte.
  - `state-bills.mjs`: the lake's Parquet (`bill_texts`, `bills`, `history_table`). Each printing is dated by the BillHistory action that produced it; memos, fiscal notes and failed fetches are left out.
- **The stored document** carries the Work in the root's `identifier`, `docStage` and `processedDate` in `<meta>`, and its provenance as `property` elements (`govblock:fidelity`, `coverage`, `dialect`, `frontEnd`, `builder`, `dateBasis`, `path`). It keeps its source's namespace (the OLRC still writes USLM 1.0's) and declares every prefix it uses.
- **`scripts/xml/enqueue.mjs`** queues the corpus (`--plan`) or any jurisdiction, kind and units. Pre-113th federal sessions go in as `blocked` with the reason.
- **`lib/policy/expressions.ts`**: `expressionAt(work, date)`, `expressionOf`, `expressionsOf` (a Work's DocHistory), `readUslm`, and the dashboard's aggregates.
- **`/api/xml/uslm/<address>`**. `.xml` returns the Expression as USLM (`application/xml`, with `x-govblock-address`, `-fidelity` and `-coverage` headers); `?at=YYYY-MM-DD` returns the one in force on that date; with no expression it returns the latest; `.json` returns the Work's DocHistory. It's gated as datasets are (`lib/entitlements.ts`, entity `datasets`). The Amplify compute role already has `s3:GetObject` on the lake bucket, so it works in production as built.
- **The Ingestion page** (`components/admin/pages/ingestion.tsx`, `/workspace/dashboard/ingestion`, in the rail under the unreviewed bucket). It uses Data Pipeline's frame and reads every 15 s. It shows:
  - six tiles: Expressions, Works, Jurisdictions, Per Second, Jobs Open, Finish
  - **Run** controls: jurisdiction, kind, units, front of the queue, again if built
  - **Queue**: running, waiting and failed with retry, cancel and front-of-queue, finished, and a tile per jurisdiction
  - **Store** by jurisdiction and kind
  - **Coverage** from `lib/xml/coverage.generated.json`
  - **Fall-outs**, **Runs**, and each window's **report** from `apps/web/docs/xml/`

  Routes: `/api/xml/status` and `/api/xml/jobs` (POST queues, PATCH retries, cancels or moves to the front), both an admin's (`reader_profiles.admin`). All three compile on the 3002 server. Unauthenticated they answer 403, as they should.

### Verified

Bounded type check on the seven app files: 0 diagnostics (2,541 files in the program). The routes compiled on the branch server (`/api/xml/status` 403, `/api/xml/uslm/…` 403 unsigned, `/workspace/dashboard/ingestion` 200). Stored objects were read back from S3 for H.R. 1, 1 U.S.C. 1 and N.Y. Const. art. I § 2. The index was checked against the logs.

### Open

- **US Code appendix titles** (`USC05A`, `USC11A`, `USC18A`, `USC28A`, `USC50A`) hold court rules as `<courtRule>`, not `<section>`, so they store 0 today. That's a small reader change, next.
- **Title 10 failed with "terminated"**: the OLRC dropped a long download. The reader now retries the transfer (after this milestone's commit), and the job is requeued.
- **New York statute headings**: in the Constitution the whole first sentence lands in `<heading>` (`/us-ny/const/artI/s2`). That's the New York front end's to fix, and a rebuild in place follows.
- **Not yet built:** the nightly job definition and delta readers (`BillTexts` and `"Laws"` fetched since the last run).

### Files

`scripts/xml/{run,worker,enqueue,migrate}.mjs`, `scripts/xml/lib/{address,emit,store}.mjs`, `scripts/xml/sources/{index,federal-bills,usc,statutes,state-bills}.mjs`, `sql/005_expressions.sql`, `apps/web/lib/policy/expressions.ts`, `apps/web/app/api/xml/{uslm/[...address],status,jobs}/route.ts`, `apps/web/components/admin/pages/ingestion.tsx`, `apps/web/components/admin/pages/index.tsx` (registered), `apps/web/components/admin/items.ts` (rail entry).

### For Brendan

- The Ingestion page's **Finish** tile divides what remains of a 5.0 M-document corpus estimate by the last five minutes' rate. The estimate is the measured count from milestone 1, and it's a constant in the page.

## Milestone 1 — store live, throughput measured, projection (2026-09-14, ~05:15 EDT)

### Projection

The corpus finishes on one box inside the window. No second box is needed on
these numbers. The number to watch once the full run starts is sustained S3
PUTs per second.

| | |
|---|---|
| Expressions in the corpus | about 5.0 million: 3.08 M state bill printings (BillTexts with text, less US), ~150 k federal printings of the 113th–119th Congresses, ~1.7 M state statute sections and ~60 k US Code sections |
| Sustained rate, expected | **1,000 documents a second** (the S3 PUT rate from 7 worker threads) |
| Finish on one box | **~85 minutes** of load at 1,000/s; **~2 h 50 min** at a pessimistic 500/s |
| S3 cost | 5.0 M PUTs ≈ $25; ~20 GB gzipped at rest ≈ $0.50 a month |

### Measured on the box (t4g.2xlarge, 8 vCPU)

| Stage | Rate | How |
|---|---|---|
| GovInfo bulk zip download | 45.7 MB in 1.3 s | `BILLS-119-1-hr.zip`, 8,042 printings |
| Unzip | 154 MB in 4.9 s | fflate, streamed |
| Federal front end + serialize + gzip + sha256 | **861 documents/s per thread**, 99.93 % mean coverage | 3,000 printings of H.R. bills, 41 MB in; 7 threads ≈ 6,000/s of CPU headroom |
| S3 PUT, gzip body | **545/s at 32 in flight, 687/s at 96**, one process | 600 objects, removed after |
| Index rows, BatchExecuteStatement | 1,174 rows/s at 500 a batch; **1,837 rows/s at 1,000** | one stream, into `expressions`, removed after |
| State bill text from the lake Parquet | 302 MB of text, 34,495 rows in 4.2 s | `lake/v1/text/bill_texts/jurisdiction=us/session=2023`, hyparquet + zstd |
| `BillTexts` over the Data API | ~1 row/s | `where state and session_id order by document_id`, so bill text does not come from Aurora |
| `Laws` over the Data API | 528 rows/s, 0.79 MB/s per stream | NY PEN by `sequence_no`, 200 a page; 2.2 M rows ≈ 17 min over 4 streams |

The ceiling is S3 PUTs. CPU and the index both have room.

### Built

- **`sql/005_expressions.sql`, run on aurora-2525.** Three new tables: `expressions` (the index, one row per stored USLM object), `xml_jobs` (the run queue), `xml_fallouts` (samples of what did not compile). Additive only. The address columns follow `docs/xml/schema.md`: `work`, `expression`, the S3 key `lake/v1/xml/<work>/<expression>.xml`, and `date_basis` marking an inferred date.
- **New Expression versus rebuild.** A new Expression is written only when the source text's hash differs from the Work's latest. The same source built again by a better front end replaces its row and object in place. So tonight's plain-text state loads upgrade when window 3's grammars land, and they don't pile up as fake DocHistory. `"Laws"` keeps its upsert untouched.
- **`scripts/xml/migrate.mjs`** runs a `sql/` file over the Data API, one statement a call.
- **Box.** Made `~/govblock-xml` (local clone of `~/govblock`, origin set to GitHub, `feature/legislative-xml` pushed from the Mac, `.env.local` copied, `logs/` in `.git/info/exclude`), then `pnpm install` into it. Stopped `govblock-idle.timer` for the shift; the lead restarts it after. Window 1 runs the 3002 dev server.
  ```
  git clone ~/govblock ~/govblock-xml && cd ~/govblock-xml
  git remote set-url origin https://github.com/nyd-user-1/govblock.git
  git config receive.denyCurrentBranch updateInstead
  # from the Mac: git push govblock-dev-direct:govblock-xml feature/legislative-xml
  git checkout feature/legislative-xml && pnpm install --frozen-lockfile --prefer-offline
  sudo systemctl stop govblock-idle.timer
  ```
- **Parquet reader** at `~/xml-tools` on the box (`hyparquet`, `hyparquet-compressors`), outside the repo, so the shared `package.json` and lockfile stay untouched tonight.

### Sources, as found

- **Federal bills.** The 119th Congress is the only one with XML URLs in our tables (21,527 `congress_text_formats`, 21,349 `Documents`). `BillTexts` holds the 113th–118th as text with the tags stripped, filled from **GovInfo's bulk data** (`govinfo.gov/bulkdata/BILLS/<congress>/<session>/<type>/…zip`, livingston `api/bill-text.ts` `runGovinfo`). The pipeline reads the same zips, 16 a Congress, to get the native XML back. That's the published federal Manifestation, not a re-scrape of a site. `document_id` is livingston's `-(bill_id·100 + version slot + 1)`, so rows join back to `BillTexts`.
- **Federal before 2013.** `BillTexts` has no US row before session 2013, and GovInfo publishes no bill XML before the 113th. Sessions 2009 and 2011 are queued as `blocked` with that reason.
- **US Code.** `"Laws"` holds the Code as text with its USLM thrown away. The OLRC release point 119-103 that `scripts/laws/adapters/us.mjs` reads is not in the lake or the box's cache, so the Code job reads the same 54 title zips and stores each section's native USLM.
- **State bills.** From the lake Parquet (export of 2026-09-01T08:17Z), topped up from Aurora for rows fetched after the export. `"Documents".date` is null for every state printing checked (NY, CA, TX since 2023, 144,636 rows). So the date comes from BillHistory where it can be matched, else the fetch date, and `date_basis` says which.
- **State statutes.** `"Laws"`, 2,217,980 nodes, paged by `(law_id, sequence_no)`.
- **Index writes.** `BatchExecuteStatement`. The `aws_s3` import extension would need an IAM role associated with aurora-2525, and it has none. That's a cluster change, not additive DDL, so it isn't used.

### Next

The controller: `scripts/xml/run.mjs`, with worker threads for parse, serialize, gzip and PUT, and a main thread for sources and index batches. It claims jobs from `xml_jobs` with `for update skip locked` and heartbeats. Then the federal load, 119th backward, then the Code, New York and the rest. After that, `expressionAt`, the export route and the dashboard.

### Files

`sql/005_expressions.sql`, `scripts/xml/migrate.mjs`, `apps/web/docs/xml/window-2.md`.

### For Brendan

Nothing yet.
