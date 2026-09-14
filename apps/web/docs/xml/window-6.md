# Window 6: citations and context — report

Report to the lead. Newest milestone first. Run by window 5's session after
its brief was accepted (`lib/xml/todo.ts`, claimed by window-5).

## Milestone 2 — resolved against the corpus, decorated, and `@` (2026-09-14)

### Built

- **Resolution**, `lib/typeset/resolve.ts` and `POST /api/typeset/cite`.
  - For each cited Work it returns the Expression in force on the citing
    document's date and the latest one. It reads the `expressions` index
    only, never S3, and keeps each answer per citing Expression for an hour.
  - Two advisories: "Not in the corpus yet", and "Changed since", when the
    Work has a text later than the one in force on the citing date.
  - A Work whose every stored text is later than the citation is not
    flagged. That is how the US Code is held (one release point a section),
    and the date shown says which text opens.
- **Decorations**, `components/workspace/typeset-cite-layer.ts` with
  `typeset-cite.css`. Citations are laid over the document and never written
  into it:
  - a found citation is dotted-underlined and opens its Work in Typeset at
    the citing date
  - a missing one is faintly underlined
  - an advisory is tinted amber, its text in the title
  - the layer runs once when the document mounts, and again a second after
    an edit pauses. Resolutions already known stay in the browser.
  - The XML reader takes an optional `cite` context: its jurisdiction, Work
    and date. `typeset-xml-reader.tsx` gained that one prop, and the bill's
    XML view and window 4's Work page pass it. The Fork view's editor carries
    the same layer; there a modifier-click opens a citation, because a plain
    click places the cursor.
- **`@`**, `GET /api/typeset/at`:
  - citations typed the way law is written ("10 usc 130i", "section 16 of
    the agriculture and markets law", an address), each Work once
  - members from `"People"` (trigram index on name), the reader's state
    first
  - committees from `"Committees"`
  - In ⌘K, `@` replaces the "arrive with the library" stub
    (`slash-library.tsx`, `command-menu.tsx`).
  - In the Fork view (`typeset-at-palette.tsx`), typing "@" or the toolbar's
    @ opens the palette at the cursor. It lists the document's own defined
    terms too. The chosen words replace the "@", a citation or an entity
    carrying a `ref` to its address or page.

### Verified, on the branch server (clone at 7ee0f17)

- 24 of 24 tests; bounded type check over every touched file, 0 diagnostics.
- `/api/typeset/cite` for H.R. 6644 as enrolled:
  - found: 42 U.S.C. 5301 (release point 2026-09-09) and 12 U.S.C. 1701x
  - not in the corpus: Public Law 114-113 (no public laws are loaded)
- For N.Y. § 16: `agm/s303`, `agm/s303-A`, `agm/s303-B` and `abc/s76-A`
  (2024-08-30) found.
- `@10 usc 130i` returns the section as of 2026-04-17, once; `@Schumer`
  returns the senator.
- `/workspace/typeset/bill/2058568/xml`, `/workspace/typeset/work/us/usc/t10/s130i`
  and `/workspace/typeset/fork/168` answer 200.
- Fixed on the way:
  - **Lettered sections.** New York's stored addresses keep the Senate's
    upper-case letter, and `s76-a` found nothing; New York section letters
    are now upper-cased.
  - **Noisy advisory.** "Nothing stored from before" flagged nearly every
    federal citation; it is gone.
  - **Duplicates.** `@` listed a federal citation twice.

### Next: milestone 3, the in-context view

A mode of the Fork view:
- **Left:** the document, with an `@` marker on each amendment instruction.
- **Right:** a tab per affected statute, rendered from its dated
  Expression, with the redline in place.
- **Where the redline comes from:**
  - A fork of a statute takes it from the engine: the base section with the
    fork's changes laid over.
  - A bill's own instructions (H.R. 6644 § 101: "Section 106 of the Housing
    and Urban Development Act of 1968 (12 U.S.C. 1701x) is amended— (1) in
    subsection (a)(4)(C), by striking … and inserting …; (2) in subsection
    (e), by adding at the end the following: …") are carried out on the
    cited section first. The target comes from the chapeau's citation; the
    forms read are the ones the engine writes (strike and insert, "and all
    that follows through", insert after, add at the end, strike a unit, read
    as follows). A form not yet read says so in its tab.
- Not yet looked at in a browser: the decorations, both palettes.

### Files

`apps/web/lib/typeset/resolve.ts`, `apps/web/lib/typeset/cite.ts`,
`apps/web/app/api/typeset/cite/route.ts`, `apps/web/app/api/typeset/at/route.ts`,
`apps/web/components/workspace/typeset-cite-layer.ts`, `typeset-cite.css`,
`typeset-at-palette.tsx`, `typeset-xml-reader.tsx` (the `cite` prop),
`typeset-workspace-2.tsx`, `typeset-work.tsx`, `typeset-fork.tsx`,
`apps/web/components/slash-library.tsx`, `apps/web/components/command-menu.tsx`,
`scripts/typeset/cite.test.mjs`, `apps/web/docs/xml/window-6.md`.

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
