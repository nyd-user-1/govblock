# Where the standing law of each jurisdiction comes from

Fifty-two jurisdictions publish their own statutes. This is the working record
of where each one puts them, what shape they are in, and whether a commercial
vendor sits between the legislature and the reader.

It is written as the work goes and is not finished. A row with no adapter is a
row nobody has built yet, not a jurisdiction whose law cannot be had.

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
| US | U.S. Congress | Office of the Law Revision Counsel, `uscode.house.gov` | USLM XML, bulk, one file per title, at a release point | no | **loaded** |
| CA | California | Legislative Counsel, `downloads.leginfo.legislature.ca.gov` | tab-delimited tables in `pubinfo_<year>.zip`, section text as CAML XML | no | **loaded** |
| NY | New York | NY Senate, `legislation.nysenate.gov` | JSON API, whole law in one call, free key | no | **loaded** |
| DC | District of Columbia | DC Council / Open Law Library, `code.dccouncil.gov` | XML, published openly | no (Open Law Library is the Council's own publisher) | sized |
| MA | Massachusetts | `malegislature.gov/api` | JSON API | no | sized |
| TX | Texas | Legislative Council, `statutes.capitol.texas.gov` | bulk download page, HTML/Word per code | no | sized |
| FL | Florida | `flsenate.gov/Laws/Statutes` | HTML and XML per title | no | sized |
| WA | Washington | Code Reviser, `app.leg.wa.gov/RCW` | HTML per title/chapter, bulk available | no | sized |
| VA | Virginia | Division of Legislative Automated Systems, `law.lis.virginia.gov` | HTML per title/chapter | no | sized |
| OH | Ohio | `codes.ohio.gov` (LAWriter, state-run) | HTML per section | no | sized |
| AZ | Arizona | `azleg.gov/arstitle` | HTML per title/section | no | sized |
| DE | Delaware | `delcode.delaware.gov` | HTML per title/chapter | no | sized |
| CT | Connecticut | General Assembly, `cga.ct.gov/current/pub` | HTML and PDF per title | no | sized |
| AK | Alaska | `akleg.gov/basis/statutes.asp` | HTML per title | no | sized |
| CO | Colorado | General Assembly, `leg.colorado.gov` | PDF per title, published free | LexisNexis prints it; the state posts the PDFs | sized |
| AL | Alabama | `alison.legislature.state.al.us/code-of-alabama` | HTML behind a state-run viewer | no | sized |
| GA | Georgia | `legis.ga.gov/legislation/ocga` | viewer over LexisNexis | yes — take the statute, leave the OCGA annotations | sized |
| AR | Arkansas | General Assembly, via LexisNexis | vendor viewer | yes | sized |
| HI | Hawaii | `capitol.hawaii.gov` | HTML/PDF per chapter; refuses an unknown agent (403) | no | sized |
| IL | Illinois | `ilga.gov` | HTML; the site was rebuilt and the old ILCS paths are gone | no | open |
| MI | Michigan | `legislature.mi.gov` | HTML; the MCL paths moved | no | open |
| — | the remaining 31 states, plus the territories the record covers | | | | open |

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
