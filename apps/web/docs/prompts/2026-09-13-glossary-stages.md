# Glossary: the stages of a bill, for every jurisdiction

Brendan, 2026-09-13, handed to typeset-perf by the former lead. This comes
ahead of the editor work: land the perf step in flight, then do this, then
return to the editor. Do exactly what is listed and nothing else. No
cleanup, no rewording of what is already on the page, no captions, no
"how to read this" text, no extra sections. Brendan's rules: one shell
command at a time, nothing in the background, no subagents, no parallel tool
calls. Do not start, stop or restart the dev box or its server. He reviews on
`localhost:3001` in his own browser; stop at "the page compiles".

## The page

`app/glossary/page.tsx`, with `app/glossary/status-views.tsx` (a client
component: animate-ui tabs, Table first and List second, both inside the
surface block `TableBlock` with its copy button). Today it has: the
definition of "action"; a comparison table with columns here / Congress.gov
/ New York / LegiScan; a Congress section with the ten action `type` values
in a plain table; a New York section with the fifteen `statusType` values in
the tabbed block; a LegiScan section.

Only these two files change, plus nothing else in the repo.

## The four things to do

1. **Remove LegiScan from the page.** The LegiScan section, its constant, its
   entry in the table of contents, and its column in the comparison table.
   The word does not appear on the page afterwards.

2. **Add the state-by-stage grid.** Every state and DC record the same
   lifecycle; eleven normalized stage events cover all fifty-one. The grid is
   already computed at the top of `docs/state-bill-stages.md` (rows: the 51
   jurisdictions; columns: the eleven events; a dot where the jurisdiction
   recorded that event in its latest session). Put it on the glossary as its
   own section, as a table, dots and all. A jurisdiction missing an event did
   not record one in its latest session; say that in one sentence, no more.

   The eleven, in lifecycle order: Introduced, Referred to committee,
   Reported: do pass, Reported: do not pass, Engrossed, Passed, Enrolled,
   Chaptered, Vetoed, Override, Failed.

   If you re-derive rather than read the document, this is the query, run
   through the Data API with the ARNs in `apps/web/.env.local`:

   ```sql
   with latest as (select state, max(session_id) session_id from "Bills" group by 1)
   select b.state, p.event, count(*)::int n
   from "Progress" p
   join "Bills" b on b.bill_id = p.bill_id
   join latest l on l.state = b.state and l.session_id = b.session_id
   group by 1, 2 order by 1, 3 desc
   ```

3. **A glossary definition for every one of the eleven stages.** One entry
   each, on the page, in the site's voice: third person, plain, one or two
   sentences, what the stage is in the life of a bill. No source is named in
   the definitions; they describe the stage, not where the word came from.

4. **A section per jurisdiction, all 52.** Each with the same tabbed block New
   York has (`StatusViews`): Table first, List second, inside the surface
   block. Contents:
   - **Congress**: its ten action `type` values, replacing the plain table
     that is there now. Two columns: `type`, what it covers (the text already
     on the page).
   - **New York**: unchanged; it already has its fifteen `statusType` values.
   - **Every other state and DC** (50 sections): the stages that jurisdiction
     records, from the grid, in lifecycle order. Two columns: the stage, and
     its definition from item 3.
   Sections in alphabetical order by jurisdiction name, each with a heading
   and an entry in the table of contents. No prose inside a state's section
   beyond the block.

Nothing from the "each state in its own words" half of
`docs/state-bill-stages.md` goes on the page. Brendan did not ask for it.

## Finishing

Type-check the two files with the bounded script (memory note
`bounded-typecheck.md`): a node script calling `ts.createProgram` on the
app's tsconfig with only the changed files as roots, under
`node --max-old-space-size=2048`, run from `apps/web`. A hook blocks
whole-project `tsc` and any command whose text contains the lint tool's name.

Ship only the two files, after the guard, from `apps/web`:

```
ssh govblock-dev-direct "cd ~/govblock/apps/web && git status --short app/glossary"
tar cf - app/glossary/page.tsx app/glossary/status-views.tsx | ssh govblock-dev-direct "cd ~/govblock/apps/web && tar xf -"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/glossary
```

Then report to Brendan in your window, and to the session that handed this
over (the former lead; `ListAgents` names it) that it is done.
