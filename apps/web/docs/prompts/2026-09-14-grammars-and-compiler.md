# Window 3: the grammars, one front end per jurisdiction, and the Compiler surface

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first,
especially "The compiler". This brief is your scope only. Runs now, in
parallel with windows 1 and 2; window 2 runs whatever front ends you
publish, so publish early and often.

## What this window makes

The fifty front ends. Each jurisdiction publishes law in its own surface
syntax; a front end lifts that syntax into the IR, USLM over the Akoma
Ntoso base, using `hcontainer` with a name for any unit USLM does not name.
A front end is derived from the corpus already stored, not from a
jurisdiction's documentation, and it carries a measured coverage: the share
of the jurisdiction's text that parses cleanly through it. The grammar is a
living spec with a number.

## Sources, all already stored

Aurora `Laws` (one row per location, with `text`, `depth`,
`parent_location_id`, `sequence_no`, `doc_type`, `doc_level_id`), `BillTexts`
(fetched bill text per document), `Documents.url`,
`congress_text_formats.xml_url`; S3 `govblock-lake-638175140432` under
`lake/v1/text/bill_texts` and `livingston-bill-pdfs-638175140432`. The
adapters under `scripts/laws/adapters/` (53 files; `us.mjs` reads native
USLM from the OLRC) already infer each state's hierarchy once; read each
adapter before deriving its state's grammar, and reuse its knowledge.
`lib/policy/bill-uslm.ts` has `parseXml` (USLM to a tag tree) and
`plainTextHtml` (the plain-text heuristics: enumerations, hyphenation,
level breaks); both are starting points.

## Scope

1. **The front-end contract.** `lib/xml/frontends/<jurisdiction>.ts`, each
   exporting one function from a stored source (text, HTML or XML plus its
   row) to the IR as the parsed-tree shape `parseXml` returns, and a
   `profile` describing the jurisdiction's units and how each is signalled.
   Federal first: native USLM, a validating pass-through, done in the first
   half hour so window 2 can start loading. Coordinate the tree shape with
   window 1 through `apps/web/docs/xml/schema.md`.
2. **Coverage measurement.** A script under `scripts/xml/` that samples a
   jurisdiction's stored text, runs its front end, and counts clean parses,
   partial parses and fall-outs, with the most common fall-out patterns
   listed. Its output is one line per jurisdiction in
   `lib/xml/coverage.generated.json` (jurisdiction, profile, sample size,
   coverage, unknown units, top fall-outs, measured at), committed on the
   branch every time it runs.
3. **The states, in order of value.** New York, then the states with the
   most bills in the corpus, then the rest. Derive each grammar from a
   sample, write the front end, measure, commit, move on; come back for the
   long tail (tables, quoted amendments, historical formatting, odd
   numbering) once every state has a first front end. A state that only
   reaches plain-text heuristics ships with that coverage number, not
   nothing.
4. **The grammar catalogue.** `apps/web/docs/xml/grammars/<jurisdiction>.md`:
   the units, how each is signalled, the USLM element or `hcontainer` name
   it maps to, known gaps.
5. **The Compiler page.** A new page under `/workspace/dashboard`
   (`components/admin/pages/compiler.tsx`, registered in
   `components/admin/pages/index.tsx`): the front ends as a grid, one card
   per jurisdiction with its profile, measured coverage, unknown units and
   sample fall-outs, sortable by coverage; a jurisdiction opens its
   catalogue and a "run a sample" button that measures again through a route
   under `app/api/xml/`. Runnable and observable without a terminal.
6. **The acquisition review.** `apps/web/docs/xml/sources.md`: every
   jurisdiction, its source of record, whether native XML exists, the tier
   the front end reaches, and what it would take to move up a tier.

## Not in scope

Storage and loads (window 2), converters out of the IR (window 1), the
editor.

## Done means

A front end and a coverage line for federal and for every state, the
federal one within the first half hour and New York within the first two
hours; the Compiler page shows the grid from the coverage file and can
re-measure; the catalogue and `sources.md` cover every jurisdiction.
Committed on the branch by path. Report at
`apps/web/docs/xml/window-3.md`, updated as each jurisdiction lands.
