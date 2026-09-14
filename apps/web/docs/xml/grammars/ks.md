# Kansas — statutes

Profile: `PROFILES.KS` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (99.7%, 47 of 50 clean).

## The surface

The Revisor of Statutes' section files (`scripts/laws/adapters/ks.mjs`), as text: the number alone, the catchline, the law, and the history.

```
21-5604.

Incest; aggravated incest.

(a) Incest is marriage to …

History:

L. 2010, ch. 136, § 81; L. 2012, ch. 150, § 6; July 1.
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "21-5604." alone in the first block; a comma where the article runs past 99 ("68-5,101.") | `section`, `num` |
| catchline | the next block ("Same; meetings; quorum." carries the article's subject forward) | `heading` |
| repealed section | no catchline: "History:" follows the number directly | `section` with no `heading` |
| subsection | (a) (b) (c) | `subsection` |
| paragraph | (1) (2) (3) | `paragraph` |
| subparagraph | (A) (B) (C) | `subparagraph` |
| clause | (i) (ii) (iii) | `clause` |
| history | "History:" and the session laws after it | `sourceCredit` |

## Measured

`scripts/xml/coverage.mjs KS --source laws --sample 100`: 55.6% before (0 clean: the number alone failed the number test, and the "L. 2010, ch. 136" history read as an enumerator "L."), **98.8%** after (92 of 100 clean). Stored at the end of the first pass: 56.4%.

## Known gaps

- A history printed without its "History:" heading still reads "L." as an enumerator: six of a hundred sections.
- Interstate compacts set out inside one section ("ARTICLE I / PURPOSE / (a) …") restart their lettering per article, which reads as out of sequence; the articles are not yet levels.
