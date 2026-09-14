# Kentucky — bills

Profile: `PROFILES.KY` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic front end. Derived 2026-09-14 (window 8) from fifty printings drawn through `"Bills"` across every session, checked on a second fifty held back from the derivation (99.5%, 45 of 50 clean).

## The surface

The Legislative Research Commission's printed bill as text.

```
     UNOFFICIAL COPY  21 RS BR 104
 1  AN ACT relating to elections and making an appropriation therefor.
 2  Be it enacted by the General Assembly of the Commonwealth of Kentucky:
 3  SECTION 1.        A NEW SECTION OF KRS CHAPTER 120 IS CREATED TO
 4   READ AS FOLLOWS:
 5   (1)    In any regular election or special election for any member of the General
  Page 1 of 20
     XXXX  Jacketed
```

| Unit | Signalled by | USLM |
|---|---|---|
| symbol-font mark | U+F0E2, a private-use glyph, in front of every section opener; invisible, it defeated "Section 1." on every printing | removed |
| margin number | 1 to 27 a page | stripped |
| running head | "UNOFFICIAL COPY 21 RS BR 104", "UNOFFICIAL COPY 17 RS SB 94/GA" | dropped |
| foot | "Page 1 of 20", "XXXX Jacketed", a drafting code "SB009410.100 - 852 - XXXX GA" | dropped |
| title | "AN ACT relating to …" | `longTitle` |
| enacting formula | "Be it enacted by the General Assembly of the Commonwealth of Kentucky:" | `enactingFormula` |
| bill section | "Section 1." or "SECTION 1." (in older captures a stray "®" before it) | `section` |
| quoted law | after "IS CREATED TO READ AS FOLLOWS:", "is amended to read as follows:" | `quotedContent` |
| subsection | (1) (2) (3) | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | 1. 2. 3. | `subparagraph` |
| clause | a. b. c. | `clause` |
| resolution | "WHEREAS, …" and "NOW, THEREFORE, Be it resolved …" | `recital`, `resolvingClause` |

## Measured

`scripts/xml/coverage.mjs KY --source texts --sample 100`: 76.0% at the start of window 8, 95.9% on the shared fixes before a profile of its own, **99.9%** after (99 of 100 clean; 29 resolutions). Stored at the end of the first pass: 77.4%.

## Known gaps

- Kentucky sets struck matter through and new matter underlined in the PDF; the capture keeps neither, so an amending section's quoted law carries no `del` or `ins`.
- A list of repealed sections ("217.950 License for manufacture of laetrile -- Regulations …") stays as paragraphs under the repealing section; each entry is a citation a later pass could make a `ref`.
