# Window 6: the `@` resolver, decorations, and the in-context view

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first, then
the schema, the storage and the engine from windows 1, 2 and 5. This brief
is your scope only. Runs after window 5.

## What `@` is

References. Two jobs that overlap:

- **Citations.** `§ 2801-a`, `6 U.S.C. 124n`, "section 210G of the Homeland
  Security Act". USLM already marks federal ones as `external-xref` with a
  `parsable-cite` (`usc/6/124n`, `public-law/…`); the reader's parser keeps
  them as `ref` nodes. Resolve each to the Work in the corpus: the US Code
  section, the New York location, the bill. State citations need a
  recognizer per convention; start with New York and federal.
- **Entities.** Akoma Ntoso's ontology: persons, organizations, roles,
  concepts. `@` addresses a sponsor, a committee, a defined term, through
  the People and Committees the site already has.

## Decorations, never marks

Advisories render as ProseMirror decorations over the document: this section
was repealed in 2019; this term is defined differently in three chapters;
this subdivision conflicts with §X. The document is never written to.
Resolution results are cached per Expression, not recomputed per keystroke.

## The in-context view

From Brendan's screenshots: the bill or fork on the left with an `@` marker
on each amendment instruction; the affected statutes on the right, tabbed
(the Homeland Security Act, 10 U.S.C. 130i, and so on), each rendered from
its dated Expression with the redline in place. Clicking a marker opens its
tab. The redline comes from window 5's engine; the tabs come from resolving
the instruction's citations.

## Scope

1. `lib/typeset/cite.ts`: recognizers and the resolver, pure, with tests.
2. The `@` command in the editor: entities and citations in one palette,
   sharing the `/` command's addressing from window 1.
3. Decorations for resolved references and advisories.
4. The in-context view as a mode of the Fork view.

## Not in scope

New jurisdictions' citation conventions beyond federal and New York, removing
Plate, public proposals.

## Done means

Citations in H.R. 6644 and a New York section resolve to corpus Works and
render as decorations; `@` opens the palette; the in-context view shows a
fork's instructions on the left and the affected statutes on the right with
the redline in place. Committed on the branch. Report at
`apps/web/docs/xml/window-6.md`.
