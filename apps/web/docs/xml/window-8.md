# Window 8: grammars, round two — report

Report to the lead. The table is kept current; milestones below it, newest first.

| Line | Documents stored | Start, stored (window 2) | Start, sampled (100) | Current, sampled (100) |
|---|---|---|---|---|
| Oklahoma bills | 146,968 | 79.2 | 74.2 | **100.0** |
| Indiana statutes | 80,485 | 72.2 | 69.8 | **99.6** |
| Massachusetts bills | 69,255 | 72.9 | 71.4 | **98.5** |
| Oregon statutes | 60,136 | 77.9 | 76.7 | **98.8** |
| Colorado bills | 57,350 | 73.0 | 71.0 | **98.9** (real printings; 35% are archive banners) |
| Washington statutes | 51,380 | 78.7 | 79.8 | **98.8** |
| South Carolina bills | 49,119 | 74.5 | 76.0 | **97.0** (no profile; lifted at 18c0ca1) |
| Kansas statutes | 46,930 | 56.4 | 55.6 | **98.8** |
| Nevada statutes | 43,461 | 74.6 | 73.4 | **94.8** (the rest is paragraphs the loader drops) |
| Maryland statutes | 40,053 | 78.5 | 78.6 | 78.6 |
| Utah bills | 36,096 | 66.3 | 64.7 | 64.7 |
| Louisiana statutes | 33,706 | 71.7 | 70.8 | 70.8 |
| South Carolina statutes | 30,973 | 75.4 | 72.7 | 72.7 |
| Kentucky bills | 28,715 | 77.4 | 76.0 | 76.0 |
| New Hampshire bills | 27,612 | 73.5 | 77.1 | 77.1 |
| New Mexico bills | 24,254 | 64.8 | 65.3 | 65.3 |
| Vermont bills | 13,036 | 74.9 | 81.1 | 81.1 |

## Milestone 9 — Nevada statutes, 73.4% to 94.8% (2026-09-14)

- Every section opens "NRS 33.090 Catchline" and the "NRS" defeated the number test: 50 of 50 "no number at the start". Nevada sets `statuteCite`, `headingBlock` and `credit` for the Bureau's source notes ("(Added to NRS by …)", "[Part 12:190:1941; …]—(NRS A …)"). No change to `generic.ts`. Held-back fifty: 92.9%. Grammar: `grammars/nv.md`.
- **Acquisition, for window 7:** most of what still falls out is text the loader never stored. `scripts/laws/adapters/nv.mjs` skips every paragraph whose markup holds an in-page `#` link, to leave out the chapter's table of contents, and a paragraph of law that cross-references by anchor carries one. NRS 704.6623 is stored without its "1. A public utility that:"; NRS 483.270 without its "(b)" and "(d)". The fix is to tell contents from law by position, then reload Nevada's `"Laws"` and rebuild.
- **Rebuild, measured on the whole store:** Indiana statutes 80,485 rebuilt at 99.89% (stored 72.2% before), Oregon 60,136 at 98.98% (77.9% before; 1,005 fell out, under the known section-number rule, to confirm when Oregon's job is read), Washington under way.

## Milestone 8 — Kansas statutes, 55.6% to 98.8%; South Carolina bills at 97.0% without a profile; the first rebuild batch (2026-09-14)

- **Kansas.** A section is "21-5604." alone, the catchline as the next block, the law, then "History:" and the session laws. Kansas sets `headingBlock` and two new optional fields: `headingNext` (the heading is the next block, unless that block is already "History:", as in a repealed section) and `creditStart` (the blocks after "History:" are the `sourceCredit`). Section numbers may carry a comma ("68-5,101."). Indiana, Oregon, Washington, Florida and Alabama re-checked against HEAD: unchanged. Held-back Kansas fifty: 99.7%. Grammar: `grammars/ks.md`.
- **South Carolina bills** measure 97.0% on a hundred with no profile of their own. The same fifty printings run through each window-8 commit's front end moved only at 18c0ca1, 73.4% to 93.6%: a quarter of South Carolina's printings are resolutions opening "Whereas," and closing "Be it resolved", which Colorado's commit made a resolving clause. Left above the bar; a profile of its own can wait for the long tail.
- **Rebuilds.** The pipeline box (govblock-xml, 100.54.86.169, window 4's Virginia re-fetch running on it) was pulled fast-forward to 3962289, which carries every front end through Washington, and a controller started there at 14:04 UTC: `nohup node --max-old-space-size=8192 scripts/xml/run.mjs --watch --slots 3 --workers 4 > logs/watch-window8.log`. Queued under run `rebuild-w8-3962289` with `scripts/xml/enqueue.mjs` (the same rows the Ingestion page's "Again, if built" writes; the page was not driven from this session): Oklahoma, Massachusetts, Colorado and South Carolina bills, Indiana, Oregon and Washington statutes, 185 jobs. Indiana was building first, 10,846 rebuilt and none fallen out at the last look. The controller stays up for the later batches.
- **The captured pages, for acquisition** (the lead hands the Colorado re-fetch to window-4-va-ca beside Virginia and California). Each is caught by `ERROR_PAGE` in `lib/xml/frontends/generic.ts` and reports as dialect `error-page`, which the worker turns into a fall-out asking for a re-fetch:
  - Colorado: `Accessibility Archive\s+Archived Content`, 20,194 of 57,350 stored printings (every one a 201-character body), counted as the `us-co` bill rows at coverage 0.333 with `gz_bytes` under 700.
  - Oklahoma: `Home\s+Legislature Home\s+Senate Home`, the site's navigation (3,046 characters); 2,546 stored printings at coverage 0 is the likely count.
  - Massachusetts: `To view the text of (House|Senate),? No\.`, the 2011 placeholder; about one printing in fifty in each sample.
  A rebuild prunes index rows only when a job has no fall-outs, so these old rows stay in `expressions`; on the lead's word they are left for the re-fetch's compile to prune.

## Milestone 7 — Washington statutes, 79.8% to 98.8% (2026-09-14)

- Every section opens "RCW 11.68.110 Catchline." and the "RCW" defeated the number test, as "IC" did for Indiana. Washington sets `statuteCite`, `headingBlock`, `credit` for the bracketed session laws, and a new optional `notesStart`: the blocks after "Notes:" become `notes` of `note`. The bracket rule narrowed with it: a bracketed history is a `sourceCredit` and only a recodification citation is a `note` (Indiana re-checked, unchanged). Against HEAD, the ten lines of the regression set unchanged. Held-back Washington fifty: 99.4%. Grammar: `grammars/wa.md`.

## Milestone 6 — Colorado bills, 71.0% to 98.9% (2026-09-14)

- **Acquisition, for window 7:** 20,194 of Colorado's 57,350 stored printings are the archive site's 201-character banner ("Accessibility Archive / Archived Content …"), not bills. They report as `error-page` now, so a rebuild turns them into fall-outs asking for a re-fetch and takes them out of the store, as window 2 did for Virginia's error pages.
- The real printings are the General Assembly's PDF as text. The profile sets `marginNumbers`, `furniture` (page numbers, the reading stamps down the right edge, the amendment legend), `capsAreNew`, and a new optional `openersAtLineHead`: an enumerator at a line's head opens a block unless it reads as an instruction's list ("(1.5) (b), and (1.7) as follows:"). Quoted C.R.S. sections open "25-4-902." with a catchline of any length running into "(1)".
- Shared fixes Colorado exposed: inserted units with a decimal ("(1.5)", "(II.5)"); "A. \"TERM\" MEANS"; a quoted catchline running straight into its first subsection; "Be It Resolved" as a resolving clause. Against HEAD: California bills 99.8% to 100.0%, Arizona 99.1% to 99.4%; Texas, Florida, Alabama and the Oklahoma, Massachusetts, Indiana and Oregon held-back samples unchanged. Held-back Colorado: 99.8% on 18 real printings. Grammar: `grammars/co.md`.

## Milestone 5 — Oregon statutes, 76.7% to 98.8% (2026-09-14)

- 43% of Oregon's sections are a repealed or renumbered number and its bracketed history, and the number test needed text after the number: every stub read "no number at the start" on a block of two. Oregon sets `headingBlock`, `credit` for the Legislative Counsel's closing "Note:", and a new optional `versionOpens`: a section printed again as it will read on a later date ("109.206. (1) …" after the note) becomes a `level role="later version"`, which the schema allows in a section.
- Two parser fixes Oregon exposed, shared: units of several ranks opening on one line with no space ("(3)(a)(A)") are read at each rank; "(i)", "(v)" or "(x)" straight after "(h)", "(u)" or "(w)" of an open lettered rank is the next letter when the next lettered block is its successor, a numeral when it is "(ii)". Checked against HEAD: Florida statutes 95.4% to 98.2% on forty; Texas, California, Arizona, Alabama, and the Oklahoma, Massachusetts and Indiana held-back samples unchanged. Held-back Oregon fifty: 97.3%. Grammar: `grammars/or.md`.

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
