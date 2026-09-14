# Window 7b: the orphan reconcile — report

Report to the lead. Newest milestone first. Run by window 6b, which claimed
`window-7` in `lib/xml/todo.ts` for the reconcile alone. Virginia and
California are window 4's and are reported in `window-7.md`. Part 2 of
`apps/web/docs/prompts/2026-09-14-acquisition.md`.

## Milestone 1 — the dry run's numbers (2026-09-14, 15:20 UTC)

**4,396 orphaned objects, 3.6 MB, in ten jurisdictions; Virginia's 4,091 are
93% of them.** Nothing deleted.

| Jurisdiction | Objects | Orphans | Orphan MB |
|---|---:|---:|---:|
| us-va | 68,318 | 4,091 | 2.4 |
| us-ok | 182,732 | 106 | 0.4 |
| us-co | 92,451 | 94 | 0.4 |
| us-al | 88,144 | 85 | 0.3 |
| us-nh | 55,734 | 9 | 0.0 |
| us-in | 117,214 | 5 | 0.0 |
| us | 194,578 | 2 | 0.1 |
| us-nj | 162,663 | 2 | 0.0 |
| us-pa | 72,830 | 1 | 0.0 |
| us-tx | 297,578 | 1 | 0.0 |
| **All jurisdictions** | 5,026,020 | 4,396 | 3.6 |

- The counts close exactly. 5,026,020 objects were listed, in 14:54–15:12 UTC,
  and 5,021,624 index keys were read, in 15:12–15:20. The difference is the
  4,396.
- No index row lacks its object.
- No object was modified in the hour before the listing, so none was set
  apart as recent. The pipeline was not writing to the bucket during the run.
- The other 42 jurisdictions have no orphans.
- The keys are in `logs/orphans-dryrun-2026-09-14.tsv`, on the Mac, not
  committed.

### For Brendan, through the lead

Delete the 4,396? The delete would remove only keys that still have no
`expressions` row at the moment of deleting, in batches of 1,000, from the
Mac's credentials, with the before-and-after counts reported here. The
storage saved is small, 3.6 MB. The reason to delete is that the stream is
sold as a dataset, and a buyer listing the prefix should find exactly what
the index names.

## Milestone 0 — the dry run, in progress (2026-09-14)

### What it does

`scripts/xml/orphans.mjs`, from the Mac's credentials, deletes nothing:

1. Lists every object under `s3://govblock-lake-638175140432/lake/v1/xml/`,
   with its size and when it was last modified.
2. Pages `expressions.s3_key` over the Data API by id, 5,000 rows a statement.
   Nothing here touches `"BillTexts"`.
3. Counts by jurisdiction, the first segment of the key:
   - objects no index row names: the orphans, with their bytes
   - objects modified in the hour before the listing began: counted apart as
     recent and never as orphans, because the pipeline box may be writing
     while the run lists
   - index rows whose object is missing
4. Writes each orphan key to `logs/orphans-dryrun-2026-09-14.tsv`, with its
   bytes and modified time. That file is what a delete would read.

The bucket is listed before the index is read. An object written during the
run whose row lands later therefore falls under recent, not orphans.

### Where it stands

Started at 14:54 UTC under `nohup`, logging to
`logs/orphans-dryrun-2026-09-14.log`. At 15:05 UTC it had listed 3,200,000
objects, about 200,000 every 40 seconds. The index read follows, then the
table.

### Next

The table by jurisdiction goes here when the run ends. Nothing is deleted
until Brendan's word comes through the lead. The delete will re-check each
key against the index at the moment of deleting, not trust the dry run's
list.

### Files

`scripts/xml/orphans.mjs`, `apps/web/docs/xml/window-7b.md`.
