# Window 8: grammars, round two — the states under 80%

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first
("The compiler"), then `2026-09-14-grammars-and-compiler.md` (window 3's
brief; this is its second round), then `apps/web/docs/xml/window-3.md`,
`sources.md` and `grammars/`. This brief is your scope only. Runs now.

## What the number is

Coverage is a parser's score, not the corpus's. Every statute section and
bill printing a state publishes is stored as plain text already. Coverage
is the share of that text the state's front end placed into USLM elements
(section, subsection, paragraph, chapeau, continuation…) rather than
leaving as unlabeled text. Kansas statutes at 56% means the front end
understood 56% of a Kansas section on average. The text is all there; the
grammar is what is missing.

## The list, from window-2.md's table at the end of the night

Statutes: Kansas 56.4, Louisiana 71.7, Indiana 72.2, Nevada 75, South
Carolina 75, Oregon 78, Maryland 78.5, Washington 79.
Bills: New Mexico 65, Utah 66, Massachusetts 72.9, Colorado 73.0, New
Hampshire 74, South Carolina 75, Vermont 75, Kentucky 77.4, Oklahoma 79.

Seventeen lines. Take them in order of corpus size (window-3.md has the
sizes), largest first, because a point of coverage on Indiana's 80,485
sections is worth more than ten on Vermont's.

## How a grammar is derived

As window 3 did it: from the corpus, never from the state's documentation.
Sample fifty documents through `"Bills"` or `"Laws"` (never `"BillTexts"`
by random order), read them, name the units the state uses and the
enumerators it writes them with, write the profile in
`apps/web/lib/xml/frontends/profiles.ts` (or a front end of its own when
the profile cannot say it), measure with `scripts/xml/coverage.mjs`, read
the fall-outs, repeat until the measured line stops moving. Each state's
grammar goes in `apps/web/docs/xml/grammars/` with its units, its
enumerator sequences, the sample it was derived from, and its number.
State units take the USLM element for their rank with the state's own word
in `role`.

The generic front ends report their problems as notes, not as unknown
element names, so the Compiler page's fall-out column is empty for the
states. Fix that first, for every state at once: aggregate `report.notes`
into `xml_fallouts` as stage `coverage` the way the federal front end
reports elements, so the page shows why a state is low before you read
fifty documents by hand.

## The bar

Every line on the list at 90% or better, measured; a line that will not
move past 85 after a real attempt is written up with the reason in its
grammar file (a source that is a PDF's text with the structure lost is the
usual one) and named in the report as an acquisition problem for window 7,
not a grammar problem. When a front end improves, queue the rebuild from
the Ingestion page ("Again, if built") for that jurisdiction; the pipeline
box has to be running for it (window-2.md, "The floor").

## Rules

The program's rules in full, and: the front ends are shared code that
window 2's pipeline runs; keep each change to one jurisdiction's profile
or file, commit by path with the measured before-and-after in the message,
and never change `lib/xml/frontends/federal.ts` or the schema. Report at
`apps/web/docs/xml/window-8.md` at every milestone: the table of the
seventeen lines with the starting number and the current one.
