# Legislative XML program: Typeset on ProseMirror, GitHub for the law

Brendan, 2026-09-14. The program brief. Every window brief under it points
here for the decisions, the contract, the word map and the rules, and carries
only its own scope. Read this first, then your window's brief, then verify
every file pointer against the repo before trusting it. The lead agent for the
night shift is the session that wrote this; report to it as the briefs say.

## The product

GovBlock is GitHub for the law, for the average person. A reader opens a bill
or a statute and reads it rendered from its real structure. A reader forks a
published statute, a section of the New York Agriculture and Markets Law, a
subsection of 10 U.S.C. 130i, into their own space, edits it as a document,
and gets the amendment and the redline out the other side. The corpus is
every bill and statute across the fifty states, D.C. and Congress, already
ingested. The editor holds one document at a time; corpus scale is a
retrieval problem, not an editor problem.

## How it came about

Unifying Typeset's surfaces, the editor, the outline, the redline, Git and
the diff, into one interface was slow. TipTap turned out to be in the tree
already, and ProseMirror turned out to fit legislative text better than
Slate. The statutes of all fifty states had just landed. The nightly
ingestion, meant to run every night, needed revisiting anyway. The
structure-aware diff needed a grammar for law, and legislative XML is that
grammar, already written. The pipeline already pulls every state's bills as
HTML and PDF into S3, so converting them is the next step, and the states'
quirks are an opportunity to impose the federal standard over all of them.
From there: real forks of real statutes, an amendment engine, a better
existing product, an XML stream the states will need, and converters every
which way. It is a compiler.

## The compiler

Every jurisdiction publishes law in its own surface syntax: how it signals a
section, its numbering habits, its structural furniture. USLM over the Akoma
Ntoso base is the intermediate representation, the one abstract form they
all compile into. Fifty front ends, one back end. A parser per jurisdiction
lifts that jurisdiction's surface text into the IR; the reader, the diff,
the amendment engine and every converter operate on the IR and never on raw
text. Akoma Ntoso was built for this: a general hierarchy vocabulary and a
generic `hcontainer` with a `name` attribute as the escape hatch for any unit
a state has that the standard does not name. USLM is the federal profile of
that base; each state's profile is another profile of the same grammar,
derived empirically from the corpus already ingested, and refined as the
long tail shows up: tables, embedded quoted amendments, historical
formatting, odd numbering. A grammar is never finished; it has a coverage
number, the share of a jurisdiction's text that parses cleanly into it, and
that measured number is the jurisdiction's fidelity tier.

Two names the grammar needs, since amendments edit them separately: the
**chapeau** is the introductory line that sits over an enumerated list ("The
Congress declares that it is essential—"), and the **continuation**, or
flush language, is the text after or between the items. USLM tags them
`chapeau` and `continuation`; Akoma Ntoso calls them `intro` and `wrapUp`.

## The goal for the night, and the floor

By morning: an XML Expression of every bill of the last twenty years and of
every state's statutes and code, browsable, filterable and sortable in
Typeset, any one of them selectable and loaded. If the corpus does not
finish in the window, the floor is a working pipeline Brendan controls from
a dashboard: pick the jurisdictions and sessions not yet done and run them
through the compiler, with progress visible. Nobody stops at "migration
written". Brendan, 2026-09-14: "go further, go all the way"; the production
cluster is authorized for this program's DDL and loads, tonight, without
further asking. The window is four hours, six at most. Use as many windows
and as many boxes as the job needs; the lead session spawns windows and
provisions boxes.

## Decisions, locked

1. **Typeset moves off Plate and Potion to ProseMirror, by way of Tiptap.**
   Fit, not speed: a legislative document must map one to one onto
   legislative XML, enforce its hierarchy as a hard schema rule, carry
   structure-aware amendment diffs, and take advisory overlays that never
   touch the document. ProseMirror's schema, step model and decorations do
   that; Slate does not. Tiptap for the React bindings and command
   ergonomics; drop to raw ProseMirror plugins wherever the schema gets
   legal-specific. The fourteen TipTap and ProseMirror packages in
   `apps/web/package.json` stay and are the base; the inbox composer at
   `registry/blocks/sidebar-09/components/rich-body.tsx` already uses them,
   so pin before upgrading. Plate and Potion come out only after the new
   reader reaches parity, and not on the night shift.
2. **The schema is USLM. Nobody invents one.** United States Legislative
   Markup, the GPO's XML for federal bills and the US Code, a derivative of
   Akoma Ntoso (OASIS LegalDocML). Node types mirror USLM's element set, taken
   from the schema, not typed from memory. Akoma Ntoso is the superset to
   grow into. Read first: https://github.com/usgpo/uslm (USLM-User-Guide.md)
   and https://docs.oasis-open.org/legaldocml/akn-core/v1.0/akn-core-v1.0-part1-vocabulary.html
3. **The contract between windows is a USLM document, not anyone's code.**
   The pipeline emits USLM per expression; the reader parses USLM; the fork
   engine diffs USLM-shaped trees. Both sides target the standard, so the
   reader and the pipeline run in parallel, and the pipeline's output is the
   sellable XML stream with no second format.
4. **The reader ships first, federal first, beside the Plate reader**, on the
   feature branch, and nothing is torn out until parity.
5. **Forks are real forks of published law, owned by the reader, and never
   appear in the official record.** Today's "fork" is Duplicate to edit
   (Figma's word), saved in the reader's own Forks folder. The first model,
   a reader's commits listed under the bill's official versions, is gone and
   not coming back; the Changes tab still draws "proposed versions" under
   official ones with a toggle to hide them, and that rendering is removed
   in the fork window. The official record's version list is BillHistory
   and printings only.
6. **Federal is native USLM and renders faithfully. Most states are scraped
   HTML and PDF.** Per-jurisdiction fidelity varies and is recorded, and the
   acquisition review per jurisdiction is the real data work behind the XML
   product. Nothing in a brief may claim the XML reader fixes state
   rendering on its own; that is the pipeline's job.
7. **One converter library, from the IR to every format.** `lib/xml/` in
   the app, importable by scripts: IR to HTML (the reader's first-paint
   snapshot is this converter), Markdown, plain text, PDF, and XML out; and
   the front ends the other way. Nothing converts text to text; everything
   passes through the IR.
8. **The pipeline runs nightly and the dashboard watches it.** Ingestion is
   meant to run every night; the scheduled run today is the worker box's
   nightly manifest in the livingston repo (`ops/box/jobs.d/`), and this
   repo's `ops/refresh-matviews.sh` is its by-hand twin. The XML step joins
   that run, and the Data Pipeline dashboard shows last night's run per
   jurisdiction: what parsed, coverage, what fell out.
9. **Sources are what is already stored.** Scraped bill text sits in S3:
   `govblock-lake-638175140432` under `lake/v1/text/bill_texts`, and
   `livingston-bill-pdfs-638175140432` for PDFs. Front ends read from there
   and from Aurora; nothing re-scrapes to convert.
10. **XML documents live in S3; Aurora holds the index.** The Data API moves
    a megabyte at a time, so millions of documents cannot pass through it.
    Each Expression's USLM is an object in `govblock-lake-638175140432` under
    `lake/v1/xml/<jurisdiction>/<work-address>/<expression-date>.xml` (gzip
    at rest), and an `expressions` table in Aurora holds one row per
    object: the Work address, the date, the kind (bill printing, statute
    section), the jurisdiction, the session, the fidelity tier and measured
    coverage, the source URL, the S3 key, the content hash, bytes, and the
    builder version. The reader reads S3 through the app; `typeset_documents`
    stays as the reader's cache. The sellable stream is the S3 prefix.
11. **The Forks folder is "My Files".** Duplicate to edit is not a fork, so
    the reader's sidebar folder that holds their copies is renamed; a true
    fork of a published statute arrives with the fork window and lives
    there too. No public proposals surface tonight; that is a line Brendan
    can look at later and ask to drop.
12. **Libraries by family of law.** As Python has libraries and a design
    project has a design library, the corpus organizes into libraries a
    reader opens and loads from: the Agricultural Law Library, the Housing
    Law Library, a session, a state's code, a constitution. Sections overlap
    across families and are distinct within them; the library is how a
    reader browses, filters and sorts, then selects one Work and loads it in
    Typeset. The `/` command is the keyboard door to the same libraries.
13. **The compiler has a surface and the project has a dashboard.** Under
    `/workspace/dashboard`: a Compiler page, the fifty front ends as a grid
    with each jurisdiction's profile, measured coverage, the units it does
    not name yet and sample fall-outs, with the grammar catalogue readable;
    and a Legislative XML page, the program's own dashboard: expressions
    stored by jurisdiction, kind and session, the queue with run controls,
    last night's run, and each window's report.
14. Prior art is not the model. The fork edit page that commits an edited
   copy to a reader's fork already exists in this codebase; the amendment
   engine derives instructions from an edited copy because that is how this
   product already works, not because anyone else did it.

## The windows

| Window | Brief | Owns | Starts |
|---|---|---|---|
| 1 Reader | `2026-09-14-typeset-xml-reader.md` | schema, address, `uslmToDoc`, `lib/xml/` converters, the XML view, the parse tile | now (Brendan opens it) |
| 2 Pipeline | `2026-09-14-xml-pipeline.md` | `expressions` DDL, S3 store, the run queue and shards, federal and state loads, the Legislative XML dashboard | now (Brendan opens it) |
| 3 Grammars and the Compiler surface | `2026-09-14-grammars-and-compiler.md` | one front end per jurisdiction, coverage measurement, the Compiler page | now (the lead spawns it) |
| 4 Library and My Files | `2026-09-14-library.md` | libraries by family, browse/filter/sort/load in Typeset, the `/` command, the My Files rename | when window 1 has written the address (its first hour) |
| 5 Fork and amend | `2026-09-14-fork-and-amend.md` | the true fork, the engine, the Fork view, the proposed-versions removal | when 1 and 2 report done |
| 6 Citations and context | `2026-09-14-citations-and-context.md` | `@`, decorations, the in-context view | when 5 reports done |

Three to four run at once. The lead reads each report as it lands, reviews
the diff on the branch, rules on every question in a report, spawns the
next window, and provisions a second box when a window's measured
throughput says the corpus will not finish on one. Windows 3 and 2 hand
each other work through files on the branch: window 3's front ends are
`lib/xml/frontends/<jurisdiction>.ts` with a coverage line each in
`lib/xml/coverage.generated.json`; window 2 runs whatever front ends exist
and reads that file for its dashboard.

## The contract, precisely

- A **Work** is a law or bill as it persists: one US Code section, one New
  York statute location, one bill. An **Expression** is that Work's text at a
  point in time: a printing of a bill, a statute as it stood on a date, a
  reader's commit in a fork. A **Manifestation** is a format of an
  Expression: USLM, HTML, PDF, the reader's ProseMirror JSON.
- Every Expression the pipeline produces is one USLM document in S3 with a
  row in `expressions` (decision 10), keyed by the Work's address and the
  Expression's date, with its source fidelity tier (native XML, structured
  HTML, plain text, PDF), its measured coverage and the source URL.
- Addresses follow Akoma Ntoso's URI convention so the `/` command and the
  `@` resolver share one naming: a session, a code, a title, a section. The
  reader window designs the address; the pipeline window stores by it.
- The reader accepts USLM only. Until the pipeline delivers a jurisdiction,
  the reader falls back to the plain-text path for that jurisdiction, and
  says so in the page, so a state bill never renders as nothing.

## Word map: what the code calls things already

| In the code | Where | In the program's terms |
|---|---|---|
| a printing, `BillTexts.version` ("Introduced", "Amendment A") | `lib/policy/bill-compare.ts` | a published Expression of a bill Work |
| `Documents.url` (.xml, .pdf, .htm) | `lib/policy/bill-uslm.ts` `fetchUslm` | a Manifestation pointer |
| `congress_text_formats.xml_url` per version | `lib/policy/db-queries.ts` | the federal USLM Manifestation of a printing |
| `Laws` row, one per `location_id`, upserted | `scripts/laws/lib/db.mjs` | the current Expression of a statute Work, dates but no prior text |
| a commit, `Commits.text` with a parent document or commit | `app/api/policy/commits/route.ts` | a fork Expression, DocHistory |
| a fork, `Forks`, one per reader per bill | `app/api/policy/forks/route.ts` | Duplicate to edit; the seed of the real fork |
| an action, `History Table`, the Actions aside | `components/workspace/typeset-actions-aside.tsx` | a BillHistory event; never a version |
| `typeset_documents` (HTML, Slate value, snapshot) | `sql/004_typeset_documents.sql` | a cached Manifestation; gains a ProseMirror form |
| a session | everywhere | the legislature's session; never a document term |

"Version" and "history" are never written unqualified. BillHistory is the
legislative lifecycle. DocHistory is a document's expressions.

## What exists, by file

- Reader today: `components/workspace/typeset-editor.tsx`,
  `components/workspace/typeset-workspace-2.tsx`, `lib/typeset/views.ts`
  (the six views and their routes), `lib/typeset/document.ts`
  (`getTypesetDocument`, the server snapshot), `lib/typeset/document-store.ts`,
  `app/api/typeset/content/route.ts`,
  `app/workspace/typeset/bill/[id]/[[...view]]/page.tsx`,
  `components/plate/editor/bill-kit.tsx`, `apps/web/docs/typeset-perf.md`.
- USLM: `lib/policy/bill-uslm.ts` parses USLM into a tag tree (`parseXml`),
  knows every level (division through subsubitem), quoted blocks, tables of
  contents, attestations, and `external-xref` with `parsable-cite`; structure
  is lost only in `render`, where the tree becomes headings and paragraphs.
  Plain-text heuristics for everything without XML are in `plainTextHtml`.
- Ingestion: `scripts/laws/load.mjs` and 53 adapters under
  `scripts/laws/adapters/` (`us.mjs` reads the US Code as USLM from the
  OLRC release point); `scripts/laws/lib/xml.mjs`; congress loaders under
  `scripts/`; the Data Pipeline dashboard is `components/admin/pages/database.tsx`
  at `/workspace/dashboard`.
- The git layer: `components/create/file-view.tsx` (Duplicate to edit),
  `bill-edit.tsx` (GitHub's edit page, commit to the fork), `bill-changes.tsx`
  (the commit page, versions as files changed, and the fork rendering to
  remove), `bill-history.tsx` (versions and actions on one rail),
  `components/policy/diff-view.tsx` (GitHub's diff, measured),
  `components/bill-compare.tsx` and `lib/policy/bill-compare.ts` (the animated
  redline of printings, line-based), `lib/policy/line-diff.ts`.
- Plate: `components/plate/**` (the template's kits and UI, 24,000 lines).
  Untouched until parity.

## Rules (GovBlock specifics, obey them)

- The dev server is on an **EC2 box**, `localhost:3001` through an SSH
  tunnel; a dead tunnel usually means a stopped box, and `~/bin/govblock-dev-up`
  restarts it. The box stops itself after an hour idle. Its checkout is
  `~/govblock`, on `main`.
- **The branch gets its own clone on the box.** One checkout cannot serve two
  branches. Clone to `~/govblock-xml`, check out the feature branch there,
  run its dev server on port 3002, and tunnel 3002. The `main` server on 3000
  stays as it is. The first window to need the box makes the clone and
  records the commands in its report.
- No local production builds; Amplify builds `main` from GitHub and never the
  branch. **Type-check changed files only** with a bounded `ts.createProgram`
  script under a 2 GB cap; a whole-project type check and any lint command
  are blocked by a hook, and the hook reads the whole command text, so do
  not even name those tools in a shell command.
- **One shell command at a time. No background watchers, no parallel tool
  calls, no subagents.**
- **The production cluster is authorized for this program tonight**
  (Brendan, 2026-09-14, "go all the way"): additive DDL under `sql/`, the
  `expressions` index, the loads. Never a drop, never a change to an
  existing table's columns, never a write to the tables the site reads
  (`Bills`, `BillTexts`, `Laws`, `People`, `Committees`) beyond what the
  loaders already do. Keep every migration in `sql/` so it can be read
  later.
- Touch only your own files. Several windows share this checkout on the
  branch; stage by path (`git add <your files>`), never `git add -A` or
  `git commit -a`, and pull with rebase before pushing. The tree is clean as
  of commit 29783ee; the branch is cut from `main` there.
- Every window commits its own work to the feature branch, never to `main`,
  with a message that says what and why, and writes a report to
  `apps/web/docs/xml/<window>.md` at every milestone, not only at the end:
  what was built, how it was verified, measured throughput where there is
  one, what is open, which files were touched. The lead reads the report
  and the diff. A question for Brendan goes in the report under "For
  Brendan"; the lead answers what it can and the rest waits for morning.
- The box stops itself after an hour with no dev-server traffic. The first
  window on the box stops that timer for the shift
  (`sudo systemctl stop govblock-idle.timer`) and says so in its report; the
  lead restarts the timer when the shift ends. Long runs on the box go
  under `nohup` with a log under `~/govblock-xml/logs/`, never in a
  foreground shell that a dropped tunnel would kill.
- Third person in anything a reader sees. The product never says "I" or
  "we" and never names the model.

## The branch

`feature/legislative-xml`, from `main` at 29783ee. All four windows commit
there. Merge to `main` is Brendan's call after parity.
