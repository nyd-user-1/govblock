# Window 6: citations and context — report

Report to the lead. Newest milestone first. Run by window 5's session after
its brief was accepted (`lib/xml/todo.ts`, claimed by window-5). Milestone 3
goes to a fresh window, `window-6b`, on the lead's word at 60% context; its
brief is the next section.

## Milestone 3 — the in-context view (window 6b, 2026-09-14)

### Built

The Fork view has a third mode: Edit | Redline | **In context**.

- **Left:** the fork's own editor, with an `@` marker on each amendment
  instruction. Each marker is a widget decoration (`at-marker`), so it is
  never written into the document. Clicking a marker opens its tab and
  scrolls to the unit; in the editable document it does not place the
  cursor. The markers are read again 400 ms after an edit pauses, and they
  are removed when the mode closes.
  - A fork of a **bill**: a marker at the end of each instruction's words
    (`instructionsOf`). Instructions that end in the same words share one
    marker, and its title names the unit ("12 U.S.C. 1701x(a)(4)(C)").
  - A fork of a **statute**: a marker at the end of the first line of each
    unit the engine's instructions name. Its title is that instruction.
- **Right:** one tab per affected Work, named by the index's label ("12
  U.S.C. 1701x"). Beside the tabs are the text's date and a link that opens
  the Work in Typeset.
  - A bill's Works resolve through `POST /api/typeset/cite` as of the bill's
    date. The tab then loads `GET /api/typeset/work?address=<work>@<expression>`.
    It goes by the Expression, not `at=`, because `expressionAt` finds nothing
    when every stored text is later than the bill, which is the case for the
    whole US Code.
  - The text is drawn read-only, with the redline laid over it. The redline
    is `carryOut`, then `diffDocs` against the text itself, then `marked`.
  - Under the text, each instruction's outcome: Applied, Already made, Not
    found, Refused, Not yet read. The reason follows unless it applied.
    Clicking a row brings its unit into view.
  - When every instruction is already made, the tab says "The stored text,
    dated Jul 23, 2026, already carries these amendments." It does not draw
    an empty redline.
  - A statute fork's one tab is the whole section, from the base's own
    Expression, with the fork grafted in place of the portion it copies. The
    engine's instructions are listed under the text.
  - A tab the reader may not open shows the gate's own words ("Sign in to
    open laws. …"). A Work not in the corpus shows the advisory.
- **Pure half**, `lib/typeset/in-context.ts`, on top of milestones 1 and 2
  and not replacing them:
  - `billContext`
  - `billRedline`, which gives a text served without its identifier the
    tab's Work
  - `forkContext`
  - `graft`, `forkRedline`
  - `byIdentifier`, and `unitPos`, which falls back to the nearest unit above
    one the text lacks
  - `OUTCOME_WORDS`
- The redline decorations (`decorate`, `Redline`, `redlineKey`) moved
  unchanged from `typeset-fork.tsx` to `typeset-redline.ts`, so the Redline
  mode and the tabs share them without a circular import.

### Verified

- **33 of 33 tests** (`node --test scripts/typeset/in-context.test.mjs
  scripts/typeset/instruct.test.mjs scripts/typeset/cite.test.mjs
  scripts/typeset/amend.test.mjs`). The five new tests:
  - H.R. 6644 § 101: five markers, each at its instruction's end, one Work.
  - On the stored 1701x: five outcomes and no specs.
  - On the text before it, served without an identifier: applied. The specs
    strike "adequate distribution" and insert "geographically diverse" at the
    statute's own positions.
  - `unitPos` falls back to the nearest unit.
  - A fork of 10 U.S.C. 130i(b)(1): one marker on (b)(1)(D). Grafted into
    the whole section, the redline strikes "exercise", inserts "assume", and
    stays inside (D). A portion the section lacks does not graft.
- Bounded type check over the six touched TypeScript files: 0 diagnostics.
- **On the branch server** (clone fast-forwarded to d67fd96):
  - Fork 199 of `/us/bill/119/hr/6644/tI/s101@2026-06-25_enr` was made.
    `/workspace/typeset/fork/199` answers 200, with no errors from these
    requests in the dev log.
  - Resolving 1701x as of 2026-06-25 gives Expression `2026-07-23`, labelled
    "12 U.S.C. 1701x", which is the tab's address.
  - The served payload for fork 199, run through the pure half:
    - one tab, `/us/usc/t12/s1701x`
    - five markers: (a)(4)(C), (e), (i) twice, and the section
    - zero specs
    - five outcomes, all Already made: "the inserted words are already in the
      text", "paragraph (6) is already in …/e", "the units already carry
      their new numbers", "paragraph (3) is already in …/i", "subsection (j)
      is already in /us/usc/t12/s1701x"
  - Anonymously, the tab's load answers 403 "Sign in to open laws.", which
    is what the tab shows.
- **Not yet looked at in a browser:** the markers, the tabs and the redline
  over a US Code or New York text. Those need a signed-in reader, so they are
  Brendan's.

### Open

- The redline for H.R. 6644 draws only once the store holds a text of 1701x
  from before 2026-06-25. Today every instruction reads as already made.
- A bill that cites many Works opens a tab's text only when the tab is first
  shown. Its outcomes are not counted on the tab until then.
- The toolbar's unit buttons work in Edit only. In context, the editor still
  takes typing, and the markers follow after the pause.
- Test row: fork 199, under a throwaway claim.

### For Brendan

Signed in, on `http://localhost:3002`:

1. Open `/workspace/typeset/fork/199` and press **In context**. There should
   be five `@` markers in § 101 and one tab, 12 U.S.C. 1701x. The tab should
   show the "already carries these amendments" line and five outcomes marked
   Already made. Click the (e) marker: the tab should scroll to subsection (e).
2. Open `/workspace/typeset/work/us/usc/t10/s130i`, fork (b)(1), and change
   "exercise" to "assume". In context, there should be one marker on (D). The
   tab should show the whole of 130i with "exercise" struck and "assume"
   inserted in (b)(1)(D).

### Files

`apps/web/lib/typeset/in-context.ts`, `scripts/typeset/in-context.test.mjs`,
`scripts/typeset/amend-entry.ts`,
`apps/web/components/workspace/typeset-context.tsx`, `typeset-redline.ts`,
`typeset-fork.tsx` (the third mode; the redline moved out), `typeset-cite.css`,
`apps/web/docs/xml/window-6.md`.

## Milestone 3 brief: the in-context view (for window 6b)

Read `apps/web/docs/prompts/2026-09-14-legislative-xml-program.md` and
`2026-09-14-citations-and-context.md` whole, then this report and
`window-5.md`. Plan, then build. Commit to `feature/legislative-xml` by path
(never `git add -A`, never `--autostash`, never `main`), pull `--rebase` only
with your own paths committed. Report here at every milestone. Ask Brendan
before any production-database action beyond additive DDL under `sql/`.

### What it is

A third mode of the Fork view (`components/workspace/typeset-fork.tsx`):
Edit | Redline | **In context**.

- **Left:** the fork's document with an `@` marker (a decoration, class
  `at-marker` in `typeset-cite.css`) on each amendment instruction.
  - A fork of a **bill**: the markers sit on the bill's own instructions,
    `instructionsOf(doc, ctx)`, which gives each instruction's positions.
  - A fork of a **statute**: the markers sit on the units the fork changed
    (`diffDocs(base, fork)`; each changed node carries `forkPos`), each
    marker holding the engine's instruction for that unit.
- **Right:** a tab per affected Work, named by its label ("12 U.S.C.
  1701x"). Each is drawn from its dated Expression with the redline in place.
  Clicking a marker opens its tab and scrolls to the unit.
- **The redline per tab:**
  - A bill: load the cited Work as of the bill's date, carry out that
    Work's instructions (`carryOut`), diff the statute against the result
    (`diffDocs`), turn it into specs (`marked`), and lay those over a
    read-only editor as the Redline mode already does. Under the text, list
    each instruction's outcome in plain words: applied, already made, not
    found, refused, not yet read.
  - A statute fork: one tab, the whole base section. Graft the fork's
    document in place of the portion it copies (find the node by the fork's
    `work` identifier), then diff and mark the same way.

### What exists, with signatures

| File | What to use |
|---|---|
| `lib/typeset/instruct.ts` (pure, 4 tests) | `instructionsOf(doc, ctx: CiteContext): BillInstruction[]` (`from`, `to`, `text`, `work`, `cite`, `portion: string[]`, `part`, `action`); `carryOut(statute, instructions): { doc, outcomes: Outcome[] }` (`status`: `applied` \| `already-made` \| `not-found` \| `refused` \| `unread` \| `other-work`, `detail`); `parseAction`, `parseInstruction` |
| `lib/typeset/amend.ts` (18 tests) | `diffDocs(base, fork): DiffNode`, `marked(diff): MarkedSpec[]`, `instructions(diff, cite): Amendment`, `linesOf`, `conventionFor`, `textOf`, `numOf`, `elementOf` |
| `lib/typeset/cite.ts` (6 tests) | `citationsOf(doc, ctx): Cite[]`, `worksOf(cites)`, `addressOfHref(href)`, `recognize(text, ctx)` |
| `components/workspace/typeset-fork.tsx` | `TypesetForkView({ forkId })`; inside it `decorate(doc, specs)`, the `Redline` extension and `redlineKey` (export them for the tabs); the payload from `GET /api/typeset/fork?id=` is `{ fork, base: { address, date, label, fidelity, coverage, json }, head, commits, cite }` |
| `components/workspace/typeset-cite-layer.ts` | `CiteDecorations.configure({ onOpen })`, `useCitations(editor, { jurisdiction, work, at, citing })` |
| `components/workspace/typeset-xml-reader.tsx` | `TypesetXmlReader({ billId?, version?, snapshot?, meta?, jsonUrl?, portion?, cite? })` |
| The Work load (window 4) | `GET /api/typeset/work?address=<work>&at=YYYY-MM-DD` returns the Expression's reader JSON (`json`, `meta`, `history`), gated as its record is; `/workspace/typeset/work/<address>` is its page; `workHref(address, at)` in `lib/xml/library.ts` |
| Resolution | `POST /api/typeset/cite { works, at, citing }` → per Work: `found`, `expression`, `date`, `latest`, `label`, `advisories` |

### What the corpus allows, measured

The store holds **one Expression of each US Code section**, the OLRC release
point, and for H.R. 6644 that is later than the bill. So 12 U.S.C. 1701x
(dated 2026-07-23) already carries § 101's amendments. Carried out on it, all
five instructions come back `already-made`, and the diff is empty. The tab
must say so plainly ("The stored text, dated 2026-07-23, already carries
these amendments") rather than draw an empty redline. The test "carried out
on the text before it" shows the redline when a pre-enactment text exists; no
such Expression is in the store today. New York sections are dated by
`"Laws".active_date` and often predate a bill.

### Verify

1. Tests: `node --test scripts/typeset/instruct.test.mjs scripts/typeset/cite.test.mjs scripts/typeset/amend.test.mjs`.
   Then a bounded type check on touched files (`ts.createProgram` over those
   files only, under a 2 GB cap). The hook blocks whole-project checks.
2. On the box: `git push govblock-dev:govblock-xml HEAD:feature/legislative-xml`,
   then the 3002 server through the tunnel.
3. Make a fork of H.R. 6644 § 101 (bills of the current Congress are open
   without sign-in):
   `POST /api/policy/forks {"address": "/us/bill/119/hr/6644/tI/s101@2026-06-25_enr", "claim": "<a uuid>"}`.
4. Open `/workspace/typeset/fork/<id>` and check In context: one tab for
   12 U.S.C. 1701x with five outcomes.
5. US Code and New York tabs need a signed-in reader (laws answer 403
   anonymously), so their look is Brendan's, in his browser.

### Out of scope

Instructions whose struck words span two text blocks; page-and-line
instructions; carrying out a state bill's instructions beyond what
`instructionsOf` reads today (New York's "is amended to read as follows:"
with quoted matter is untested); texts older than the store holds; a screen
for `conflicts()`; public proposals; removing Plate.

## Milestone 3, part 1 — the instruction reader (2026-09-14)

### Built

`apps/web/lib/typeset/instruct.ts`, pure:

- **`instructionsOf(doc, context)`** finds each block that says a law "is
  amended".
  - It names the Work by the block's last citation: the Code parenthetical
    in "Section 106 of the Housing and Urban Development Act of 1968 (12
    U.S.C. 1701x)".
  - It reads the instruction from the rest of the block or, where the block
    ends in a dash, from each level under it. Nested lists ("in subsection
    (i)—") narrow the portion.
  - The quoted law after "the following:" is carried as each instruction's
    matter.
- **`parseAction(words, matter)`** reads:
  - by striking “…” [and all that follows through “…”] [and inserting “…”]
  - by inserting “…” after or before “…”
  - by adding at the end the following
  - by inserting after or before a unit the following
  - by striking a unit, or by striking it and inserting the following
  - by redesignating
  - to read as follows

  Anything else is kept `unread` with its words.
- **`carryOut(statute, instructions)`** carries them out in order on the
  statute. Units are found by identifier, and words tolerate spacing,
  quotation-mark and dash differences. Each instruction reports whether it
  applied, was already made (the inserted words or unit already stand), was
  not found, or was refused by the schema.

### Verified

**28 of 28 tests** across the three files. The four new tests:

- the forms, from the words
- H.R. 6644 § 101's five instructions to 12 U.S.C. 1701x:
  - (a)(4)(C) strike and insert, with "and all that follows through"
  - (e) add at the end, paragraph (6)
  - (i) redesignate
  - (i) insert after paragraph (2)
  - add subsection (j) at the end
- carried out on the stored 1701x, which already carries them: all five are
  already made, and the document is unchanged
- carried out on the text before it, with the struck words put back: applied,
  and the engine strikes "adequate …" and inserts "…geographically diverse…"

The third test caught a real error on the way: a redesignation whose new
number already stands renumbered the unit the bill had inserted. It is now
already made. Bounded type check: 0 diagnostics.

### Files

`apps/web/lib/typeset/instruct.ts`, `scripts/typeset/instruct.test.mjs`,
`scripts/typeset/amend-entry.ts`,
`scripts/typeset/fixtures/us-bill-119-hr-6644-tI-s101@2026-06-25_enr.json`,
`scripts/typeset/fixtures/us-usc-t12-s1701x@2026-07-23.xml`,
`apps/web/lib/xml/todo.ts` (window-6 claimed by window-6b),
`apps/web/docs/xml/window-6.md`.

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

### Next

Milestone 3, the in-context view: see "Milestone 3 brief" at the top. Not
yet looked at in a browser: the decorations and both palettes.

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
