# South Carolina — statutes and bills

Profile: `PROFILES.SC` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. The statute fields were derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (97.7%, 46 of 50 clean). The bill fields are the common form; South Carolina bills carry no profile of their own.

## Statutes

The Legislative Council's chapter pages (`scripts/laws/adapters/sc.mjs`): the loader writes each section as its opener and catchline, then the law, then the history.

```
SECTION 11-44-30. Definitions

For purposes of this chapter:

(1) "Angel investor" means an accredited investor as defined by …

(a) an individual person who is a resident of this State …

HISTORY: 1962 Code SECTION 65-1675; 1952 Code SECTION 65-1675; …
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "SECTION 58-27-2760." opening the first block (the opener is removed) | `section`, `num` |
| catchline | the rest of the first block | `heading` |
| subsection | (A) (B) (C) | `subsection` |
| item | (1) (2) (3) | `paragraph` |
| subitem | (a) (b) (c) | `subparagraph` |
| sub-subitem | (i) (ii) (iii) | `clause` |
| history | one block, "HISTORY: 1962 Code SECTION …" | `sourceCredit` |

A section with no subsections opens straight on items, so (1) takes the first rank there; the USLM element follows the rank the unit sits at.

`scripts/xml/coverage.mjs SC --source laws --sample 100`: 72.7% before (0 clean: the uppercase "SECTION" failed the number test on every section), **99.5%** after (95 of 100 clean). Stored at the end of the first pass: 75.4%.

## Bills

South Carolina's printings are the General Assembly's web text: "South Carolina General Assembly / 123rd Session", "[-Indicates Matter Stricken-]", "{+Indicates New Matter+}", the fiscal impact statement, "A BILL" or "A HOUSE RESOLUTION", then "Be it enacted by the General Assembly of the State of South Carolina:" and "SECTION 1." with quoted law after "is amended by adding:". A quarter of the printings are resolutions, "Whereas, …" closing "Be it resolved …".

`scripts/xml/coverage.mjs SC --source texts --sample 100`: 76.0% at the start of window 8, **97.0%** after 18c0ca1 with no profile of its own: that commit made "Be it resolved" a resolving clause. Rebuilt on the store: 49,119 printings at 97.05%.

## Known gaps

- Bills: struck and new matter are marked in the capture ("[-…-]", "{+…+}") and not yet read as `del` and `ins`; quoted law nests "(A)" under "(1)" where a subsection holds items, which reads as "paragraph opens at B".
- Statutes: a definitions section whose items restart inside a subsection reads as out of sequence, two of a hundred.
