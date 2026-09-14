# Vermont — bills

Profile: `PROFILES.VT` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (98.4%, 30 of 38 clean).

## The surface

The Office of Legislative Counsel's printed bill as text, and the chambers' resolutions.

```
     BILL AS INTRODUCED  H.429
     2023  Page 1 of 10
 1  H.429
 4   Subject: Elections; miscellaneous changes
13      An act relating to miscellaneous changes to election laws
14   It is hereby enacted by the General Assembly of the State of Vermont:
15  * * * Sore Loser Law * * *
16   Sec. 1. 17 V.S.A. § 2381(c) is added to read:
17      (c) In no event shall a candidate who loses a major party primary be
                                                         VT LEG #366703 v.4
```

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | 1 to 21 a page | stripped |
| running head | "BILL AS INTRODUCED H.429", "2023 Page 1 of 10" | dropped |
| foot | "VT LEG #366703 v.4" | dropped |
| sponsors, subject, statement of purpose | before the enacting formula | `preface` |
| enacting formula | "It is hereby enacted by the General Assembly of the State of Vermont:" | `enactingFormula` |
| group heading | "* * * Sore Loser Law * * *" over the sections it covers | `p role="ellipsis"` |
| bill section | "Sec. 1." | `section` |
| quoted law | after "is added to read:", "is amended to read:" | `quotedContent` |
| quoted V.S.A. section | "§ 2401. APPLICABILITY OF SUBCHAPTER" | `section`, `heading` |
| subsection | (a) (b) (c) | `subsection` |
| subdivision | (1) (2) (3) | `paragraph` |
| subdivision below | (A) (B) (C), (i) (ii) (iii) | the ranks below |
| resolution | "Resolved by the Senate and House of Representatives:" after the caption ("J.R.S. 45. Joint resolution relating to …") | `resolvingClause` |

## Measured

`scripts/xml/coverage.mjs VT --source texts --sample 100`: 81.1% at the start of window 8, **97.4%** after (76 of 100 clean; 30 resolutions). Stored at the end of the first pass: 74.9%.

## Known gaps

- **Short-form bills** carry "(TEXT OMITTED IN SHORT-FORM BILLS)" after the enacting formula and no sections, truthfully.
- The group heading "* * * Sore Loser Law * * *" is kept as a paragraph, not yet a level over its sections.
- An amendment that adds a subsection to an existing section ("§ 2381(c) is added to read:" then "(c) …") reads "subsection opens at c"; the unit is right.
- A city charter quoted whole ("CHAPTER 3. CITY OF BURLINGTON") reads its chapter heading as an unmatched enumerator.
