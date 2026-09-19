# Titles: the level above each code

2026-09-19. The XML store addresses each jurisdiction's law by the unit its
source publishes — an Alaska chapter, an Illinois act, a New York law — and the
library (`xml_library`) listed those units flat. Most codes have a level above
that unit, and the laws pages group by it. It now lives in the library:
`title`, `title_name`, `title_order` (`sql/033_library_titles.sql`), written by
`scripts/xml/library.mjs` through `scripts/xml/lib/titles.mjs`, and read by
`/laws/<code>` and its chapters index.

## Where each jurisdiction keeps it

| Source of the title | Jurisdictions |
|---|---|
| The unit's id | AK (chapter 01.05 → Title 1), AL (from its sections; see below), ID, MT, UT, VT, ND, NH, RI, SD |
| The chapter heading, after the dash | the names for AK, MT, VT, RI, SD, IL, OH |
| The jurisdiction's own table of titles | HI, IA, MO, NV, OR, KY, MA (Parts), AL, ID, UT, ND, NH (names) |
| No level above the unit | the units are titles: AR, AZ, CO, CT, DC, DE, FL, GA, IN, LA, ME, MS, NJ, OK, PA, SC, TN, US, VA, WA, WY; whole codes: CA, MD, NY, TX; chapters with nothing above: KS, MI, MN, NC, NE, NM, WI, WV |

The tables are in `scripts/xml/sources/titles/<st>.json`, each with the page it
was read from and the date. The same tables name the units a source named only
by number: Iowa's 1,120 chapters, Idaho's 1,405, Hawaii's 624, Nebraska's 90,
Maine's 39 titles and 18 of Indiana's.

## Every jurisdiction

| | Codes | Grouped by | Groups | Still unnamed | Notes |
|---|---:|---|---:|---:|---|
| US | 53 | kind | 2 | 0 | U.S. Code titles, then the rules |
| AK | 726 | title | 45 | 0 | |
| AL | 1,491 | title | 45 | 2 | reloaded 2026-09-19 (below) |
| AR | 28 | — | | 0 | titles |
| AZ | 47 | — | | 0 | titles |
| CA | 29 | — | | 0 | codes |
| CO | 44 | — | | 0 | titles |
| CT | 71 | — | | 0 | titles |
| DC | 54 | — | | 0 | titles |
| DE | 31 | — | | 0 | titles |
| FL | 49 | — | | 0 | titles |
| GA | 53 | — | | 0 | titles |
| HI | 696 | title | 37 | 9 | chapter 138 is not in Hawaii's own title list |
| IA | 1,120 | title | 16 | 0 | every chapter named from the Iowa Code |
| ID | 1,405 | title | 71 | 1 | every chapter named from the Idaho Code |
| IL | 2,812 | ILCS chapter | 68 | 0 | acts under their ILCS chapters |
| IN | 32 | — | | 0 | titles; 18 named from the Code |
| KS | 88 | — | | 0 | chapters |
| KY | 542 | title | 44 | 0 | the Kentucky list skips XLIII–XLIX |
| LA | 53 | — | | 0 | titles |
| MA | 611 | part | 5 | 0 | the Legislature's API gives Parts, not the Titles within them; Part I holds 468 chapters |
| MD | 36 | — | | 0 | articles |
| ME | 39 | — | | 0 | titles, named from the Revisor; 25 lettered titles missing from the load (below) |
| MI | 199 | — | | 0 | chapters |
| MN | 1,016 | — | | 1 | chapters |
| MO | 450 | title | 41 | 0 | |
| MS | 51 | — | | 0 | titles |
| MT | 868 | title | 53 | 0 | |
| NC | 395 | — | | 0 | chapters |
| ND | 872 | title | 57 | 6 | |
| NE | 90 | — | | 0 | chapters, all 90 named from the Legislature |
| NH | 1,309 | title | 63 | 0 | |
| NJ | 69 | — | | 0 | titles |
| NM | 82 | — | | 0 | chapters |
| NV | 834 | title | 57 | 2 | chapter 000 has no title |
| NY | 134 | kind | 5 | 0 | consolidated and unconsolidated laws, court acts, rules, the constitution |
| OH | 975 | title | 34 | 1 | chapters 1–9 are the General Provisions ahead of Title 1 |
| OK | 82 | — | | 0 | titles |
| OR | 552 | title | 60 | 1 | |
| PA | 51 | — | | 0 | titles |
| RI | 2,468 | title | 49 | 1 | |
| SC | 63 | — | | 0 | titles |
| SD | 736 | title | 18 | 0 | only 18 of South Dakota's titles are in the load (below) |
| TN | 69 | — | | 0 | titles |
| TX | 30 | — | | 0 | codes |
| UT | 1,352 | title | 96 | 3 | |
| VA | 61 | — | | 0 | titles |
| VT | 1,565 | title | 43 | 0 | appendices are titles of their own ("Title 3 Appendix") |
| WA | 100 | — | | 0 | titles |
| WI | 469 | — | | 1 | chapters |
| WV | 139 | — | | 0 | chapters |
| WY | 42 | — | | 0 | titles |

## What is still wrong, and whose it is

- **Alabama's load merged chapters — fixed the same day.** The Agency labels a
  subtitle "Title" too ("Title 1 Health and Environmental Control Generally" is
  Subtitle 1 of Title 22), and the loader took it for Title 1, so `T1C1` held
  chapter 1 of Titles 1, 11 and 22 at once: 46 laws, 50 chapters, interleaved.
  `scripts/laws/adapters/al.mjs` now reads a subtitle by its section range; the
  198 misfiled laws were deleted and reloaded (1,491 laws, 48,531 sections),
  their 6,659 XML works rebuilt (run `al-fix-2026-09-19`). The old works'
  objects are orphans in S3 for `scripts/xml/orphans.mjs`. Four laws keep one
  stray section numbered in another title — the Agency's own data.
- **Maine's lettered titles are not loaded.** The Revisor lists 64 titles; the
  record holds 1 to 39. Missing, 25 in all: 7-A, 9-A, 9-B, 13-A, 13-B, 13-C,
  17-A (the Criminal Code), 18-A, 18-B, 18-C, 19-A, 20-A, 21-A, 22-A, 24-A,
  28-A, 28-B, 29-A, 30-A, 34-A, 34-B, 35-A, 37-A, 37-B, 39-A (Workers'
  Compensation).
- **South Dakota is partly loaded**: 736 chapters in 18 titles.
- **The pipeline files about 25 laws as the constitution** because their names
  say "constitution" (Alaska's chapter 15.50, Constitutional Amendments and
  Conventions, a chapter of Title 15). They have no code row in the library.
  The laws pages place them under the title of the laws either side of them
  (`fillTitles`, `apps/web/lib/law-citation.ts`); the classification belongs in
  `isConstitution` and wants a narrower rule.
- **Units still named only by number**: 28 across HI, ND, UT, AL, NV and six
  others, where the jurisdiction's own index has no name for them either.
