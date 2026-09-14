# Window 8: grammars, round two — report

Report to the lead. The table is kept current; milestones below it, newest first.

Coverage is the grammar's number over the documents that are law. A captured page (an error page, a banner, a placeholder where the bill should be) reports as `error-page`, falls out of the pipeline asking for a re-fetch, and stays out of the current number; the start numbers counted them. The last column is what acquisition holds down, not grammar.

| Line | Documents stored | Start, stored (window 2) | Start, sampled (100) | Current, sampled (100) | Held down by captures or the loader |
|---|---|---|---|---|---|
| Oklahoma bills | 146,968 | 79.2 | 74.2 | **100.0** (99.87 rebuilt, 144,548) | 2,526 navigation pages fell out of the rebuild |
| Indiana statutes | 80,485 | 72.2 | 69.8 | **99.6** (99.89 rebuilt, 80,485) | — |
| Massachusetts bills | 69,255 | 72.9 | 71.4 | **98.5** (99.11 rebuilt, 69,094) | 161 placeholders fell out |
| Oregon statutes | 60,136 | 77.9 | 76.7 | **98.8** (98.98 rebuilt, 60,136) | — |
| Colorado bills | 57,350 | 73.0 | 71.0 | **98.9** (98.97 rebuilt, 37,156) | 20,194 archive banners fell out, 35% |
| Washington statutes | 51,380 | 78.7 | 79.8 | **98.8** (99.06 rebuilt, 51,380) | — |
| South Carolina bills | 49,119 | 74.5 | 76.0 | **97.0** (97.05 rebuilt, 49,119; no profile, lifted at 18c0ca1) | — |
| Kansas statutes | 46,930 | 56.4 | 55.6 | **98.8** | — |
| Nevada statutes | 43,461 | 74.6 | 73.4 | **94.8** | paragraphs the loader drops |
| Maryland statutes | 40,053 | 78.5 | 78.6 | **99.0** | — |
| Utah bills | 36,096 | 66.3 | 64.7 | **100.0** | 17,570 refusal pages, 49% |
| Louisiana statutes | 33,706 | 71.7 | 70.8 | **99.5** | — |
| South Carolina statutes | 30,973 | 75.4 | 72.7 | **99.5** | — |
| Kentucky bills | 28,715 | 77.4 | 76.0 | **99.9** | — |
| New Hampshire bills | 27,612 | 73.5 | 77.1 | **100.0** | — |
| New Mexico bills | 24,254 | 64.8 | 65.3 | **96.5** | — |
| Vermont bills | 13,036 | 74.9 | 81.1 | **97.4** | — |

## Milestone 17 — Vermont bills, 81.1% to 97.4%; every line of the seventeen at 90% or better (2026-09-14)

- Vermont's resolutions open "Resolved by the Senate and House of Representatives:" in mixed case after a caption the line joins, and the resolving-clause test took only capitals and "Be it resolved"; it now takes "Resolved by the Senate", "House" or "General Assembly" anywhere in a block. The profile sets the enacting formula, `marginNumbers`, `furniture` ("BILL AS INTRODUCED H.429", "2023 Page 1 of 10", "VT LEG #366703 v.4") and quoted sections opening "§ 2401.". The twenty-one other sampled lines unchanged against HEAD. Held-back fifty: 98.4%. Grammar: `grammars/vt.md`.
- **The bar is met on all seventeen lines, measured on a fresh hundred each:** the lowest is Nevada statutes at 94.8%, held there by paragraphs its loader drops; New Mexico 96.5%, South Carolina bills 97.0%, Vermont 97.4%, and the other thirteen at 98.5% or better. No line needed the 85% write-up. Four lines are held down in the store by captured pages rather than grammar (Colorado, Utah, Oklahoma, Massachusetts), and one by its loader (Nevada); each is named in the table and with the lead.
- **What the parser gained, shared by every state**, each checked against HEAD on the regression set as it landed: units of several ranks on one line ("(3)(a)(A)", "B.(1)", "B. 1."); inserted units by hyphen or decimal ("(1.5)", "(II.5)"); "(i)" after "(h)" read as a letter when "(j)" follows; a quoted catchline running into its first unit; resolutions in mixed case; struck words after a capital unit; private-use glyphs dropped. Every other change is an optional `StateProfile` field a state opts into: `marginNumbers`, `marginIndent`, `furniture`, `openersAtLineHead`, `bodyOnly`, `romanDot`, `lowerAfterCapital`, `prepare` for bills; `statuteCite`, `headingBlock`, `headingNext`, `restated`, `credit`, `creditStart`, `notesStart`, `versionOpens` for statutes.
- Next: the second rebuild batch for the ten lines committed since 3962289.

## Milestone 16 — New Mexico bills, 65.3% to 96.5% (2026-09-14)

- New Mexico sets each line's number thirty-two spaces in, past the three-space margin rule, so "SECTION 1." and "WHEREAS," never reached an opener: 37 of 50 read "no sections". The profile sets `marginNumbers` with a new optional `marginIndent` (the number at any distance from the edge), `furniture` (the legend beside every page, the drafting code, "- 2 -"), the enacting formula, quoted NMSA sections opening `"52-1-1.1.`, `del`, and a new optional `lowerAfterCapital`: "A. pertaining to …" is a subsection, where elsewhere "A." before a lowercase word stays prose.
- One shared change: a struck word may follow a capital-letter unit ("D. [Any] A person …"). The twenty other sampled lines unchanged against HEAD, including Texas, Utah, New Hampshire and South Carolina, which bracket struck matter too. Held-back fifty: 98.2%. Grammar: `grammars/nm.md`.

## Milestone 15 — New Hampshire bills, 77.1% to 100.0% (2026-09-14)

- A New Hampshire section is a bare number and its catchline ("1 Definitions; Animal Shelter Facility. Amend RSA 437:1, I to read as follows:"), which no opener took: 48 of 50 read "no sections". The profile sets the enacting formula, that opener with `strict` numbering, quoted RSA sections ("654:1", "21-I:5", "204-C:8-b"), `del` for bracketed struck matter, and three new optional fields: `romanDot` (I. II. III. as a rank, not letters), `openersAtLineHead`, and `prepare`, a rewrite before blocks are read, which takes a chaptered law's own prefix off its sections ("55:1" under "CHAPTER 55" reads as 1) and leaves quoted "654:1" alone.
- The nineteen other sampled lines unchanged against HEAD. Held-back fifty: 99.4%. Grammar: `grammars/nh.md`.

## Milestone 14 — Kentucky bills, 76.0% to 99.9% (2026-09-14)

- The shared fixes had already lifted Kentucky to 95.9%, but 67 of 71 bills still read "no sections". The cause was invisible: the Commission's word processor puts U+F0E2, a private-use symbol-font glyph, in front of every section opener, and "Section 1." never matched behind it. The block splitter now drops private-use characters before anything is read. Only Kentucky's samples hold any (305 across two fifties), and the eighteen other sampled lines are unchanged against HEAD, to the tenth of a point.
- The profile sets the enacting formula, `marginNumbers`, `furniture` ("UNOFFICIAL COPY 21 RS BR 104", "Page 1 of 20", "XXXX Jacketed", the drafting code), and a section opener that tolerates the older captures' stray "®". Held-back fifty: 99.5%. Grammar: `grammars/ky.md`.

## Milestone 13 — South Carolina statutes, 72.7% to 99.5%; the first rebuild batch finished (2026-09-14)

- Every section opens "SECTION 58-27-2760. Catchline" and the uppercase "SECTION" failed the number test on every one; the history is one block, "HISTORY: 1962 Code SECTION …". South Carolina sets `statuteCite`, `headingBlock` and `credit`; no change to `generic.ts`. South Carolina bills, which share the profile, re-checked against HEAD: unchanged. Held-back fifty: 97.7%. Grammar: `grammars/sc.md`, statutes and bills together.
- **`rebuild-w8-3962289` finished**, 185 jobs, no job failed. Colorado's fall-outs came to exactly 20,194, the banner count, so the store's count and the test agree to the document. Final figures are in the table.

## Milestone 12 — Louisiana statutes, 70.8% to 99.5%; the first rebuild batch on the whole store (2026-09-14)

- A Louisiana section is "RS 24:513.3" alone, then "§513.3. Catchline", the law, and its history ("Acts 1995, No. 1315, §1 …"). Louisiana sets `statuteCite` for the code prefixes, `headingBlock`, `headingNext`, `restated` and `credit`; the heading taken from the next block now drops its restated number. One shared fix: "B.(1)", a capital subsection and its first paragraph with no space between. Against HEAD: Indiana, Oregon, Washington, Kansas, Nevada, Maryland, Florida and Alabama statutes, Arizona and Oklahoma bills, unchanged. Held-back fifty: 98.9%. Grammar: `grammars/la.md`.
- **Rebuild `rebuild-w8-3962289`, on the whole store** (the table's "rebuilt" figures): Oklahoma bills 128,799 at 99.88% with 2,524 navigation pages fallen out; Indiana statutes 80,485 at 99.89%; Massachusetts bills 55,807 at 99.03% (20 placeholders out); Oregon statutes 60,136 at 98.98% (1,005 out under the repeated-section-number rule); Colorado bills 37,156 at 98.98% with 13,655 banners out (two jobs left); Washington statutes 51,380 at 99.16%; South Carolina bills 42,514 at 96.93%. The fall-out column on the Ingestion page now fills for these states.

## Milestone 11 — Utah bills, 64.7% to 100.0% on real printings (2026-09-14)

- **Acquisition, passed by the lead to window-4-va-ca:** 17,570 of Utah's 36,096 stored printings are a firewall's refusal, 122 characters: "The requested URL was rejected. Please consult with your administrator. Your support ID is: …". Caught by `The requested URL was rejected` in `ERROR_PAGE`; counted as the `us-ut` bill rows at coverage 0.333 with `gz_bytes` under 700. 61 of the hundred sampled.
- The real printings are the Legislature's printed bill, lines numbered straight through, with a running head and foot of the printing's date, time and bill. Utah sets `marginNumbers`, `openersAtLineHead`, `del` for bracketed struck matter, `furniture` (the date-and-bill stamps, "-4-", the bar code "*SB0169S03*", the bill number against the right margin), "Section 1." as the bill section and "10-8-22 . Water rates." as the quoted section. No change to the parser beyond the refusal test. Held-back fifty: 28 of 28 real printings clean. Texas, Oklahoma, Massachusetts and Colorado re-checked against HEAD: unchanged. Grammar: `grammars/ut.md`.

## Milestone 10 — Maryland statutes, 78.6% to 99.0% (2026-09-14)

- A Maryland section is "§5–230." alone, the parts joined by an en dash, then the law; the site serves no catchline. Both the "§" and the en dash failed the number test on every section. Maryland sets `statuteCite` and `headingBlock`, and the headingBlock number now takes an en dash. Indiana, Oregon, Washington, Kansas and Nevada re-checked against HEAD: unchanged. Held-back fifty: 50 of 50 clean. Grammar: `grammars/md.md`.

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

`apps/web/lib/xml/todo.ts`, `scripts/xml/worker.mjs`, `scripts/xml/run.mjs`, `scripts/xml/coverage.mjs`, `apps/web/lib/xml/coverage.generated.json`, `apps/web/lib/xml/frontends/generic.ts`, `apps/web/lib/xml/frontends/profiles.ts`, `apps/web/docs/xml/window-8.md`, and a grammar each under `apps/web/docs/xml/grammars/`: `ok.md`, `in.md`, `ma.md`, `or.md`, `co.md`, `wa.md`, `ks.md`, `nv.md`, `md.md`, `ut.md`, `la.md`, `sc.md` (statutes and bills), `ky.md`, `nh.md`, `nm.md`, `vt.md`. Never `lib/xml/frontends/us.ts` (the federal front end) or the schema.

## For Brendan

- Nothing yet.
