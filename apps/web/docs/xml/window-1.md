# Window 1: the reader — report

## Milestone 2 — H.R. 6644 in the XML view, 2026-09-14 06:40 EDT

### Built

- `lib/xml/schema.ts`: the reader's ProseMirror schema, USLM's element set by
  name, rank enforced below the section, generic `level` as the escape hatch.
  `docs/xml/schema.md` §2 is v1 and matches it, with the role convention and
  the New York rank ruling written in.
- `lib/xml/uslm-to-doc.ts`: the lead's IR (`lib/xml/ir.ts`, both federal
  dialects already renamed to USLM) into the schema. Unknown elements, rank
  violations, read-through containers and skipped furniture are all counted
  in the report.
- `lib/xml/convert.ts`: `docToHtml` (DOMSerializer over linkedom, the first
  paint), `docToMarkdown`, `docToText`, and `toXml` from the IR; `irTo*` for a
  caller holding a front end's output. `lib/xml/address.ts`: parse and format
  the address, bill Works from `Bills` rows, the S3 key, and `resolveSlash`
  for the `/` stub.
- `lib/typeset/xml-document.ts`: a printing's USLM through its jurisdiction's
  front end, into the schema, drawn as HTML; kept in memory per printing like
  `lib/typeset/document.ts`, and in `typeset_documents` once
  `sql/010_typeset_documents_prosemirror.sql` runs (written, not run).
  `fetchUslmXml` split out of `fetchUslm` in `lib/policy/bill-uslm.ts`, so
  there is one fetch.
- `app/api/typeset/xml/route.ts`: the ProseMirror JSON, gated like
  `/api/typeset/content`, gzipped once per document.
- The view: `xml`, "XML", 06 in `lib/typeset/views.ts`;
  `components/workspace/typeset-xml-reader.tsx` (+ `.css`) paints the server's
  HTML, fetches the JSON and mounts a read-only Tiptap editor built from
  `typeset-xml-extensions.ts`, which generates the extensions from the same
  schema tables. The page builds the first paint for `xml` beside the Plate
  snapshot. The default view is unchanged.

### Verified, on the box (`~/govblock-xml`, port 3002)

- Bounded type check over the twelve touched TypeScript files: 0 diagnostics
  (4,351 files in the program).
- `GET /api/typeset/xml?bill=2058568`: 200. The default printing is the House
  amendment, `/us/bill/119/hr/6644@2026-05-20_eah`, Bill DTD. Front end
  coverage 99.99% (one unknown: `engrossed-amendment-form`); `uslmToDoc`: 0
  rank violations; 67 sections, 245 subsections, 548 paragraphs, 603
  subparagraphs, 388 clauses, 114 subclauses, 27 items, 12 titles, 379
  chapeaux, 90 continuations, 90 quoted blocks, 73 table-of-contents entries.
  The enrolled bill (USLM 2) gives the same shape: 72 sections, 439 chapeaux,
  88 quoted blocks, 0 violations.
- Build: GovInfo fetch 98 ms (Next's fetch cache), front end 43 ms,
  `uslmToDoc` 120 ms, HTML 257 ms. 561 KB XML → 1.84 MB JSON (179 KB gzipped)
  and 1.23 MB HTML.
- `GET /workspace/typeset/bill/2058568/xml`: 200; first compile 54.6 s, then
  0.59 s; 2.9 MB page with the snapshot in it. Dev log clean.
- Not yet looked at in a browser; that is Brendan's, at
  `http://localhost:3002/workspace/typeset/bill/2058568/xml`.

### The box

- Restarted at 09:00 UTC by `govblock-stop.timer`, which shuts the box down
  every day at 09:00 UTC (xml-2 found it). A start resets the idle timer, so
  `govblock-idle.timer` was stopped again at 09:06 UTC.
- 3002 server, started by hand after the restart:
  `cd ~/govblock-xml/apps/web && (PORT=3002 BRENDAN_OK_LOCAL_BUILD=1 GOVBLOCK_DEV_BOX=1 DEV_HEAP=4096 setsid nohup pnpm dev > ~/govblock-xml/logs/dev-3002.log 2>&1 < /dev/null &)`.
  Mac tunnel: `ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 3002:127.0.0.1:3002 govblock-dev-direct`.
  The clone's `apps/web/.env.local` has `AUTH_URL=http://localhost:3002`, so
  sign-in stays on the branch server.
- The clone is updated with `git pull --rebase` using the Mac's `gh` token
  over stdin (the memory note's credential-helper form). Files are rsynced in
  to compile and removed before a pull, because xml-2 pushes into the clone
  with `updateInstead`.

### Next

1. The parse tile on the Data Pipeline dashboard and its route.
2. The plain-text fallback on a state bill, checked in the page.
3. A second federal bill with quoted amendments; structural comparison
   against the Plate reader's HTML with counts; `docs/xml/reader.md`.
4. The `/` command stub.
5. The single-parser switch in `lib/policy/bill-uslm.ts` (approved by the
   lead), with the Plate HTML for H.R. 6644 compared byte for byte.

### For Brendan

- `sql/010_typeset_documents_prosemirror.sql` adds nullable columns to
  `typeset_documents`. The brief says written, not run; the program's rules
  say no change to an existing table's columns. It waits for your word.

### Files touched

- `apps/web/lib/xml/schema.ts`, `uslm-to-doc.ts`, `convert.ts`, `address.ts`
  (the first three also landed in the lead's 1ba7fcd and 36c9b74 before they
  were finished; this commit carries the finished versions)
- `apps/web/lib/typeset/xml-document.ts`, `apps/web/lib/typeset/views.ts`
- `apps/web/lib/policy/bill-uslm.ts` (`fetchUslmXml`)
- `apps/web/app/api/typeset/xml/route.ts`
- `apps/web/app/workspace/typeset/bill/[id]/[[...view]]/page.tsx`
- `apps/web/components/workspace/typeset-workspace-2.tsx`,
  `typeset-xml-reader.tsx`, `typeset-xml-reader.css`, `typeset-xml-extensions.ts`
- `apps/web/docs/xml/schema.md`, `apps/web/docs/xml/window-1.md`
- `sql/010_typeset_documents_prosemirror.sql`

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
