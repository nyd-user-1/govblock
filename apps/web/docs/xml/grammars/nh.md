# New Hampshire — bills

Profile: `PROFILES.NH` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (99.4%, 44 of 50 clean).

## The surface

The General Court's web text: a docket, the analysis, the legend, then the bill. Each paragraph is one line; nothing wraps.

```
HB 249 - AS AMENDED BY THE HOUSE
AN ACT	relative to animal shelter facilities.
ANALYSIS
	I.  Allows animal shelters to own or lease their facilities.
Explanation:	Matter added to current law appears in bold italics.
		Matter removed from current law appears [in brackets and struckthrough.]
STATE OF NEW HAMPSHIRE
Be it Enacted by the Senate and House of Representatives in General Court convened:
	1  Definitions; Animal Shelter Facility.  Amend RSA 437:1, I to read as follows:
		I.  "Animal shelter facility" means a facility, including the building …
	2  Effective Date.  This act shall take effect 60 days after its passage.
```

| Unit | Signalled by | USLM |
|---|---|---|
| docket, analysis, legend | before the enacting formula | `preface` |
| enacting formula | "Be it Enacted by the Senate and House of Representatives in General Court convened:" | `enactingFormula` |
| bill section | a bare number and its catchline, "1 Definitions; Animal Shelter Facility.", strictly 1, 2, 3 | `section` |
| chaptered section | "55:1 New Section; …" in the final version under "CHAPTER 55": the chapter's own prefix is taken off before reading, so it numbers 1, 2 | `section` |
| quoted law | after "to read as follows:", "the following new section:" | `quotedContent` |
| quoted RSA section | "654:1", "21-I:5", "204-C:8-b", then its catchline | `section`, `heading` |
| paragraph | I. II. III. (roman, with a full stop) | first rank below the section |
| subparagraph | (a) (b) (c) | next rank |
| item | (1) (2) (3) | next rank |
| struck matter | "[inhabitant]", "[for voting purposes]" | `del` |

Roman numerals with a full stop are their own rank here (`romanDot`), not the letters I, V, X and L, and every unit at a line's head opens a block (`openersAtLineHead`), since the web text never wraps a paragraph.

## Measured

`scripts/xml/coverage.mjs NH --source texts --sample 100`: 77.1% before (48 of 50 sampled read "no sections": a section is a bare number, which no opener took), **100.0%** after (100 of 100 clean). Stored at the end of the first pass: 73.5%.

## Known gaps

- Inserted matter is bold italic in the source and plain in the capture, so new text carries no `ins`.
- An amendment that replaces one roman paragraph of an RSA section ("Amend RSA 654:7, III to read as follows:" then "III. …") reads "subsection III after 1": the unit is right, the note is noise on a quoted replacement.
- Forms quoted inside a section (a voter registration form's numbered blanks) read as paragraphs.
