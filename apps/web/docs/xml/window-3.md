# Window 3: the grammars and the Compiler surface — report

The lead's own support work; no subagent. Newest milestone first.

## Milestone 3 — every state has a front end; the Compiler page (2026-09-14 ~06:00 EDT)

- `lib/xml/frontends/generic.ts` reads any state's printed bill through a profile (`frontends/profiles.ts`): preface, enacting formula, sections, quoted law, the levels below by rank of appearance, resolutions, line numbers stripped, blank-per-line captures collapsed, bracketed omissions as `del`. Illinois, Texas, New Jersey, California, Pennsylvania and Massachusetts were read from the corpus; the rest run on the common form. Every state is registered in `frontEndFor`.
- Measured, bills: California 99.2%, Texas 96.9%, New Jersey 96.8%, Pennsylvania 94.0%, and twenty-four more states on the common profile (14 of 33 lines at 95% or better). Illinois (70%) and Massachusetts (74%) have captures that hold a synopsis or a petition rather than a bill; Oklahoma, Virginia, Kentucky, Florida, Louisiana and Oregon are the next profiles to read. The table is in `sources.md`.
- The Compiler page at `/workspace/dashboard/compiler` (`components/admin/pages/compiler.tsx`): the front ends as a grid with coverage, dialects, clean over sampled, fall-outs and unknown elements, the profile's units under each row, a link to the grammar catalogue, and Measure, a fresh sample of eight through `/api/xml/measure`. Compiles on the 3002 server.
- The pipeline box: a fresh c7g.4xlarge (`govblock-xml-direct`, 174.129.48.245) bootstrapped with node, pnpm and the branch, for the pipeline alone; the dev box (43 of 50 GB used) keeps the two dev servers. An image of the dev box was started first and abandoned when its snapshot ran slow; it can be deregistered.
- New York Constitution sections (no heading, "Section 1." after the article's own heading) are read correctly now.

## Milestone 2 — New York, 2026-09-14 ~06:10 EDT

- `lib/xml/frontends/ny.ts`: statutes from the Senate API's tree, bills and resolutions from the printed text, on the role convention (USLM element by rank, New York's word in `role`; Window 1's ruling). New matter and omitted matter as `ins` and `del`; the law a bill quotes as `quotedContent`.
- Measured live: statutes 97.1% (53 of 60 clean), bills 99.4% (56 of 60 clean; 48 bills, 12 resolutions). Fall-outs in the coverage file.
- `lib/xml/ir.ts` gains `toXml`; the federal front end rewrites citations into the address scheme; the vocabulary gains the enrolled bills' meta elements.
- Grammar catalogue: `docs/xml/grammars/us.md`, `docs/xml/grammars/ny.md`; the acquisition review started in `docs/xml/sources.md`.
- Sampling bills goes through `Bills` first (a random order over `BillTexts` with its join is minutes over the Data API); sponsor memos are excluded.

## Milestone 1 — federal, 2026-09-14 ~05:20 EDT

- The IR (`lib/xml/ir.ts`), the USLM vocabulary and the Bill DTD mapping (`lib/xml/uslm-elements.ts`), the federal front end (`frontends/us.ts`), the plain-text front end (`frontends/text.ts`), the bundling runner (`scripts/xml/bundle.mjs`) and the coverage script (`scripts/xml/coverage.mjs`).
- Federal measured on sixty live GovInfo documents: 99.5%, 51 of 60 clean.

## Open

- The remaining states, in order of corpus size.

## For Brendan

- Nothing that needs a decision tonight.
