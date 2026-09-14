# Oklahoma — bills

Profile: `PROFILES.OK` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from two samples of fifty printings drawn through `"Bills"` across every session, 2010–2026; the second sample was held back from the derivation and parsed clean on first run.

## The surface

Every printing is the Legislature's typeset PDF as text: a line number down the left margin of every line, blank lines included, 1 to 24 per page, digits spaced apart in older sessions ("1 0", "2 4"); a page footer; a blank line after every line.

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | `^\s{0,3}\d( ?\d)?` on every line | stripped |
| page footer | "Req. No. 11796 Page 1", "ENGR. H. B. NO. 2394 Page 1", "HB1025 HFLR Page 1" | dropped |
| drafting code | "60-1-11796 GRS 01/13/25" | dropped |
| floor-version legend | "UNDERLINED language denotes Amendments…", "BOLD FACE CAPITALIZED…", "Strike thru…", "HOUSE OF REPRESENTATIVES - FLOOR VERSION" | dropped |
| enacting formula | "BE IT ENACTED BY THE PEOPLE OF THE STATE OF OKLAHOMA:" | `enactingFormula` |
| bill section | "SECTION 1." then AMENDATORY, NEW LAW, REPEALER or plain text | `section` |
| quoted law | after "is amended to read as follows:" or "reads as follows:" | `quotedContent` |
| quoted statute section | "Section 461." or "Section 11-1401.2" (no full stop) | `section` |
| subsection | A. B. C. | first rank below the section |
| paragraph | 1. 2. 3. | next rank |
| subparagraph | a. b. c. | next rank |
| division | (1) (2) (3) | next rank |

"B. 1. Notwithstanding …" opens a subsection and its first paragraph on one line; "Section 461. A. If …" opens a quoted section and its first subsection on one line. Lettered and numbered items ("a.", "12.") at a line's head open a block even when the line before did not end a sentence, since every line carries the same indent once the margin is gone.

## Measured

`scripts/xml/coverage.mjs OK --source texts --sample 100`: 74.2% before, **100.0%** after (97 printings, 97 clean). Stored at the end of the first pass: 79.2%.

## Known gaps

- **Captured navigation page.** A share of printings hold the Legislature site's menu ("Home / Legislature Home / Senate Home …", 3,046 characters) instead of the bill: three in each sample of fifty to a hundred. They report as `error-page` and fall out of the pipeline asking for a re-fetch. 2,546 of the 146,968 stored printings sit at 0% coverage, which is the likely count; an acquisition problem, not a grammar one.
- Struck and underlined text are typography in the PDF and do not survive into the text capture, so an amending section's quoted law carries no `ins` or `del`.
