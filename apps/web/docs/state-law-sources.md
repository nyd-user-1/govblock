# Where the standing law of each jurisdiction comes from

Fifty-two jurisdictions publish their own statutes. This is the working record
of where each one puts them, what shape they are in, and whether a commercial
vendor sits between the legislature and the reader.

It is written as the work goes and is not finished. A row with no adapter is a
row nobody has built yet, not a jurisdiction whose law cannot be had.

## Every page says what it is current to

Each `/laws/<state>` page prints one small line at its foot: **Snapshot: <date>**.
It is the date the *source* states its text is current to — the US Code's
release point, the date on California's archive, the "current through" line in
the District's own XML — and where a source states nothing, the day its rows
were last read. Every jurisdiction here is a copy taken at a moment, including
the ones read from a live API this week, and the line says which moment rather
than leaving a reader to assume today.

## What "loaded" means

A jurisdiction is loaded when its rows are in the `Laws` table on Aurora with a
tree that hangs together — `parent_location_id`, `sequence_no` and `depth` are
what make the crumbs, the ordering and the search — and the existing browser at
`/laws/<state>` draws it with no further work. The shape is New York's, because
New York was first:

| column | what it holds |
| --- | --- |
| `law_id` | the publisher's own short id for the law — `GBS`, `BPC`, `USC26` |
| `law_name` | the law's name, set the way New York's are (Title Case) |
| `law_type` | `CONSOLIDATED`, `UNCONSOLIDATED`, `COURT_ACTS`, `RULES`, `MISC` |
| `location_id` | unique within `(state, law_id)`; the node's own address |
| `doc_type` | `SECTION` for a leaf, otherwise the level — `TITLE`, `CHAPTER`, `ARTICLE`, `PART`, `DIVISION` |
| `doc_level_id` | the number a reader would say aloud — "26", "1.5", "22757.12" |
| `parent_location_id` | the node above; null on exactly one root per law |
| `sequence_no` | document order, assigned by the runner, not the source |
| `depth` | 0 at the root |
| `text` | the section as prose, paragraphs kept, wrapping dropped |

`law_type` is New York's five. Every jurisdiction's codified statutes are
`CONSOLIDATED`; a constitution is `MISC`, which is what the browser labels
"Constitution".

## Copyright

A statute is not copyrightable, and a vendor that publishes one for a state
cannot own it. What a vendor may own is the layer it added — headnotes, case
annotations, editorial commentary, research references, its own numbering of
its own notes. **That layer is left behind. The text of the law is taken.**

This holds for every jurisdiction. Where a vendor sits in front, the row below
says so, and the adapter takes the statute and nothing the vendor wrote.

## The jurisdictions

Status: **loaded** · **building** · **sized** (source confirmed, adapter not
written) · **open** (not yet looked at).

| | Jurisdiction | Publisher | Format | Vendor in front | Status |
| --- | --- | --- | --- | --- | --- |
| US | U.S. Congress | Office of the Law Revision Counsel, `uscode.house.gov` | USLM XML, bulk, one file per title, at a release point | no | **loaded** — 57 laws, 61,009 sections |
| CA | California | Legislative Counsel, `downloads.leginfo.legislature.ca.gov` | tab-delimited tables in `pubinfo_<year>.zip`, section text as CAML XML | no | **loaded** — 30 codes, 161,427 sections |
| NY | New York | NY Senate, `legislation.nysenate.gov` | JSON API, whole law in one call, free key | no | **loaded** — 137 laws, 40,551 sections |
| DC | District of Columbia | DC Council, `code.dccouncil.gov` | XML on GitHub, one index per title and one file per section | no | **loaded** — 54 titles, 23,492 sections, current through 7 October 2021 |
| MA | Massachusetts | `malegislature.gov/api` | JSON API, no key, one request per section | no | **loaded** — 611 chapters, 26,326 sections; 87 more are repealed with no sections left, which is the API's own answer |
| TX | Texas | Legislative Council, `tcss.legis.texas.gov` | one API call per code for its whole tree, then one HTML file per chapter | no | **loaded** — 30 codes, 145,592 sections |
| FL | Florida | `flsenate.gov/Laws/Statutes` | HTML per chapter, `/ChapterN/All` for the whole of one | no | **building** — 49 titles. Counts requests per IP (`X-Throttle-Reason: crawler-penalty-active`, `Retry-After: 300`) and the penalty stuck to the AWS address, so it runs from a different one at two lanes |
| WA | Washington | Code Reviser, `app.leg.wa.gov/RCW` | HTML per title/chapter. The Code Reviser's bulk-download page has moved — its old address answers "Page not found" with a 200 — so the bulk route has to be found again | no | sized, bulk address unknown |
| VA | Virginia | Division of Legislative Automated Systems, `law.lis.virginia.gov` | HTML per title/chapter | no | sized |
| OH | Ohio | `codes.ohio.gov` (LAWriter, state-run) | HTML per section | no | sized |
| AZ | Arizona | `azleg.gov/arstitle` | HTML per title/section | no | sized |
| DE | Delaware | Code Revisors, `delcode.delaware.gov` | one HTML page per chapter | no | **loaded** — 31 titles, 10,081 sections. 403s AWS at width; four lanes and a quarter-second apart passes |
| CT | Connecticut | General Assembly, `cga.ct.gov/current/pub` | one HTML page per chapter, the whole chapter on it | no | **loaded** — 71 titles, 29,671 sections. Serves an incomplete certificate chain; the intermediate its own certificate names is fetched and added |
| AK | Alaska | `akleg.gov/basis/statutes.asp` | HTML per title | no | sized |
| CO | Colorado | General Assembly, `leg.colorado.gov` | PDF per title, published free | LexisNexis prints it; the state posts the PDFs | sized |
| AL | Alabama | `alison.legislature.state.al.us/code-of-alabama` | HTML behind a state-run viewer | no | sized |
| GA | Georgia | `legis.ga.gov/legislation/ocga` | viewer over LexisNexis | yes — take the statute, leave the OCGA annotations | sized |
| AR | Arkansas | General Assembly, via LexisNexis | vendor viewer | yes | sized |
| HI | Hawaii | `capitol.hawaii.gov` | HTML/PDF per chapter; refuses an unknown agent (403) | no | sized |
| IL | Illinois | `ilga.gov` | HTML; the site was rebuilt and the old ILCS paths are gone | no | open |
| MI | Michigan | `legislature.mi.gov` | HTML; the MCL paths moved | no | open |
| NC | North Carolina | General Assembly, `ncleg.gov` | one HTML file per chapter, the whole chapter in it | no | **loaded** — 396 chapters, 41,481 sections |
| PA | Pennsylvania | Legislative Reference Bureau, `legis.state.pa.us` | one HTML file per title, every unit marked by a `<div class="Comment">` | no | **loaded** — 51 consolidated titles, 14,045 sections. Black-holes the AWS range, so it is fetched from elsewhere; the unconsolidated statutes are a second pass |
| SC | South Carolina | Legislative Council, `scstatehouse.gov/code` | one HTML page per chapter, unannotated | no | **building** — 63 titles |
| OR | Oregon | Legislative Counsel, `oregonlegislature.gov/bills_laws/ors` | one HTML file per chapter, ISO-8859-1 | no | **building** — chapters enumerated, the index page names none |
| — | the remaining 27 states, plus the territories the record covers | | | | open |

## Notes per source

**U.S. Code.** Release point `119/103`, Public Law 119-103, 2 September 2026.
One zip per title, 59 of them including the five appendices. USLM already
carries the hierarchy, so nothing is inferred from heading text. The section's
own content and the OLRC's source credit are taken; the editorial notes are
left, being the layer around the law. Titles are shouted in the source and are
set in Title Case here, to read beside New York's.

The `/api/laws?list=1` route orders laws alphabetically by name, which is right
for New York and puts the 54 titles out of numerical order. The rail shows
`law_id` beside each name, so `USC26` still identifies Title 26.

**Massachusetts.** A plain JSON API with no key: `/Chapters` lists the 701
chapters, `/Chapters/<c>` a chapter's sections, `/Chapters/<c>/Sections/<s>` the
section's catchline and text. There is no bulk file and no way to get a whole
chapter's text in one call, so a full load costs a request per section — around
30,000 of them, which at one request at a time is a run of hours rather than
minutes. It is resumable at chapter granularity: the same command picks up
where it stopped.

A law here is a chapter, which is the unit Massachusetts cites ("G.L. c. 4,
§ 1"). The Part above it is named on the chapter rather than made into a level,
because the table holds one tree per law — the same choice New York's
consolidated laws make. Chapters the API returns as repealed with no sections
left are skipped, which is the API's own answer and not a failure to read them.

**California.** `pubinfo_2025.zip` is 1.28 GB because it also holds every bill,
vote and lobbying filing of the session. The three tables that are the law
weigh 12 MB, and the 162,432 section texts another 89 MB — each its own entry,
scattered through the archive. They are read by HTTP range rather than by
pulling the whole file: 101 MB instead of 1,280 MB.

`NODE_TREEPATH` is a dotted path, so the tree is the publisher's own and not
inferred. California does not give its sections headings — the code is
numbered, not captioned — so `title` is null on every section and the tree's
divisions and chapters carry the meaning. Fifty-three headings across the
thirty codes are unnumbered front matter; those take an empty `doc_level_id`,
which is what New York writes for the same thing.

**Texas.** `statutes.capitol.texas.gov` was rebuilt as an Angular application.
Every path tried — `/Download.aspx`, `/Docs/BC/htm/BC.1.htm`,
`/StatutesByDate.aspx` — answers with the same 250 KB application shell, so the
old static documents are gone and the data now sits behind an API that has to
be found before an adapter can be written. Nothing about this makes the
statutes unavailable; it makes them one discovery away.

**District of Columbia.** The Council publishes the Code as XML at
`github.com/DCCouncil/dc-law-xml-codified` — one index per title, one file per
section, `xi:include` between them, and a `<container>` that states its own
prefix, number and heading, so no level is inferred from heading text. The
whole repository is read as one archive rather than as 23,275 file requests.

**It is a snapshot.** The repository was published on 14 October 2021 and its
`index.xml` states the Code is current through 7 October 2021. That date is
printed at the foot of `/laws/dc`, and the page links `code.dccouncil.gov` for
a reader who needs today's text. A live source has not been found; when one is,
the adapter changes and the date moves with it.

Title 99, "Reserved sections", holds the permanent versions of provisions that
were temporarily amended — the Council's own arrangement, kept as they publish
it. The `<annotations>` block is the codification's editorial layer and is left
where it is; the History annotation is taken, on the same terms as California's
enacting line and the OLRC's source credit.
