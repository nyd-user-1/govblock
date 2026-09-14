# Maryland — statutes

Profile: `PROFILES.MD` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (100.0%, 50 of 50 clean).

## The surface

The General Assembly's section pages (`scripts/laws/adapters/md.mjs`), as text: the section mark and number alone, then the law. The site serves no catchline, so a Maryland section has none.

```
§5–230.

(a) (1) In this section the following words have the meanings indicated.

(2) “Accreditation” means the determination that a program meets …

(6) “Full day” means a period of time during the day that:

(i) Meets the needs of families; and
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "§5–230." alone in the first block; the number joins its parts with an en dash, not a hyphen ("§21–2A–03.") | `section`, `num` |
| subsection | (a) (b) (c) | `subsection` |
| paragraph | (1) (2) (3) | `paragraph` |
| subparagraph | (i) (ii) (iii) | `subparagraph` |
| sub-subparagraph | 1. 2. 3. | `clause` |
| units of several ranks on one line | "(a) (1) In this section …" | each at its rank |

## Measured

`scripts/xml/coverage.mjs MD --source laws --sample 100`: 78.6% before (0 clean: the "§" and the en dash failed the number test on every section), **99.0%** after (95 of 100 clean). Stored at the end of the first pass: 78.5%.

## Known gaps

- A long run of subsections past "(h)" and "(l)" sometimes reads "(i)" or "(l)" as a numeral when the next lettered unit is too far ahead to see: "subsection m after 11", two of a hundred sections.
- No catchline, because the source serves none; the heading of a Maryland section is empty in the IR, as it is on the site.
