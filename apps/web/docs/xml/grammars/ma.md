# Massachusetts — bills

Profile: `PROFILES.MA` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (46 of 49 clean, one captured placeholder).

## Two surfaces

**Before 2013: the body alone.** The capture starts at the bill's first word, tab-indented, one block per line. No title, no enacting formula. An act of several sections numbers them "SECTION 1."; an act of one section carries no number at all, and is either a plain provision ("Notwithstanding any general or special law to the contrary, …") or an instruction with its quoted law ("Chapter 127 of the Massachusetts General Laws is hereby amended by inserting, after section 119, the following section:" then "197A." alone on its line).

**From 2017: the printed bill.** A petition cover sheet ("SENATE DOCKET, NO. 881 FILED ON: …", "PRESENTED BY:", "PETITION OF:"), then the bill: "The Commonwealth of Massachusetts", the General Court, "An Act relative to …", the enacting formula, and the body with its lines numbered straight through the bill, into the thousands for a bond bill, pages marked "7 of 92".

| Unit | Signalled by | USLM |
|---|---|---|
| margin number | `^\s{0,3}\d{1,4}` on a line | stripped |
| page mark | "1 of 2", "7 of 92" alone on a line | dropped |
| enacting formula | "Be it enacted by the Senate and House of Representatives in General Court assembled, and by the authority of the same, as follows:" | `enactingFormula` |
| emergency preamble | "Whereas, The deferred operation of this act would tend to defeat its purpose, …" | `preface` |
| bill section | "SECTION 1." | `section` |
| an act of one section | no "SECTION" opener anywhere in the body; its first block is the instruction | `section` with no `num` |
| quoted law | after "the following section:-", "the following paragraph:-", "the following words:-" (the Legislature's colon and dash) | `quotedContent` |
| quoted section | "Section 51L." or a bare "197A." alone on its line | `section` |
| subsection | (a) (b) (c) | first rank |
| paragraph | (1) (2) (3) | next rank |
| subparagraph | (i) (ii) (iii) | next rank |

## Measured

`scripts/xml/coverage.mjs MA --source texts --sample 100`: 71.4% before (54 clean), **98.5%** after (90 of 99 clean, one placeholder held out). Stored at the end of the first pass: 72.9%.

## Known gaps

- **Placeholders.** Some 2011 printings hold "To view the text of House, No. 4215, please copy and paste the following URL …" instead of the bill: one in fifty in each sample. They report as `error-page` and fall out asking for a re-fetch from the PDF the placeholder names. An acquisition problem.
- An amendment that inserts a lettered subsection into an existing section ("by inserting after subsection (c), the following subsection:- (d) …") reads "(d)" as the first of its rank: "subsection opens at d". The unit is right; the note is noise on a quoted insertion.
- Struck and inserted text is typography in the PDF and does not survive into the capture.
