# Window 2: the pipeline

Report to the lead. Newest milestone first.

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
