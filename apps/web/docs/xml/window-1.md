# Window 1: the reader — report

## Milestone 7 — the state check closed on dc02906, 2026-09-14 09:35 EDT

- Every amending section on TX H.B. 18, CA A.B. 1607 and A.B. 2052 now holds
  the law it amends as `quotedContent` (1, 2, 1). Coverage 100%, 100%, 98%;
  the schema refuses nothing, 0 violations, both round trips exact; both
  enacting formulas read whole. Final counts in `reader.md`.
- Left for the lead, minor: H.B. 18 splits its instruction at the first
  "Subchapter G", so the quotation opens with "Subchapter G to read as
  follows:" and the quoted subchapter is a paragraph rather than a
  `subchapter`; 301.101's heading carries "In this subchapter:"; A.B. 2052's
  spaced "( l )" is unmatched.

Files: `apps/web/docs/xml/reader.md`, `apps/web/docs/xml/window-1.md`.

## Milestone 6 — the state check against 4d4e888, 2026-09-14 09:10 EDT

- Re-run on the lead's fixed front ends; numbers in `reader.md`, "Texas and
  California". The schema refuses nothing, 0 violations, both round trips
  exact on TX H.B. 18, H.R. 128, CA A.B. 1607, A.B. 2052, S.B. 908.
- Confirmed fixed upstream: "(iii)" (H.B. 18 77% → 80%), Texas brackets as
  `del` (3 on H.R. 128), the enacting formula split out.
- Fixed here: the front ends put `longTitle` and `enactingFormula` inside
  `preface`, where `uslmToDoc` flattened them to paragraphs. They are now
  lifted to the document's own blocks after the preface, as USLM places them.
  H.R. 6644's counts are unchanged; H.R. 2289 as introduced gains its
  `longTitle`.
- Not fixed upstream on these printings: quoted law. All three amending bills
  still have 0 `quotedContent` (the instruction shares a block with the first
  quoted line, or is a `continuation`), and California's formula is split
  mid-phrase. Sent to the lead with the IR excerpts.

Files: `apps/web/lib/xml/uslm-to-doc.ts`, `apps/web/docs/xml/reader.md`,
`apps/web/docs/xml/window-1.md`.

## Milestone 5 — Texas and California through the reader, 2026-09-14 08:45 EDT

Asked by the lead after acceptance: the state-profile front ends
(`frontends/generic.ts`, `profiles.ts`) on a Texas and a California printing,
through the XML view's build path, reporting anything the schema refuses.

### What ran

The build the XML view runs (front end for the state, `uslmToDoc`,
`docToHtml`, `docToJson`), bundled once so a single copy of prosemirror-model
is loaded, plus two round trips: the compact JSON back through
`Node.fromJSON` (what the editor loads) and the first-paint HTML back through
the schema's parse rules. As a script on the box, not in the page, because
Texas and California are outside the free scope and the box has no internal
key for an anonymous request.

| Printing | Front end, coverage | Nodes | Schema refused | Rank violations | JSON / HTML round trip |
|---|---|---|---|---|---|
| TX H.B. 18, enrolled (`/us-tx/bill/2025s2/hb/18`) | Texas, 77% | 3 sections, 9 subsections, 7 paragraphs, 6 subparagraphs, 9 continuations | nothing | 0 | exact / exact |
| TX H.R. 128, enrolled (resolution) | Texas, 100% | 1 resolvingClause, 24 p | nothing | 0 | exact / exact |
| CA A.B. 1607, enrolled (`ca-pubinfo` printing) | California, 100% | 2 sections, 11 subsections, 7 paragraphs, 7 subparagraphs | nothing | 0 | exact / exact |
| CA S.B. 908, enrolled (newest printing, `state_link`) | California, 96% | 48 p, no sections | nothing | 0 | exact / exact |
| NY A11559; H.R. 6644 as plain text | New York; text | as milestone 3 | nothing | 0 | exact / exact |

### Fixed in the schema

The HTML round trip was not exact at first: the parse rules read back only
the attributes every block shares, so a `num` lost its `value`, a `p` its
`implicit`, a `quotedContent` its `origin`, a cell its spans. `readAttrs` now
reads every attribute a node's spec declares. The editor loads from JSON and
was not affected; pasting or reparsing the first paint was. GPO's random `id`s
and layout `class`es stay out of the HTML on purpose (bytes); they are in the
JSON and the IR.

### For the lead: the front ends, not the schema

1. **Quoted law is not `quotedContent` in the Texas and California front
   ends.** California A.B. 1607 SECTION 1: "Section 76000.5 of the Government
   Code is amended to read: 76000.5." is followed by that Code section's
   subdivisions (a), (1), (A) as the *bill section's* own subsection,
   paragraph and subparagraph. Texas H.B. 18 SECTION 1 does the same with
   "is amended by adding Subchapter G to read as follows:" and Sec. 301.101.
   Both have 0 `quotedContent`. The schema accepts it because the ranks are
   legal, but it is structurally wrong: the amendment engine would read the
   Government Code's subdivisions as the bill's. The New York front end's
   "as follows:" rule is the one to generalise ("amended to read:", "to read
   as follows:").
2. **Texas H.B. 18 at 77%:** "(iii) issued civil warrants" is not matched
   and runs on inside clause (ii); the notes show subsection and paragraph
   sequences restarting inside the quoted subchapter, which is the same
   problem as 1.
3. **Front matter is one paragraph.** Texas and California put the title,
   the Legislative Counsel's digest and the enacting formula ("BE IT ENACTED
   BY THE LEGISLATURE OF THE STATE OF TEXAS:", "The people of the State of
   California do enact as follows:") in one `preface` paragraph; USLM has
   `longTitle`, `enactingFormula`, and a note for the digest.
4. **Texas deletions are not marked.** H.R. 128 prints struck text in
   brackets ("[or]", "[the]", "[of $500]"); 0 `del` marks. The brackets are
   Texas's convention for struck language in plain text and can be `del`.
5. **The stored text is a web page for California's `state_link` printings.**
   Of the newest 3,000 California 2025 texts, 581 have `source = 'state_link'`
   and every one of them opens with leginfo's page furniture (script, styles,
   "skip to content"); the 2,419 `ca-pubinfo` texts are clean. New York: 31
   of its newest 1,500 are `state_link`, all web pages. Texas's `state_link`
   texts (1,500) are clean. Typeset and the XML view open a bill's newest
   printing, so for S.B. 908 both draw leginfo's JavaScript as the bill. The
   pipeline should skip or rank below `ca-pubinfo` any `state_link` row for
   California and New York.

### Files touched

- `apps/web/lib/xml/schema.ts` (`readAttrs`)
- `apps/web/docs/xml/window-1.md`

## Milestone 4 — the `/` stub and one parser; done, 2026-09-14 08:10 EDT

### Built

- The `/` command, stubbed, in the site's ⌘K menu: a query starting with `/`
  reads the corpus by address instead of searching the site
  (`components/slash-library.tsx`, twelve lines in
  `components/command-menu.tsx`), through `app/api/typeset/slash/route.ts` and
  `resolveSlash` in `lib/xml/address.ts`. `/119` lists the 119th Congress's
  bills, most recent action first; `/6644` every bill numbered 6644 in any
  jurisdiction; `/hr6644` H.R. 6644 in any Congress; `/new-york-code` New
  York's laws; a full address (`/us/bill/119/hr/6644`) the Work itself. Bills
  open in the XML view. A named library (`/arkansas-agricultural-law`)
  resolves to itself and says it is not built yet: window 4's. `@` is routed
  to the same list by `corpusMode` with nothing in it yet: the seam for
  window 4.
- One XML parser: `lib/policy/bill-uslm.ts` imports `parseXml`, `find`,
  `kids` and `text` from `lib/xml/ir.ts`; its own parser, entity table and
  second decode are gone (approved by the lead).

### Verified, on the box

- Type check over the touched files, with Next's declarations loaded: 0
  diagnostics.
- The slash route on five queries (`/119`, `/6644`, `/hr6644`,
  `/new-york-code`, `/us/bill/119/hr/6644`): each resolves and lists (20, 20,
  15, 100, 1). `/workspace/dashboard` and the XML view compile with the
  changed menu; dev log clean.
- `uslmToHtml` before and after the parser switch, byte for byte: identical
  on H.R. 6644 introduced and House amendment, H.R. 2289 reported, and the
  enrolled bill. `/api/typeset/content` answers 200.

### Done, against the brief

- H.R. 6644 renders in the XML view from native XML, structurally faithful,
  beside the untouched Plate reader: milestones 2–3, `reader.md`.
- The schema is written down: `schema.md`, address frozen, schema v1.
- The parse tile runs on the Data Pipeline dashboard: milestone 3.
- The fallback draws a state bill with a note: milestone 3, checked as a
  script; in the page it needs a reader entitled to New York.
- Fidelity and performance notes: `docs/xml/reader.md`.
- Everything committed on the branch and compiling in `~/govblock-xml`.

### Open

- Browser-side cold load and mount, from `data-json-ms` and `data-mount-ms`
  in Brendan's browser.
- `sql/010` not run (for Brendan).
- Typeset's own reader returns nothing for USLM 2 printings (enrolled bills,
  public laws) and drops the text that closes each quoted amendment. Both are
  in `lib/policy/bill-uslm.ts`'s renderer, which this window left
  byte-identical on purpose; the XML view has neither problem.

### For Brendan

- Look at `http://localhost:3002/workspace/typeset/bill/2058568/xml` (tunnel
  3002), the "USLM parse" tile at `http://localhost:3002/workspace/dashboard`,
  and ⌘K then `/6644` on any page of 3002.

### Files touched

- `apps/web/app/api/typeset/slash/route.ts`, `apps/web/components/slash-library.tsx`,
  `apps/web/components/command-menu.tsx`, `apps/web/lib/xml/address.ts`
- `apps/web/lib/policy/bill-uslm.ts`
- `apps/web/docs/xml/reader.md`, `apps/web/docs/xml/window-1.md`

## Milestone 3 — the parse tile, the fallback, the numbers, 2026-09-14 07:30 EDT

### Built

- The "USLM parse" tile on the Data Pipeline dashboard
  (`components/admin/blocks/uslm-parse-card.tsx`, placed after Jurisdictions
  in `components/admin/pages/database.tsx`, five lines there). A bill id and an
  optional document id in, Run; out come fetch, front end, `uslmToDoc` and HTML
  times, XML, JSON and HTML sizes, node and mark counts by type, unknown
  elements with their first path, rank violations, what was read through or
  skipped, and "Open in XML view". Server side:
  `app/api/typeset/uslm-parse/route.ts`, gated like the reader, every cache
  skipped.
- `docs/xml/reader.md`: the fidelity and performance notes, from
  `scripts/typeset/xml-reader-measure.mjs` (runs on the box against 3002).
- Smaller payloads: `docToJson` leaves unset attributes out (H.R. 6644's JSON
  1.84 MB → 1.06 MB, 159 KB gzipped) and the HTML writes each identifier
  once, as the element's `id` (1.23 MB → 1.06 MB; the page 2.95 → 2.60 MB).
- The reader stamps `data-json-ms` and `data-mount-ms` on
  `[data-xml-reader]`, the browser-side numbers the box cannot take.
- Front-matter elements inside an endorsement (`action`, `committee`,
  `sponsor`) are drawn as lines and no longer counted as unknown; a
  `p role="ellipsis"` (the lead's generic state front end) is set centred.

### Verified, on the box

- Type check over every touched TypeScript file: 0 diagnostics.
- `/api/typeset/uslm-parse?bill=2058568` and `?bill=2013923`: 200.
  `/workspace/dashboard`: 200, compiled.
- H.R. 6644 and H.R. 2289 (reported) measured against the Typeset HTML: 0
  rank violations on both; the Typeset HTML drops every text that closes a
  quoted amendment (90 and 13), caps clauses, subclauses and items at `h6`,
  and turns 1,216 and 280 headless levels into bold-led paragraphs. Warm
  pages: XML 274–593 ms, Typeset 285–658 ms. Full tables in `reader.md`.
- New York A11559 through `frontEndFor("NY")` and through the plain-text
  front end: both draw (810 paragraphs with `ins`/`del`; 152 generic levels).
  Checked as a script on the box, not in the page: New York is outside the
  free scope, so an anonymous curl gets the gate.

### For Brendan

- The stored text of New York A11559 is the Assembly's web page, navigation
  and all, not the bill. The reader draws what is stored; the acquisition is
  the pipeline's to fix.
- `sql/010_typeset_documents_prosemirror.sql` still waits for your word (see
  milestone 2).
- Browser numbers (JSON parsed, editor mounted) are on the reader's root as
  data attributes; typeset-perf's headless Chromium was not run, since the
  box has no browser and the Mac runs no local build.

### Files touched

- `apps/web/app/api/typeset/uslm-parse/route.ts`,
  `apps/web/components/admin/blocks/uslm-parse-card.tsx`,
  `apps/web/components/admin/pages/database.tsx`
- `apps/web/lib/xml/schema.ts`, `convert.ts`, `uslm-to-doc.ts`,
  `apps/web/lib/typeset/xml-document.ts`
- `apps/web/components/workspace/typeset-xml-reader.tsx`, `.css`
- `apps/web/docs/xml/reader.md`, `apps/web/docs/xml/window-1.md`
- `scripts/typeset/xml-reader-measure.mjs`

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
