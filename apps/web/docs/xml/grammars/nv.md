# Nevada — statutes

Profile: `PROFILES.NV` in `apps/web/lib/xml/frontends/profiles.ts`, on the generic statute parser. Derived 2026-09-14 (window 8) from fifty sections drawn through `"Laws"`, checked on a second fifty held back from the derivation (92.9%, 34 of 50 clean).

## The surface

The Legislative Counsel Bureau's chapter files (`scripts/laws/adapters/nv.mjs`): the loader writes each section as its citation and catchline, then one block per paragraph of the file, the source note last.

```
NRS 33.090 Order from another jurisdiction: Registration in this State; …

1. A person may register an order for protection …

2. The clerk of the court shall:

(a) Maintain a record of each order registered pursuant to this section;

Ê and it is impossible or impracticable to furnish such pupil …

(Added to NRS by 1985, 2286; A 1997, 1810; 1999, 2063)
```

| Unit | Signalled by | USLM |
|---|---|---|
| section | "NRS 33.090" opening the first block (the citation prefix is removed) | `section`, `num` |
| catchline | the rest of the first block, whatever its length or verbs | `heading` |
| effective-date note | "[Effective on the date on which the Director …]" before the law | `content` |
| subsection | 1. 2. 3. | `subsection` |
| paragraph | (a) (b) (c) | `paragraph` |
| subparagraph | (1) (2) (3) | `subparagraph` |
| sub-subparagraph | (I) (II) (III) | `clause` |
| flush language | "Ê" opening the text after a list | `continuation` of the last unit |
| source note | "(Added to NRS by 1985, 2286; A 1997, 1810)", "(NRS A 1971, 827)", "[Part 12:190:1941; A 1955, 129]—(NRS A 1969, 541 …)", "(Substituted in revision for …)" | `sourceCredit` |

## Measured

`scripts/xml/coverage.mjs NV --source laws --sample 100`: 73.4% before (0 clean: every section read "no number at the start" on the "NRS" prefix), **94.8%** after (73 of 100 clean). Stored at the end of the first pass: 74.6%.

## Why not higher: the loader drops paragraphs (acquisition)

Most of what still falls out is text that was never stored. The Nevada adapter separates the chapter's table of contents from its law by skipping any paragraph whose markup holds an in-page `#` link, and a paragraph of law that cross-references another section by anchor carries one. Those paragraphs are dropped. NRS 704.6623 is stored from "(a) Serves 3,300 persons or more …" with no "1. A public utility that:" above it; NRS 483.270 has "(a)", "(c)", "(e)" and no "(b)" or "(d)". The parser's "subsection a after 1" and "paragraph opens at 2" are reporting those gaps truthfully. The fix is in `scripts/laws/adapters/nv.mjs` (tell contents from law by position, the first anchored section onward, not paragraph by paragraph) and a reload of `"Laws"` for Nevada, then a rebuild. Named for window 7.

## Known gaps

- "Ê" (the Bureau's flush-language mark, windows-1252) stays in the text of the continuation.
