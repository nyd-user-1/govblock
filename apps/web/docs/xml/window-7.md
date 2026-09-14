# Window 7: acquisition — report

Report to the lead. Newest milestone first. Each part is taken by the window
that claims its item in `apps/web/lib/xml/todo.ts`, under its own heading.

## Part 1, Virginia (`va-refetch`, claimed by window 4)

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
