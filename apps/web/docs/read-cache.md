# The read cache

Decided 2026-09-15 after a week of the cluster at its 8 ACU ceiling around
the clock: crawlers re-rendering the same pages, one ten-second lobbyist query
run 470,000 times, and a site that cached nothing. The data changes when a
loader runs, not when a page opens, so the site answers from a cache and the
cluster hears each statement once.

## How it works

`apps/web/lib/policy/db.ts` wraps every read that goes through `q`, `one` or
the `sql` tag in Next's data cache, keyed by the statement and its parameters.

| The statement | Cached for |
|---|---|
| a read of public tables | a day |
| a read that asks the clock (`now()`, `current_date`) | an hour |
| a write, a catalog read, a read of a personal or volatile table | never |
| a read carrying the comment `/* fresh */` | never |

Personal and volatile means clips, watches, forks and commits, the reader
profile, sign-in, the job queue, the Typeset document store, agents and mail.
The list is `VOLATILE` in `db.ts`; a new table whose rows belong to one reader
or change under the site's own hand goes on it.

Tags: every cached statement carries `policy` and one `table:<name>` per
table it reads.

## Clearing it

The freshest data is the last load, so a load clears what it wrote:

- `POST /api/revalidate` with `Authorization: Bearer <AUTH_SECRET>` and a body
  of `{ "tables": ["Bills", "BillTexts"] }`, or `{ "all": true }`.
- Scripts call `clearReadCache(tables)` from `scripts/laws/lib/revalidate.mjs`
  when they finish; the nightly XML step does.
- The Database dashboard's **Clear site cache** button clears everything, for a
  load that did not.

The firewall's first rule lets requests to `/api/` through when their agent is
`node`, `undici` or absent, which is what the scripts and the Cloudflare
worker send; every other bot is blocked at the edge.

## The lobbyist map

`lobbyist_filings` (sql/025) is the precomputed lobbyist → filings view the
lobbying pages read instead of unnesting 677,465 activity rows a query. After
a lobbying load: `refresh materialized view concurrently lobbyist_filings`.
