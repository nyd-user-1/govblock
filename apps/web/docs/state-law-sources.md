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
| US | U.S. Congress | Office of the Law Revision Counsel, `uscode.house.gov` | USLM XML, bulk, one file per title, at a release point | no | **loaded** — 57 titles, 61,009 sections |
| CA | California | Legislative Counsel, `downloads.leginfo.legislature.ca.gov` | tab-delimited tables in `pubinfo_<year>.zip`, section text as CAML XML | no | **loaded** — 30 codes, 161,428 sections |
| NY | New York | NY Senate, `legislation.nysenate.gov` | JSON API, whole law in one call, free key | no | **loaded** — 137 laws, 40,551 sections |
| DC | District of Columbia | DC Council, `code.dccouncil.gov` | XML on GitHub, one index per title and one file per section | no | **loaded** — 54 titles, 23,492 sections |
| MA | Massachusetts | `malegislature.gov/api` | JSON API, no key, one request per section | no | **loaded** — 611 laws, 26,326 sections |
| TX | Texas | Legislative Council, `tcss.legis.texas.gov` | one API call per code for its whole tree, then one HTML file per chapter | no | **loaded** — 30 codes, 145,592 sections |
| FL | Florida | `flsenate.gov/Laws/Statutes` | HTML per chapter, `/ChapterN/All` for the whole of one | no | **loaded** — 49 laws, 24,866 sections. Counts requests per IP (`X-Throttle-Reason: crawler-penalty-active`, `Retry-After: 300`) and the penalty stuck to the AWS address, so it was run from another at two lanes and 1.2 s apart |
| WA | Washington | Code Reviser, `app.leg.wa.gov/RCW` | the same page at three depths; one request per section | no | **loaded** — 100 laws, 51,380 sections. The bulk file was never needed |
| VA | Virginia | Division of Legislative Automated Systems, `law.lis.virginia.gov` | one page per section; the full-chapter view renders on the client | no | **loaded** — 61 laws, 33,355 sections. The API registration has not come back, and nothing waited on it |
| OH | Ohio | Legislative Service Commission, `codes.ohio.gov` | the chapter page carries every section in full | no | **loaded** — 976 laws, 33,830 sections |
| AZ | Arizona | Legislative Council, `azleg.gov` | one small HTML file per section | no | **loaded** — 47 laws, 24,960 sections. Sucuri answers a bare 307 once a count is passed and holds the AWS address there, so it runs from another |
| DE | Delaware | Code Revisors, `delcode.delaware.gov` | one HTML page per chapter | no | **loaded** — 31 laws, 10,081 sections. 403s AWS at width; four lanes and a quarter-second apart passes |
| CT | Connecticut | General Assembly, `cga.ct.gov/current/pub` | one HTML page per chapter, the whole chapter on it | no | **loaded** — 71 laws, 29,671 sections. Serves an incomplete certificate chain; the intermediate its own certificate names is fetched and added |
| AK | Alaska | Legislative Affairs Agency, `akleg.gov/basis` | the site's own TOC and print endpoints; the print view is a window that is paged | no | **building** — 12,846 sections so far |
| CO | Colorado | Office of Legislative Legal Services, `olls.info/crs` | the whole Code as one 37 MB HTML archive, a file per title | no | **loaded** — 44 titles, 35,101 sections. The PDFs the ledger recorded are beside it; the HTML is better |
| AL | Alabama | Legislative Services Agency, `gql.api.alison.legislature.state.al.us` | GraphQL: one call returns the whole hierarchy, one call per section returns its content | no | **building** — 25,803 sections so far. The viewer is a Next.js client; introspection is off, so the queries are the ones its own bundle sends |
| GA | Georgia | `legis.ga.gov/legislation/ocga` | the page is an application shell of 1.5 KB that names no code; the OCGA itself is served by LexisNexis's viewer | yes — take the statute, leave the OCGA annotations | **blocked** — no open address for the text has been found. Next: the viewer's own API from its network calls, and the General Assembly's bulk request |
| HI | Hawaii | Legislative Reference Bureau, `capitol.hawaii.gov/hrscurrent` | a directory listing: one file per section | no | **loaded** — 696 chapters, 10,120 sections. Refuses the AWS address with a 403, so it runs from another |
| IL | Illinois | General Assembly, `ilga.gov` | an act's full-text view is the whole act in one request | no | **loaded** — 2,816 acts, 72,652 sections. The rebuilt site's paths are `/Legislation/ILCS/Chapters` → `Acts?ChapterID=` → `details?…ChapAct=FullText` |
| MI | Michigan | Legislative Service Bureau, `legislature.mi.gov` | `/Home/RenderDoc?objectName=mcl-chapN` renders a whole chapter | no | **loaded** — 199 laws, 41,752 sections. The old MCL paths answer 400; the render endpoint is the one the site itself uses |
| NC | North Carolina | General Assembly, `ncleg.gov` | one HTML file per chapter, the whole chapter in it | no | **loaded** — 396 laws, 41,481 sections |
| PA | Pennsylvania | Legislative Reference Bureau, `legis.state.pa.us` | one HTML file per title, every unit marked by a `<div class="Comment">` | no | **loaded** — 51 laws, 14,045 sections. Black-holes the AWS range, so it is fetched from elsewhere; the unconsolidated statutes are a second pass |
| SC | South Carolina | Legislative Council, `scstatehouse.gov/code` | one HTML page per chapter, unannotated | no | **loaded** — 63 laws, 30,991 sections |
| OR | Oregon | Legislative Counsel, `oregonlegislature.gov/bills_laws/ors` | one HTML file per chapter, ISO-8859-1 | no | **loaded** — 552 laws, 61,141 sections |
| NV | Nevada | Legislative Counsel Bureau, `leg.state.nv.us/NRS` | one HTML file per chapter, windows-1252 | no | **loaded** — 834 laws, 43,768 sections |
| VT | Vermont | Office of Legislative Counsel, `legislature.vermont.gov` | one page per section | no | **loaded** — 1,321 laws, 19,019 sections |
| MN | Minnesota | Office of the Revisor, `revisor.mn.gov` | one page per section; no machine-readable chapter list, so chapters are enumerated | no | **loaded** — 1,016 laws, 51,103 sections |
| MO | Missouri | Revisor of Statutes, `revisor.mo.gov` | one page per section | no | **loaded** — 452 laws, 29,275 sections |
| MD | Maryland | General Assembly, `mgaleg.maryland.gov` | `/api/Laws/GetSections` lists an article's sections; one page each | LexisNexis prints the annotated edition; the site serves the statute alone | **loaded** — 36 articles, 40,053 sections |
| WI | Wisconsin | Legislative Reference Bureau, `docs.legis.wisconsin.gov` | one page per section; the chapter's contents scroll sixty entries at a time | no | **loaded** — 470 laws, 16,344 sections |
| WV | West Virginia | Legislature, `code.wvlegislature.gov` | chapter, article and section pages | no | **building** — 45 laws, 11,294 sections |
| ID | Idaho | Legislative Services Office, `legislature.idaho.gov` | titles, chapters and sections; the statute carries no class of its own and is cut out of the page's prose | no | **building** — 121 laws, 1,316 sections |
| KY | Kentucky | Legislative Research Commission, `apps.legislature.ky.gov` | one PDF per section | no | **loaded** — 542 laws, 35,577 sections |
| ND | North Dakota | Legislative Council, `ndlegis.gov/cencode` | one PDF per chapter; the chapters are enumerated | no | **loaded** — 872 laws, 17,949 sections |
| IA | Iowa | Legislative Services Agency, `legis.iowa.gov/docs/code` | one PDF per chapter; the chapters are enumerated | no | **loaded** — 1,120 laws, 26,680 sections |
| WY | Wyoming | Legislative Service Office, `wyoleg.gov/statutes/compress` | one PDF per title | no | **loaded** — 42 laws, 20,989 sections |
| ME | Maine | Revisor of Statutes, `legislature.maine.gov/legis/statutes` | a file tree: title, chapter and section pages | no | **loaded** — 39 laws, 32,753 sections |
| RI | Rhode Island | General Assembly, `webserver.rilegislature.gov/Statutes` | a file tree: title, chapter and section pages | no | **loaded** — 2,468 laws, 32,458 sections |
| MT | Montana | Legislative Services Division, `archive.legmt.gov/bills/mca` | index pages four deep, one file per section | annotations are licensed for the printed edition; the site serves the statute | **loaded** — 869 laws, 44,150 sections |
| OK | Oklahoma | Legislature, `oklegislature.gov/OK_Statutes` | one PDF per complete title | no | **loaded** — 82 laws, 35,658 sections |
| UT | Utah | `le.utah.gov/xcode` | the pages render on the client and name no chapter; only `Title1/1.html` answers, and every chapter and section path tried returns 404 | no | **blocked** — the data endpoint has not been found; the bundle names only `searchCode.jsp`. Next: the Office of Legislative Research and General Counsel's bulk publication, and the search endpoint as an index |
| SD | South Dakota | `sdlegislature.gov` | `/api/Statutes/Title` returns all 71 titles as JSON; every other path under `/api/Statutes` falls through to the application shell | no | **blocked** — the children endpoint has not been found. Next: the statute route's own lazily-loaded chunk, and the Codified Laws PDFs |
| NE | Nebraska | Revisor of Statutes, `nebraskalegislature.gov` | `display-chapters.php` is a whole chapter with its text | no | **loaded** — 90 chapters, 55,676 sections |
| NH | New Hampshire | General Court, `gencourt.state.nh.us/rsa/html` | a file tree; each chapter has a merged file that is the whole of it | no | **building** — 1,787 chapters; the host hangs up under width, so it runs at three lanes and a failure is a gap rather than a stop |
| LA | Louisiana | `legis.la.gov` | the table of contents navigates by ASP.NET postbacks, so no address addresses a title or a chapter; `Law.aspx?d=<id>` does address a section | no | **blocked** — the tree cannot be walked by address. Next: enumerate the document ids, which are dense, and rebuild the tree from each section's own citation |
| NJ | New Jersey | `lis.njleg.state.nj.us` | the statutes sit behind a Folio `nxt/gateway.dll` viewer, which refuses a plain GET | no | **blocked**. Next: the viewer's own query strings, and the OLS bulk request |
| KS | Kansas | `ksrevisor.gov` / `kslegislature.gov` | the Revisor's chapter paths answer 404 and the Legislature's statute index carries no link | no | **blocked** — the current address has not been found. Next: the Revisor's own index page and the Legislature's search endpoint |
| MS | Mississippi | `billstatus.ls.state.ms.us` | answers 403; the Code is published through a vendor viewer | yes | **blocked**. Next: the Secretary of State's publication and the Legislature's own bulk request |
| NM | New Mexico | `nmonesource.com` | the Compilation Commission's viewer; the paths tried answer 404 | yes — the Commission publishes under contract | **blocked**. Next: the viewer's own API, and the Commission's bulk terms |
| IN | Indiana | `iga.in.gov` | a React application with no statute in its HTML; the MyIGA key was requested and has not come back | no | **blocked** — no open address for the text has been found. Next: the application's own data calls, and the key |
| AR | Arkansas | `arkleg.state.ar.us` | the code path answers with 42 bytes; the Code is published through LexisNexis | yes | **blocked**. Next: the Bureau of Legislative Research's own files |
| TN | Tennessee | `lexisnexis.com/hottopics/tncode` | a vendor viewer, 3.7 KB of shell | yes — take the statute, leave the annotations | **blocked**. Next: the viewer's API, and the Secretary of State's publication |

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
