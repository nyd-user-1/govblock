# Window 6: citations and context — report

Report to the lead. Newest milestone first. Run by window 5's session after
its brief was accepted (`lib/xml/todo.ts`, claimed by window-5).

## Milestone 1 — citations found and addressed, tested (2026-09-14)

### Built

`apps/web/lib/typeset/cite.ts`, pure, beside the engine:

- **`addressOfHref(href)`**: a `ref` mark's href as an address, with the
  stored Work separated from the portion. `/us/usc/t12/s1709/r/4` is Work
  `/us/usc/t12/s1709`. GPO's relative forms are read too: `usc/12/1701x`,
  `usc-chapter/38/15` (a container, `/us/usc/t38/ch15`, not a Work),
  `pl/114/113`. So are state addresses, including a section under a
  numbering container (`/us-ma/code/gl/ch93A/s2`) and a constitution's
  `artI/s11`.
- **`recognize(text, context)`**, the words no mark covers:
  - federal everywhere: "12 U.S.C. 1709(r)(4)" with its portion, "section
    1105(a) of title 31, United States Code", "Public Law 114–113", "129
    Stat. 2242"
  - New York where the citing document is New York's: "section(s) N of this
    chapter" and "of the … law", lists ("sections three hundred three, three
    hundred three-a and three hundred three-b"), "subdivision five of section
    seventy-six-a of the alcoholic beverage control law" as one citation with
    its portion. Numbers spelled out are read (`wordsToNumber`: "two thousand
    eight hundred one-a" → `2801-a`); law names map to codes through the
    engine's table, or a table the caller passes.
- **`citationsOf(doc, context)`**: every citation in a document with its
  positions, ref marks first, then the words no ref covers. **`worksOf`**:
  the distinct Works cited.

### Verified

`node --test scripts/typeset/cite.test.mjs scripts/typeset/amend.test.mjs`:
**24 of 24 pass**. The six citation tests:

- H.R. 6644 § 102: its refs resolve to the US Code
  (`/us/usc/t42/s5301` among them), each position exact against the
  document's text.
- 10 U.S.C. 130i: refs with portions (`/us/usc/t31/s1105/a` under Work
  `/us/usc/t31/s1105`), positions exact.
- N.Y. Agric. & Mkts. § 16: 18 cited Works, among them `agm/s303`,
  `s303-a` and `s303-b` from one spelled-out list, `env/s33-0101`,
  `abc/s76-a` (with subdivision 5), `pen/s210.45` and `gbs/s753-f`.

One miss found and fixed on the way: "seventy-six-a" read as "seven"
(alternation order).

### Plan for the rest

2. **Resolution against the corpus**, `lib/typeset/resolve.ts` and
   `POST /api/typeset/cite`: each cited Work's Expression in force on the
   citing document's date, from `expressions`, cached per citing Expression.
   Advisories: not in the corpus; changed since (the Work has a later
   Expression than the one in force on the citing date).
3. **Decorations** over the XML reader and the Fork view's editor, never
   marks: a found citation underlined and opening its Work in Typeset, a
   missing one muted, an advisory flagged. Computed once per document and on
   a pause after editing, not per keystroke.
4. **`@`** in ⌘K (replacing the "arrive with the library" stub) and in the
   Fork view's editor: citations typed as law is written ("10 U.S.C. 130i",
   an address), members and committees from `"People"` and `"Committees"`,
   and the document's own defined terms.
5. **The in-context view**, a mode of the Fork view: the document on the
   left with an `@` marker on each amendment instruction; the affected
   statutes on the right, one tab each, rendered from their dated
   Expressions with the redline in place. A fork of a statute takes its
   redline from the engine. A bill's own instructions ("in subsection
   (a)(4)(C), by striking … and inserting …") are carried out on the cited
   section first, for the forms the engine writes. A form not yet read says
   so in its tab.

### Files

`apps/web/lib/typeset/cite.ts`, `apps/web/lib/typeset/amend.ts` (`NY_LAWS`
exported), `scripts/typeset/cite.test.mjs`, `scripts/typeset/amend-entry.ts`,
`apps/web/docs/xml/window-6.md`.
