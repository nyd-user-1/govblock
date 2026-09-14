# Window 4: the library and My Files — report

Report to the lead. Newest milestone first.

## Milestone 3 — the Library, families of law, the `/` command (2026-09-14)

### Built

- **The Library** at `/workspace/typeset/library`, and view 07 "Library" in
  Typeset's switcher on every bill (`/workspace/typeset/bill/<id>/library`).
  Libraries at the top level: 26 families of law and 52 jurisdictions. Inside
  one:

  | Path | What it lists |
  |---|---|
  | `agricultural-law` | the family's codes in every jurisdiction (364), with a jurisdiction menu; Sections and Bills of Congress beside |
  | `arkansas-agricultural-law` | the family in one state, its sections first |
  | `us-ny` | a jurisdiction: its constitution, codes, sessions and the families it has |
  | `us-ny/code/agm`, `us/usc/t10` | a code's sections |
  | `us-ny/const` | a constitution's sections |
  | `us-ny/bill/2025`, `us/bill/119` | a session's bills, with titles from `"Bills"` |

  Every list filters (a bill number filters by address, words search bill
  titles), sorts by address (natural: § 2 before § 10), newest or lowest
  coverage, and pages a hundred at a time. Coverage under 80% is marked.
  Every Work opens in the XML view at `/workspace/typeset/work/<address>`.
  Filters, views and sorts live in the URL, so a library is a link.
  `lib/xml/library-data.ts` resolves a path; `/api/typeset/library` serves
  the same listing as JSON for "More" and for the view inside a bill.
- **Families of law**, `lib/xml/families.ts`: 26 families as data, each a
  rule over code names, the US Code titles it takes, Congress's policy areas
  (which bring federal bills in) and codes named by hand. A code may sit in
  several. Agricultural Law holds 364 codes in 44 jurisdictions, 43,808
  sections.
- **The catalogue**, `xml_library` (sql/012, run): 26,082 rows, one per state
  code (25,134), US Code title (53), constitution (13) and bill session (882),
  filled by `scripts/xml/library.mjs` in 86 s. Kept in memory for an hour.
- **The `/` command** resolves through the address and the libraries, and
  every answer carries where Enter goes (`href`):

  | Typed | Enter opens | Listed |
  |---|---|---|
  | `/agricultural-law` | the family | its 40 largest codes |
  | `/arkansas-agricultural-law` | the family in Arkansas | Title 2, Agriculture |
  | `/new-york` | New York's library | its codes |
  | `/new-york-code`, `/us/usc` | the codes | each code |
  | `/119` | the 119th Congress's library | its bills, most recent action first |
  | `/us/usc/t10/s130i` | the Work in the XML view | the Work |
  | `/agriculture` | | codes whose names say so |
  | `/6644`, `/hr6644` | | bills by number (as before) |

  In ⌘K the library or Work is the first row. On the Library page the filter
  box is the door: type `/`, or press `/` anywhere on the page. On a bill's
  other Typeset views, `/` outside the editor's text opens ⌘K on `/`.

### Verified, on the box (3002)

Bounded type check over the 22 touched files and every importer of
`lib/typeset/views.ts`: 0 diagnostics.

| Request | Status | Time |
|---|---|---|
| `/workspace/typeset/library` | 200 | 10.6 s first (compile and catalogue), then cached |
| `/workspace/typeset/library/agricultural-law` | 200 | 5.0 s page; 3.1 s JSON |
| `…?path=agricultural-law&j=us-ca&show=sections&sort=newest` | 200 | 0.09 s, 100 of 9,661 |
| `…?path=arkansas-agricultural-law` | 200 | 0.11 s, 100 of 691 |
| `…?path=us-ny` (page) | 200 | 0.8 s |
| `…?path=us-ca/code/fac` | 200 | 0.25 s; coverage sort 0.9 s; page two 3.4 s |
| `…?path=us-ny/bill/2025` | 200 | 0.6 s, with titles; page two newest 0.25 s |
| `…?path=us/bill/119&q=housing` | 200 | 0.5 s, 100 bills by title |
| `…?path=us-ny/const` | 200 | 0.57 s, 202 sections |
| `…?path=agricultural-law&show=bills` | 200 | 0.67 s, 753 federal bills by policy area |
| `/workspace/typeset/library/new-york-code`, `/119` | 307 | to `us-ny/code`, `us/bill/119` |
| `/api/typeset/slash` on the eight queries above | 200 | 66–366 ms |
| `/workspace/typeset/bill/2058568/library` | 200 | 28.8 s first compile |

Found and fixed on the way:

- A family's sections across every jurisdiction in one statement took 46 s
  and was throttled once the cluster was busy. A family with no jurisdiction
  opens on its codes (from the catalogue). Its sections list per code, merged,
  up to 120 codes; past that, a jurisdiction at a time, and the page says so.
- A session's titles through a regular expression over the session's bills
  took 14.5 s; exact bill numbers with their zero-padded forms take 0.6 s.

### Done, against the brief

- Families as data: `lib/xml/families.ts`.
- The Library view (`library`, "Library") and page, browsing a family, a
  session and a state's code, filtering, sorting, loading a Work into the XML
  view: above.
- The `/` command in ⌘K, on the Library page, and on Typeset's bill views,
  resolving to a library or a Work: above. Window 1's stub message ("not built
  yet") is gone.
- My Files: the name and route settled in milestone 1; window 5 is making the
  rename.

### Open

- **Not looked at in a browser.** The Library page, the Work page, the `/` key
  on Typeset's views and ⌘K's first row compile and answer on 3002; the look
  is Brendan's.
- **Families are a first pass.** Iowa's codes are named "Chapter 1",
  "Chapter 154A", so no rule reaches them; `codes` in `families.ts` names them
  by hand. Rhode Island's and Illinois's libraries are chapters and acts, not
  titles. State bills join no family: `"Subjects"` is empty for New York 2025,
  so only federal bills come in, by policy area.
- **The catalogue is refreshed by hand.** `scripts/xml/library.mjs` belongs at
  the end of `scripts/xml/nightly.mjs`, which is window 2's file.
- **Titles miss where numbers do not pad plainly** (D.C.'s `B26-0123`), and a
  special session's titles can be taken from the regular session's bill of the
  same number.
- **The box clone holds this window's files uncommitted** (rsynced to compile).
  Before the clone pulls, they come out: `git -C ~/govblock-xml status` lists
  them.

### For Brendan

- `http://localhost:3002/workspace/typeset/library`,
  `…/library/agricultural-law`, `…/library/us-ny/code/agm`,
  `…/library/us/bill/119`, and a Work:
  `http://localhost:3002/workspace/typeset/work/us/usc/t10/s130i/a/1`
  (sections need a signed-in reader). Press `/` on the Library page.

### Files touched

- `apps/web/lib/xml/library-data.ts`, `apps/web/lib/xml/families.ts` (wired)
- `apps/web/app/api/typeset/library/route.ts`, `apps/web/app/workspace/typeset/library/[[...path]]/page.tsx`
- `apps/web/components/workspace/typeset-library.tsx`, `typeset-workspace-2.tsx` (the view), `apps/web/lib/typeset/views.ts`
- `apps/web/app/api/typeset/slash/route.ts`, `apps/web/components/slash-library.tsx`, `apps/web/components/command-menu.tsx`
- `apps/web/docs/xml/window-4.md`

## Milestone 2 — a Work loads in the XML view by its address (2026-09-14)

### Built

- **`/workspace/typeset/work/<address>`**, with `?at=YYYY-MM-DD` for the
  Expression in force on a date. The address may name an Expression
  (`/workspace/typeset/work/us-ny/code/agm/s3@2014-09-22`) or a portion below
  the Work (`…/us/usc/t10/s130i/a/1` opens the section at (a)(1)). The page
  paints the stored document as HTML, then the reader mounts the ProseMirror
  JSON. The rail holds the library the Work sits in and its DocHistory
  (printings for a bill, dates for a section). A bill's Work links to
  Typeset's own views of the bill ("Open in Typeset").
- **`lib/typeset/expression-document.ts`**, the name the lead fixed:
  `findExpression(address, at)` resolves an address to its stored row (a
  portion is tried a segment shorter at a time until a Work answers);
  `getExpressionDocument(row, portion)` reads the USLM from S3
  (`readUslm`), `parseXml` → `uslmToDoc` → `docToHtml` / `docToJson`, and
  returns the same shape `lib/typeset/xml-document.ts` gives a bill, keyed by
  address, kept in memory. `askOf(row)` is the entitlement: a printing as its
  bill, a section as the laws.
- **`GET /api/typeset/work?address=<address>[&at=]`**: the JSON the reader
  mounts, gated by `askOf`.
- **`TypesetXmlReader`** takes `jsonUrl` (instead of a bill) and `portion`
  (scrolled to on first paint and again once the editor mounts). `billId` is
  optional; the bill views pass it as before.
- **`components/workspace/typeset-frame.tsx`**: Typeset's card, rail, path
  bar, footer and customizer for pages that open no bill. The Library uses it
  next. `lib/xml/library.ts`: `LIBRARY_ROOT`, `WORK_ROOT`, `workHref`,
  `libraryHref`, jurisdiction names, a Work's prefix and its label.
- `lib/xml/address.ts` exports `STATE_NAMES`.

### For window 5

Key the true fork of a statute by the Work's address and link to it with
`workHref(address)` from `lib/xml/library.ts`. `findExpression` and
`getExpressionDocument` are the load; `ExpressionDocument.history` is the
Work's DocHistory, oldest first.

### Verified

On the box, 3002, anonymous:

| Request | Status | Time | Size |
|---|---|---|---|
| `/api/typeset/work?address=/us/bill/119/hr/6644` | 200 | 0.9 s | 1.27 MB JSON |
| `/workspace/typeset/work/us/bill/119/hr/6644` | 200 | 0.5–2.3 s warm | 1.76–3.05 MB, 1,626 identifiers, rail and "Open in Typeset" drawn |
| `/workspace/typeset/work/us/usc/t10/s130i/a/1` | 200 | 0.7 s | the sign-in note: laws are gated for anonymous readers |
| `/api/typeset/work?address=/us/usc/t10/s130i` | 403 | | "Sign in to open laws." |

Sections are gated, so their build was checked as a script on the Mac over
the same path (S3, `parseXml`, `uslmToDoc`, HTML and JSON), bundled from
`lib/xml`:

| Expression | Nodes | Violations | Unknown | Read / doc / HTML |
|---|---|---|---|---|
| `/us-ny/code/agm/s3@2014-09-22` | section, p | 0 | 0 | 144 / 4 / 4 ms |
| `/us-ca/code/fac/s1@2026-09-11` | section, 2 p | 0 | 0 | 70 / 1 / 1 ms |
| `/us/usc/t10/s130i@2026-04-17` (native) | 14 subsections, 34 paragraphs, 39 subparagraphs, 6 clauses; 105 identifiers | 0 | 0 | 86 / 20 / 13 ms |
| `/us-ny/const/artI/s11@2025-01-10` | section, p | 0 | 0 | 47 / 0 / 0 ms |
| `/us-tx/code/bc/s73.005@2026-09-12` | section, 3 subsections | 0 | 0 | 133 / 1 / 1 ms |
| `/us-ar/code/t24/s24-11-811@2026-09-13` | section, 2 subsections | 0 | 0 | 61 / 1 / 1 ms |
| `/us-ny/bill/2025/s/7721@2026-05-14_a` | 3 sections, 12 clauses, 1 quotedContent | 0 | 0 | 67 / 2 / 2 ms |

Bounded type check over the touched files: 0 diagnostics.

Fixed on the way: the frame's customizer needs `TypesetHistoryProvider`; the
page wraps it as the bill page does.

### Next, and the DDL, announced before it runs

- **`sql/012_library.sql`, additive, to run next** (numbered 012 because
  window 5 holds 011):
  - a new table, `xml_library`: one row per library that is a prefix of
    addresses (a state's code, a US Code title, a constitution, a session of
    bills), with its name, Works, Expressions, coverage and dates;
  - one index, `expressions (jurisdiction, kind, split_part(work, '/', 4), work)`,
    built `concurrently`. Listing one code's sections (California's Food and
    Agricultural Code) read all 161,426 California sections without it, 5.7 s.

  No other change to the cluster; nothing the site reads is touched.
- `scripts/xml/library.mjs` fills `xml_library`, a jurisdiction per
  transaction. A first run written to a JSON file came to 3.5 MB (52
  jurisdictions, 25,000 codes, 154 s); bundled into the app's server routes
  that risks Amplify's 220 MB output cap, so the catalogue lives in the table.
- `lib/xml/families.ts`: 26 families of law as data (law-name rules, US Code
  titles, Congress's policy areas, hand-named codes).
- Then the Library view and page, and the `/` command.

### Files touched

- `apps/web/lib/typeset/expression-document.ts`, `apps/web/app/api/typeset/work/route.ts`
- `apps/web/app/workspace/typeset/work/[...address]/page.tsx`
- `apps/web/components/workspace/typeset-work.tsx`, `typeset-frame.tsx`, `typeset-xml-reader.tsx`
- `apps/web/lib/xml/library.ts`, `apps/web/lib/xml/address.ts`
- `apps/web/docs/xml/window-4.md`

## Milestone 1 — My Files: the name and the route, settled (2026-09-14)

Settled first so window 5 can build the rename on it. Window 5 makes the
change; this window leaves those files alone so the two do not collide.

### The name

**My Files**, everywhere a reader sees the folder:

| Where | Today | Becomes |
|---|---|---|
| The data root's folder list, `ROOT_FOLDERS` in `lib/create/path.ts` | "Your forks" | "My Files" |
| The path bar crumb, `components/create/designer.tsx` (`case "forks"`) | "Your forks" | "My Files" |
| The folder's column heads, `components/create/folder-view.tsx` (`case "forks"`) | "Forked from", "Forked" | "Copied from", "Created" (a Duplicate to edit is a copy; window 5's true fork can show "Forked from" on its own rows) |
| Page titles and any `aria-label` naming the folder | "Forks" | "My Files" |

"Duplicate to edit" keeps its name: it is the act, and My Files is where it
lands.

### The route

- The path segment is **`my-files`**:
  `/workspace/data/<state>/<chamber>/<year>/my-files`, and `at=my-files` in
  the `/create` query form.
- `forks` stays a parsed alias of the same folder
  (`lib/workspace/path.ts` `parseWorkspacePath`, `lib/create/path.ts`
  `locate`), so links already out resolve. `buildWorkspacePath` writes
  `my-files`.
- `lib/entitlements.ts` treats `my-files` as it treats `forks` today
  (entity `account`).

### What keeps its name

- The node kind stays `forks` in code (`Node`, `useFolder`, `columnsFor`),
  and the tables stay `Forks` and `Commits`, as the brief says. Nothing a
  reader sees carries either.
- `/api/policy/forks` and `/api/policy/commits` are unchanged.

### The seam for the true fork

My Files lists rows by `record.kind`. Duplicate to edit rows are
`record.kind === "fork"` today. Window 5's true fork of a published statute
lands as its own `record.kind` in the same listing, keyed by the Work's
address (`/us-ny/code/agm/s3`) rather than a `bill_id`, so a fork of a
statute needs no bill row.

### Files touched

- `apps/web/docs/xml/window-4.md`
