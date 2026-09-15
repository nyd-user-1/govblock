# Indiana — statutes

Profile: `PROFILES.IN` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (50 of 50 clean).

## The surface

The Indiana Code as the General Assembly exports it per title (`scripts/laws/adapters/in.mjs`): the loader writes each section as its citation and heading, a blank line, and the words.

```
IC 23-2.5-11-3 Investigation; orders; penalties

Sec. 3. (a) If the commissioner determines …

(1) with a prior hearing if …

As added by P.L.175-2019, SEC.2. Amended by P.L.89-2024, SEC.30.
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "IC 23-2.5-11-3" opening the first block (the citation prefix is removed) | `section`, `num` |
| heading | the rest of the first block, whatever its length or verbs ("Repealed", "Commission may adopt rules") | `heading` |
| version note | "Note: This version of section effective until 7-1-2027." | `content` |
| restated number | "Sec. 3." where the body opens, removed | — |
| subsection | (a) (b) (c) | `subsection` |
| subdivision | (1) (2) (3) | `paragraph` |
| clause | (A) (B) (C) | `subparagraph` |
| item | (i) (ii) (iii) | `clause` |
| recodification citation | "[Pre-1995 Recodification Citation: 14-3-3.5-1(a).]", "[2006 Recodification Citation: New.]" | `note` |
| history | "As added by …", "Amended by …", "Repealed by …" closing the section | `sourceCredit` |

Indiana's own words for its ranks are subsection, subdivision, clause and item; the USLM element is taken by rank.

## Measured

`scripts/xml/coverage.mjs IN --source laws --sample 100`: 69.8% before (0 clean: every section failed "no number at the start" on the "IC" prefix), **99.6%** after (96 of 100 clean). Stored at the end of the first pass: 72.2%.

## Known gaps

- A long run of subsections reaching (j) or (m) after a roman-looking letter ("(i)", "(l)") is read as a roman numeral once in a while ("subsection j after 8"); four of a hundred sections.
- Flush text after the last subdivision of a subsection hangs on the subdivision as `continuation`, not on the subsection; the text does not say which it belongs to.
