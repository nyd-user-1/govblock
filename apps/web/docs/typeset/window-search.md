# Window typeset-search — report

Report to the lead (govblock-93). Newest milestone first.

## State of the items

1. Search: done, a7f1e22 and fe0043e.
2. Comments that save: next.
3. ⌘J and Ask AI: not started.
4. A section sidebar for the Library: not started.

## Milestone 1 — search (2026-09-15)

### A bill number finds the bill first

`searchAll` in `lib/policy/db-queries.ts` (⌘K, `/search`, the file row's
session and all scopes). "6644" made the number pattern `6644%`, which never
prefixes `HB6644`, so only titles matched and H.Res. 1299 (its title names
H.R. 6644) came first. A term that reads as a bill number now matches the
number exactly past the letters and the zero padding (`A06644`), and that match
sorts first in both tiers. Congress is stored in LegiScan's letters (H.R. is
`HB`, H.Res. is `HR`), so typed federal letters are translated for Congress's
rows only.

| Typed, scope US | First rows |
|---|---|
| `6644` | H.R. 6644, H.Res. 1299, N.Y. S06644 |
| `HR 6644`, `hr6644` | H.R. 6644 |
| `H.R. 6644` | H.R. 6644, H.Res. 1299 |
| `hres1299` | H.Res. 1299 |
| `climate` | unchanged: titles |

In New York's scope `6644` gives S06644 and A06644, then H.R. 6644; `S 1234`
gives S01234 first. 300–830 ms against Aurora; on 3001,
`/api/policy/search?q=6644&state=US&all=1` returns HB6644 first.

### The law, by citation and by heading

`lib/typeset/find.ts` and `GET /api/typeset/find?q=&jurisdiction=&within=`.
What was typed is read three ways, each ending on a Work the `expressions`
index holds, looked up by `work = any(...)` on the address index:

- **An address or a citation**: `/us/usc/t10/s130i`, "7 USC 1", "§ 16 of the
  Agriculture and Markets law", through window 6's recognizer (`cite.ts`).
- **A code named and a number**: "agriculture and markets 16", "penal law
  125.25", matched against the catalogue's code names (`xml_library`).
- **Words in a section's heading**: "any section about milk pricing", on
  `"Laws".title`'s trigram index, each row mapped to the address
  `scripts/xml/sources/statutes.mjs` stored it under (the plain address, or
  under its container where a number restarts).

A citation that lands is the answer; words are read as a heading only when
nothing was named. Every answer carries its heading from `"Laws"`, and opens
through `workHref`, so the address scheme typeset-editor is moving to carries
over. Open to every reader, as the Library is; the gate stays on the Work.

No DDL. Full text was measured and left out: `"Laws".tsv` already indexes
headings (weight A) and text (weight B), but a heading-only query on it
rechecks every row whose text holds the word, and "health" took 45 s.
Headings on the trigram index take 6 ms ("milk"), 246 ms ("health"), 1.2 s
("definitions").

| On 3001, `jurisdiction=us-ny` | Answer |
|---|---|
| `7 USC 1` | 7 U.S.C. 1, Short title → `/workspace/typeset/statute/us/usc/t7/s1` (200) |
| `Agriculture and Markets 16` | Agriculture & Markets § 16, General powers and duties of department → `…/statute/us-ny/agm/s16` (200); Vermont's Agriculture, Food and Markets § 16 second |
| `any section about milk pricing` | 14 sections: General Business § 396-RR (Price gouging; milk), Agriculture & Markets § 258-M, 7 U.S.C. 7251, Maine, Connecticut… |
| `milk`, `within=/us-ny/code/agm` | Agriculture & Markets § 51 Milk inspection, § 252 Division of milk control… (0.23 s) |
| `penal law 125.25` (script) | Penal § 125.25, Murder in the second degree |

The first request after a server start pays 4–7 s to load the catalogue, which
stays in memory for an hour, as the `/` command's does.

### Where a reader meets it

- **The reader's search box** (`components/policy/file-row.tsx`): a fourth
  scope, `law:all`, "Search the law", on every view that wears the row,
  Git's pane included. Its answers list in the Results panel with their
  heading and jurisdiction; a click opens the Work.
- **The Library** (`typeset-library.tsx`): the filter box asks the route as
  typing pauses or on Enter, bounded by the library it is in (a code, a
  jurisdiction, or everywhere from a family or the top), and the sections it
  finds list above the library's own rows. Nothing is asked when the page
  loads, even with `?q=` in the address.

### Verified

- Bounded type check over the six touched or dependent files: 0 diagnostics.
- The queries above, against Aurora from the Mac (bundled `searchAll` and
  `findLaw` over the Data API) and on 3001 through the routes.
- `/workspace/typeset/library` and `/workspace/typeset/library/us-ny/code/agm`
  answer 200 on 3001. Not looked at in a browser.

### Open

- The scope and the Library's list are not yet seen in a browser.
- Headings match words, lightly stemmed ("pricing" finds "prices"); a section
  whose heading does not say what it is about is not found. The text search
  needs its own index (a heading-only tsvector column or a GIN on
  `to_tsvector('english', title)`), additive, if the lead wants it later.
- ⌘K does not list sections of law; the brief puts that search on the Library
  and the reader's box.

### Files

- `apps/web/lib/policy/db-queries.ts` (`searchAll`)
- `apps/web/lib/typeset/find.ts`, `apps/web/app/api/typeset/find/route.ts`
- `apps/web/components/policy/file-row.tsx` (the search half only)
- `apps/web/components/workspace/typeset-library.tsx`
- `apps/web/docs/typeset/window-search.md`
