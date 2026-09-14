# Window 2: the pipeline

Report to the lead. Newest milestone first.

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
