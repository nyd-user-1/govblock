# Window 2: the legislative XML pipeline, versioned by date

Brendan, 2026-09-14. Read `2026-09-14-legislative-xml-program.md` first. This
brief is your scope only. Verify every file pointer before trusting it. This
window runs in parallel with the reader; the contract between you is USLM,
not the reader's code.

## The order for tonight

Brendan, 2026-09-14: "go further, go all the way." The goal is an XML
Expression of every bill of the last twenty years and every state's
statutes and code by morning; the floor is a working pipeline he controls
from the dashboard that takes what is left and runs it through the
compiler. The production cluster is authorized: additive DDL and loads,
tonight, no further asking. Nothing here stops at a migration.

## What this window is

The compiler's front ends and its store. Every jurisdiction lands in one
structured model: a USLM document per Expression, dated, with its measured
fidelity recorded, stored so the reader can open it and so it can be
exported as a first-class artifact. This is a product line, not plumbing.
GovBlock adheres to the federal standard and produces a clean XML stream for
jurisdictions that publish none; states are being pushed toward
machine-readable law, and the stream is what gets them there.

The first task is not "convert to XML". It is **derive each jurisdiction's
grammar against the IR from the corpus already ingested, and report coverage
per jurisdiction.** A grammar is the catalogue of how that jurisdiction
signals each structural unit, mapped to USLM elements and to `hcontainer`
with a name where USLM has no element; coverage is the share of the
jurisdiction's text that parses cleanly through it. That table, fifty
grammars with measured coverage, is the artifact nobody else has.

## What exists, verified

- `scripts/laws/load.mjs` and 53 adapters under `scripts/laws/adapters/`.
  `us.mjs` reads the US Code as native USLM from the OLRC release point and
  keeps a section's own content and source credit. State adapters read HTML
  and PDF by jurisdiction; `scripts/laws/lib/xml.mjs` and `lexis.mjs` are the
  helpers.
- `Laws` is one row per `location_id`, upserted: `active_date`,
  `repealed_date`, `repealed`, `text`, `parent_location_id`, `sequence_no`,
  `depth`. Dates exist; prior text does not. Confirm that first.
- Federal bills: `congress_text_formats.xml_url` per printing, and
  `Documents.url` ending in `.xml`, both GovInfo USLM. `BillTexts` holds
  fetched text per document.
- `lib/policy/bill-uslm.ts` parses USLM (`parseXml`); the reader window
  builds on it. Your emitters produce USLM; you may use the same tree code
  to validate what you emit.
- Storage pattern for large blobs over the Data API: `sql/004_typeset_documents.sql`
  and `lib/typeset/document-store.ts` (gzipped, base64 slices under 1 MB, a
  builder column, a row marked complete only once every slice is in).

## Scope

0. **The grammars are window 3's.** It writes one front end per
   jurisdiction to `lib/xml/frontends/<jurisdiction>.ts` and a coverage line
   each to `lib/xml/coverage.generated.json`, starting with federal (native
   USLM, a pass-through with validation) and New York. Run whatever front
   ends exist; read the coverage file for the dashboard; do not write
   grammars here. Sources are what is stored: Aurora `Laws`, `BillTexts`,
   `Documents.url`, `congress_text_formats.xml_url`; S3
   `govblock-lake-638175140432` under `lake/v1/text/bill_texts` and
   `livingston-bill-pdfs-638175140432`. Nothing re-scrapes.
1. **The store, tonight.** The `expressions` index table from the program
   brief (decision 10), written under `sql/` and run on the cluster; the
   USLM objects in S3 under `lake/v1/xml/`. Keep the migration readable for
   the morning. Until window 1 has published the address scheme in
   `apps/web/docs/xml/schema.md` (its first hour), key rows by a provisional
   address you can rewrite in place: `{jurisdiction}/{kind}/{native id}`.
2. **The run queue and the shards.** A job is one jurisdiction and one
   session (bills) or one jurisdiction and one code title (statutes). A
   controller under `scripts/xml/` (or `lib/xml/run.ts` invoked by a script)
   takes a job, pulls its sources, runs the front end, validates against the
   schema, writes the object and the row, and records what fell out. Shard
   by job across a worker pool sized to the box (8 vCPU on the dev box; run
   under `nohup` with a log). Measure throughput in the first thirty minutes
   and put the projection in your report: documents per minute, the
   corpus's size, the finish time on one box. If the projection passes the
   window, say so at once; the lead provisions a second box.
3. **The loads, in this order.** Federal bills, newest session backward for
   twenty years, from their USLM (native, fast, the proof of the whole
   thing); the US Code by title from `Laws`; New York statutes from `Laws`;
   then every other state's statutes from `Laws` through whatever front end
   window 3 has published, marking coverage; then state bills by session,
   newest first, through the same front ends. A jurisdiction with no front
   end yet is queued, not skipped, and the queue shows it.
4. **Point in time.** `expressionAt(work, date)`: the Expression in force on
   a date, from the dated rows. Design how a new fetch becomes a new
   Expression rather than an overwrite, and how the existing upsert into
   `Laws` keeps working beside it.
5. **The converters are window 1's** (`lib/xml/`); import them, do not
   write them.
5b. **Export.** A route under `app/api/xml/` that returns an Expression as USLM,
   gated as datasets are (`lib/entitlements.ts`, entity `datasets`), with the
   right content type, so the stream is a real artifact from day one.
6. **The Legislative XML dashboard, the project's own.** A new page under
   `/workspace/dashboard` (`components/admin/pages/xml.tsx`, registered in
   `components/admin/pages/index.tsx` beside Data Pipeline): expressions
   stored by jurisdiction, kind and session; the queue, with what is done,
   running, waiting and failed; run controls that enqueue a jurisdiction
   and its sessions or titles and show progress as it goes; coverage per
   jurisdiction from window 3's file; last night's run; and each window's
   report rendered from `apps/web/docs/xml/`. This is the floor Brendan
   named: if the corpus is not finished by morning, this page is how he
   finishes it. The run controls call a route under `app/api/xml/` that
   writes to the queue the controller reads; the controller runs on the box.
   Find where the nightly ingestion is scheduled today (the worker box's
   manifest under livingston `ops/box/jobs.d/`; this repo's
   `ops/refresh-matviews.sh` is its by-hand twin), write the job definition
   the XML step adds to that run, and say in the report what it needs.
7. **The acquisition review** is window 3's (`apps/web/docs/xml/sources.md`);
   feed it what the loads learn: which sources failed, which fell out most.

## Not in scope

The editor, forks, amendments, citations, the grammars themselves, the
converters, drops or changes to existing tables.

## Done means

The `expressions` table exists and the S3 prefix fills: every federal bill
of the last twenty years, the US Code, New York's statutes, then every
state through the front ends that exist, with the rest queued and visible;
`expressionAt` answers for a dated Work; the export route returns USLM; the
Legislative XML dashboard shows the store, the queue, the coverage and the
reports, and its run controls work; throughput and the projection are in
the report from the first half hour on. Report at
`apps/web/docs/xml/window-2.md`, updated at every milestone.
Committed on the branch. Report at `apps/web/docs/xml/window-2.md`.
