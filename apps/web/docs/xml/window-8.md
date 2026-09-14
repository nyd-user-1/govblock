# Window 8: grammars, round two — report

Report to the lead. The table is kept current; milestones below it, newest first.

| Line | Documents stored | Start, stored (window 2) | Start, sampled (100) | Current, sampled (100) |
|---|---|---|---|---|
| Oklahoma bills | 146,968 | 79.2 | 74.2 | **100.0** |
| Indiana statutes | 80,485 | 72.2 | 69.8 | **99.6** |
| Massachusetts bills | 69,255 | 72.9 | 71.4 | **98.5** |
| Oregon statutes | 60,136 | 77.9 | 76.7 | 76.7 |
| Colorado bills | 57,350 | 73.0 | 71.0 | 71.0 |
| Washington statutes | 51,380 | 78.7 | 79.8 | 79.8 |
| South Carolina bills | 49,119 | 74.5 | 76.0 | 76.0 |
| Kansas statutes | 46,930 | 56.4 | 55.6 | 55.6 |
| Nevada statutes | 43,461 | 74.6 | 73.4 | 73.4 |
| Maryland statutes | 40,053 | 78.5 | 78.6 | 78.6 |
| Utah bills | 36,096 | 66.3 | 64.7 | 64.7 |
| Louisiana statutes | 33,706 | 71.7 | 70.8 | 70.8 |
| South Carolina statutes | 30,973 | 75.4 | 72.7 | 72.7 |
| Kentucky bills | 28,715 | 77.4 | 76.0 | 76.0 |
| New Hampshire bills | 27,612 | 73.5 | 77.1 | 77.1 |
| New Mexico bills | 24,254 | 64.8 | 65.3 | 65.3 |
| Vermont bills | 13,036 | 74.9 | 81.1 | 81.1 |

## Milestone 4 — Massachusetts bills, 71.4% to 98.5% (2026-09-14)

- Two surfaces. Captures before 2013 hold the body alone, and an act of one section prints no "SECTION 1.", so a third of the sample read "no enacting formula" and "no sections". From 2017 the printed bill numbers its lines straight through, past the two digits the share-based stripper takes. The profile sets `marginNumbers` (now to four digits), `furniture` for "7 of 92", and a new optional `bodyOnly`: with no section opener anywhere, the first block is the one section's instruction. Quoted sections open "Section 51L." or a bare "197A." alone on its line. Oklahoma re-checked on both samples after the four-digit change: unchanged.
- The 2011 placeholder "To view the text of House, No. 4215, please copy and paste the following URL" reports as `error-page`. A held-back fifty: 46 of 49 clean at 99.6%. Grammar: `grammars/ma.md`.

## Milestone 3 — Indiana statutes, 69.8% to 99.6% (2026-09-14)

- Every Indiana section opens "IC 6-3.6-7-9 Heading", and the "IC" defeated the number test: 100 of 100 "no number at the start", then the "Sec. 9. (a)" restatement hid each section's first subsection. Four optional statute fields on `StateProfile`, set only by Indiana: `statuteCite`, `headingBlock`, `restated`, `credit`. History credits become `sourceCredit` and recodification citations `note`. A held-back fifty: 50 of 50 clean. Grammar: `grammars/in.md`.

## Milestone 2 — Oklahoma bills, 74.2% to 100.0% (2026-09-14)

- Every Oklahoma printing numbers every margin line, blank ones too, so the generic stripper's share test missed and a bill collapsed into one block (43 of 100 "no sections"). The profile now declares `marginNumbers` and `furniture` (footers, drafting codes, the floor version's legend), two optional `StateProfile` fields no other state sets.
- Two parser fixes in `generic.ts` that Oklahoma exposed and every state shares: "B. 1." opens a subsection and its first paragraph; a quoted section whose first line opens an enumerator ("Section 461. A. If …") no longer takes "A." as its catchline. Checked against HEAD on forty printings each of Texas (99.5%), California (99.8%) and Arizona (99.1%): unchanged.
- Captured navigation pages report as `error-page`, and `coverage.mjs` keeps error pages out of the mean as the pipeline keeps them out of the store. A second sample of fifty, held back from the derivation, parsed 48 of 48 clean. Grammar: `grammars/ok.md`.
- Rebuild not yet queued: the pipeline box is stopped; rebuilds go in one batch once several lines land.

## Milestone 1 — claimed, fall-outs for the states, the sample made to match the store (2026-09-14)

- Claimed in `todo.ts` (14ce102).
- **State fall-outs into `xml_fallouts`** (8fa8f39). The worker folds each `report.notes` entry to its pattern, the way `coverage.mjs` folds them ("subsection N after N"), and the controller adds a job's twenty most frequent patterns as stage `coverage`, each with its document count and the first Work that raised it. Takes effect on the next job the pipeline box runs; nothing rebuilt for it.
- **`scripts/xml/coverage.mjs` samples what the pipeline compiles** (2dd44bc). Two faults made the sampled number disagree with the stored one:
  - statutes were sampled at `length(text) > 200`, which drops the history-note stubs ("401.834 [1989 c.1063 §6; renumbered 403.335 in 2009]"): 43% of Oregon's sections, 38% of Kansas's, 17% of Indiana's. Oregon sampled 97.9% against 77.9% stored.
  - bills were read with their texts in one statement, which passed the Data API's megabyte for Oklahoma, Colorado, Utah and New Mexico, and only from the last three sessions.
  Now every leaf section with text, every printing (the pipeline's `NOT_A_PRINTING` filter) of every session (`--since <year>` narrows it), each text read on its own in 200,000-character slices. Sampled at 100, the numbers land within two points of window 2's stored ones.

## Files touched

`apps/web/lib/xml/todo.ts`, `scripts/xml/worker.mjs`, `scripts/xml/run.mjs`, `scripts/xml/coverage.mjs`, `apps/web/lib/xml/coverage.generated.json`, `apps/web/lib/xml/frontends/generic.ts`, `apps/web/lib/xml/frontends/profiles.ts`, `apps/web/docs/xml/grammars/ok.md`, `apps/web/docs/xml/window-8.md`

## For Brendan

- Nothing yet.
