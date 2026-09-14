# Window 3: the grammars and the Compiler surface — report

The lead's own support work; no subagent. Newest milestone first.

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

- The Compiler page under `/workspace/dashboard` is not built yet; next after the largest states have a first front end.
- The remaining states, in order of corpus size.

## For Brendan

- Nothing that needs a decision tonight.
