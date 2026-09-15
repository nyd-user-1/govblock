# New Mexico — bills

Profile: `PROFILES.NM` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (98.2%, 45 of 50 clean).

## The surface

The Legislative Council Service's printed bill as text. Every line carries its number thirty-two spaces in; the legend sits beside every page.

```
                                1  SENATE BILL 129
                                2    52ND LEGISLATURE - STATE OF NEW MEXICO - SECOND SESSION, 2016
                                10  AN ACT
                                11   MAKING AN APPROPRIATION TO PROVIDE START-UP FUNDING FOR THE
                                16   BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF NEW MEXICO:
[bracketed material] = delete
                                17        SECTION 1.   APPROPRIATION.--Two hundred thousand dollars
underscored material = new
                                     .202884.1
                                2  - 2 -
```

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | 1 to 25 a page, set thirty-two spaces in (`marginIndent`) | stripped |
| legend | "[bracketed material] = delete", "underscored material = new" | dropped |
| drafting code | ".202884.1" | dropped |
| page number | "- 2 -" | dropped |
| title | "AN ACT", "RELATING TO …" | `preface` |
| enacting formula | "BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF NEW MEXICO:" | `enactingFormula` |
| bill section | "SECTION 1." then its catchline and "--" ("APPROPRIATION.--") | `section` |
| quoted law | after "is amended to read:" | `quotedContent` |
| quoted NMSA section | "\"52-1-1.1. DEFINITIONS.--" (the opening quotation mark kept off the number) | `section`, `heading` |
| subsection | A. B. C., running straight into lowercase text ("A. pertaining to osteopathic physicians:") | `subsection` |
| paragraph | (1) (2) (3) | `paragraph` |
| subparagraph | (a) (b) (c) | `subparagraph` |
| struck matter | "[Any]", "[This]" | `del` |
| memorial, resolution | "WHEREAS, …" and "NOW, THEREFORE, BE IT RESOLVED …" | `recital`, `resolvingClause` |

Capital-letter units may open on lowercase here (`lowerAfterCapital`); elsewhere "A." before a lowercase word is prose and stays so.

## Measured

`scripts/xml/coverage.mjs NM --source texts --sample 100`: 65.3% before (the margin numbers, thirty-two spaces in, hid "SECTION 1." and "WHEREAS," from every opener), **96.5%** after (81 of 100 clean; 29 memorials and resolutions). Stored at the end of the first pass: 64.8%.

## Known gaps

- Underscored new matter loses its underline in the capture, so it carries no `ins`.
- **Placeholder bills.** New Mexico introduces bills titled "AN ACT RELATING TO THE PUBLIC PEACE, HEALTH, SAFETY AND WELFARE." with the enacting formula and an empty body, a vehicle for a later substitute. They read "no enacting formula" and "no sections", truthfully: the formula sits at the end of the text and nothing follows it. Five of a hundred sampled printings.
- An amendment that inserts a lettered subsection into an existing section reads "subsection opens at B": the unit is right, the note is noise on a quoted insertion.
