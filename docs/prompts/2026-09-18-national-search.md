# National search: legislation, legislators and the law in one box

Brief for the next session, 2026-09-18. Read it whole before touching code.

## The ask (Brendan)
Clone the existing search element as a second search surface that searches bills, legislators and the law across all 50 states, DC and the U.S. at once. No free tool does all three in one place: Open States covers bills and legislators, Justia and Cornell cover statutes, each separately. The combination is the value.

## Settled: no Algolia
Algolia's free plan caps at 50,000 records and 10,000 searches a month ([terms](https://www.algolia.com/policies/free-plan-details)). We hold about 4.2 million records: 2,129,048 bills, 2,055,954 law sections, 22,723 legislators. A current-year-only cut does not help, because statutes have no year; law alone is 41 times the cap. Do not relitigate this.

Build it on what already runs: Postgres full-text search in Aurora.

## What exists
- **The search element:** `components/home/home-search.tsx`, driven by the `useSiteSearch` hook in `components/command-menu.tsx`, which fetches `/api/policy/search`.
- **Bills:** `searchAll` in `lib/policy/db-queries.ts` (around line 2600). `"BillTexts".search_tsv` covers each document's first megabyte and `"BillTextChunks"` the rest; both are GIN on `(state, session_id, tsv)`. Queries use `websearch_to_tsquery('english', …)` and `ts_headline` for snippets. Today they are scoped to the reader's state and session, with an `all` option across current sessions only.
- **Law:** `"Laws".tsv`, queried per state in `app/api/laws/route.ts` (doc types SECTION, PREAMBLE, JOINT_RULE, RULE; `ts_rank_cd`, top 50).
- **Legislators:** the `"People"` table (22,723 rows, `archived` marks retired members).

## Steps, in order
1. **Measure first.** Time an all-states, all-sessions bill query and an all-states law query against Aurora with `aws rds-data` (works from the Mac). The indexes are shaped for one state at a time; an unscoped search across millions of rows may be slow. Report the timings to Brendan before building. If all-years is slow, default to current sessions with all years a click away.
2. **Legislator names.** Check for a trigram index on `"People"` names. If missing, propose `pg_trgm` and the index to Brendan; do not run DDL without his word.
3. **One endpoint** that asks all three and returns results grouped as bills, law, legislators, each capped (say 8), with a jurisdiction filter (any state, DC, U.S., or all). It runs only on a search, never on page load (the 2026-09-15 rule).
4. **The second surface.** Clone the existing search element; placement is Brendan's call, so propose a route (for example `/search`) in the record pages' 640px column and ask.

## House rules that apply
- One command at a time; no subagents; no parallel tool calls.
- Typecheck changed files only: `cd apps/web && node --max-old-space-size=2048 ../../scripts/check-files.cjs <files>`. Never the whole-project compiler, and never type the linter's name in a shell command; a hook blocks both.
- The local dev server is `localhost:3000` on the Mac; start, stop or restart it only with the `BRENDAN_OK_LOCAL_BUILD=1` prefix, and only on request.
- A screenshot from Brendan is the spec. Answer questions before building. Nothing is pushed without his word.

## Also outstanding, separately
Production is stuck: Amplify builds 286 and 287 compiled but were rejected at about 235 MB against the 230.7 MB artifact cap (`.next` is 232 MB: 189 MB server, 42 MB static). Moving the election snapshots out saved only 367 KB. The next lever is removing the `.nft.json` trace manifests in the `amplify.yml` cleanup; see `memory/govblock-deploy.md` and `docs/design/simulator/HANDOFF-2026-09-17.md`.
