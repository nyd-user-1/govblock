# Window 1: the reader — report

## Milestone 1 — the address, 2026-09-14 05:00 EDT

### Built

- `apps/web/docs/xml/schema.md`: the address scheme, frozen, and the node list,
  v0. The address is USLM's referencing model (the federal profile of Akoma
  Ntoso's naming) applied to every jurisdiction: `/us/bill/119/hr/6644@2025-12-11_ih`,
  `/us/usc/t10/s130i`, `/us-ny/code/agm/s3`, `/us-ny/bill/2025`. The S3 key is
  `lake/v1/xml` + the Work + `/<expression>.xml`.
- Chosen over the literal `/akn/...` IRI because every federal USLM document
  already carries these paths in its `identifier` attributes, so federal
  documents need no rewrite and `<ref href>` resolves as published. The `/akn/`
  form is a one-line rewrite, documented.

### Verified against the corpus

- Bill keys: `"Bills".session_id` is the session's first year for every
  jurisdiction (US 2025 = the 119th Congress); special sessions share the year
  and differ only in `session_title` ("2024 3rd Special Session"), hence
  `2024s3`.
- H.R. 6644's printings in `congress_text_formats`: seven Bill DTD printings
  and the enrolled bill and Public Law 119-101 as USLM 2; the enrolled bill's
  `version_date` is null, so the expression date comes from GovInfo.
- `"Laws".location_id` is unique only within a code, and a section number is
  not always unique in its code: New York's Constitution (`CNS`, 201 sections,
  44 distinct numbers) restarts per article, and Texas codes repeat a handful.
  The address takes a per-code section scope for that.
- Element list and level content model read from `uslm-2.0.17.xsd`; tag counts
  from H.R. 6644's enrolled USLM (2,419 `num`, 439 `chapeau`, 88
  `quotedContent`, 541 `amendingAction`).

### The box

- Box started with `~/bin/govblock-dev-up` (it was stopped); tunnel 3001 up,
  direct to 34.229.12.52.
- `sudo systemctl stop govblock-idle.timer` at 08:35 UTC. xml-2 stopped it too.
  The lead restarts it when the shift ends.
- `~/govblock-xml` was made by xml-2 at 08:33 UTC (a clone of `~/govblock`,
  origin GitHub, `feature/legislative-xml`, `.env.local` copied, `logs/` in
  `.git/info/exclude`). This window runs its dev server on 3002 and the tunnel.

### Plan for the rest

1. Dev server on 3002 in `~/govblock-xml` under nohup, tunnel 3002.
2. `lib/xml/address.ts`: parse and format the address, the `/` stub's resolver.
3. `lib/xml/schema.ts`: the ProseMirror schema from section 2, built from the
   rank table, no React.
4. `lib/xml/uslm-to-doc.ts` over the lead's `IrNode` (`lib/xml/ir.ts`) and
   `frontends/us.ts`; the parse report (node counts, unknown elements,
   violations, timings).
5. `lib/xml/to-html.ts` (DOMSerializer over linkedom), `to-markdown.ts`,
   `to-text.ts`, `to-xml.ts`; the plain-text fallback into the same schema.
6. The `xml` view: `lib/typeset/views.ts`, `components/workspace/typeset-xml-reader.tsx`,
   server first paint cached like `lib/typeset/document.ts`; migration for the
   ProseMirror JSON column, written, not run.
7. The "USLM parse" tile on the Data Pipeline dashboard, through `app/api/typeset/uslm-parse`.
8. H.R. 6644 and a second federal bill measured on the box, into `docs/xml/reader.md`.

### For Brendan

- Nothing yet.

### Files touched

- `apps/web/docs/xml/schema.md`
- `apps/web/docs/xml/window-1.md`
