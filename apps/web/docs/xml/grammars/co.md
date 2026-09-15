# Colorado — bills

Profile: `PROFILES.CO` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (16 of 18 real printings clean, 99.8%; 32 archive banners).

## The surface

**A third of the stored printings are not bills.** 20,194 of the 57,350 printings stored at the end of the first pass are the same 201 characters, the archive site's banner: "Accessibility Archive / Archived Content / This is archived reference material. The site is no longer updated …". They report as `error-page`, fall out of the pipeline asking for a re-fetch, and stay out of the measured mean. An acquisition problem: the printings of the sessions the archive holds need fetching again from the General Assembly's PDFs.

The rest are the General Assembly's printed bill as text:

```
LLS NO. 19-0699.04 Jacob Baus x2173  HOUSE BILL 19-1312
                         A BILL FOR AN ACT
101        CONCERNING MODERNIZING IMMUNIZATION REQUIREMENTS FOR
102  SCHOOL ENTRY TO IMPROVE VACCINATION RATES.
                         Bill Summary …
 1   Be it enacted by the General Assembly of the State of Colorado:
10  SECTION 2. In Colorado Revised Statutes, 25-4-902, amend (1);
11   and add (6) as follows:
12  25-4-902.      Immunization prior to attending school -
13   standardized immunization information. (1) Except as provided in
                                         -4-  HB19-1312
```

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | 1 to 27 a page; the title's lines from 101 | stripped |
| page number | "-4- HB19-1312", "-2- 164" | dropped |
| reading stamps | down the right edge, forty spaces in: "2nd Reading Unamended", "April 22, 2019", "SENATE" | dropped |
| amendment legend | "Shading denotes HOUSE amendment. …", "Capital letters or bold & italic numbers …", "Dashes through the words …" | dropped |
| title | "A BILL FOR AN ACT" and "CONCERNING …" | `preface` |
| bill summary | "Bill Summary", the Legislative Council's note and the summary | `preface` |
| enacting formula | "Be it enacted by the General Assembly of the State of Colorado:" | `enactingFormula` |
| resolving clause | "Be It Resolved by the Senate of the Seventy-fourth General Assembly …" | `resolvingClause` |
| bill section | "SECTION 1." | `section` |
| quoted law | after "In Colorado Revised Statutes, 25-4-902, amend (1); and add (6) as follows:" | `quotedContent` |
| quoted C.R.S. section | "25-4-902." then its catchline, however long, running straight into "(1)" | `section`, `heading` |
| subsection | (1) (2) (3), inserted "(1.5)" | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | (I) (II) (III), inserted "(II.5)" | `subparagraph` |
| sub-subparagraph | (A) (B) (C) | `clause` |
| new matter | CAPITALS | `ins` |

Every unit opens its own line, so an enumerator at a line's head opens a block whatever the line before ended with, unless it reads as the tail of an instruction's list ("(1.5) (b), and (1.7); repeal (1.1) (e) as follows:").

## Measured

`scripts/xml/coverage.mjs CO --source texts --sample 100`: 71.0% before, with the archive banners counted as bills; **98.9%** after, over the 70 real printings (46 clean; 30 banners held out). Stored at the end of the first pass: 73.0%, over 57,350 printings of which 20,194 were banners.

## Known gaps

- Struck matter is dashes through the words in the PDF; the capture keeps the words and loses the dashes, so struck text reads as current law next to its `ins` replacement.
- An amending section that inserts into an existing list reads "subsection opens at 6": the unit is right, the note is noise on a quoted insertion.
