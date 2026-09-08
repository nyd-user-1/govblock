# Federal source of truth, roll-call votes, and lobbying

You are in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), a Claude Code session. App is `apps/web` (Next.js App Router, deployed on AWS Amplify, not Vercel). This is a build tranche. Read the whole brief before touching anything. The clerk-tools session just finished building the Clerk's agent tools and fixing the federal bill-citation problem in the agent path; check what it shipped (`apps/web/lib/agents/tools.ts`, `app/api/policy/[resource]/route.ts`, git log on `design/workspace`) so your work aligns rather than diverges.

## The root problem

We started ingesting legislation from **LegiScan** before we had congress.gov and govinfo API keys. LegiScan renumbers federal bills into its own universal scheme (HB = House bill, HR = House resolution, SB/SR likewise) and, worse, its US mirror has wrong bill identity: our LegiScan `Bills` row for US 2025-2026 `HB1` is titled "FEHB Protection Act of 2025," not the reconciliation act that is actually H.R.1 in the 119th Congress. Meanwhile the `congress_bills` family (direct from congress.gov) is correct and current: verified 2026-09-07, its 119th-Congress counts match congress.gov to within a few sync-lag rows, and it uses standard citation (HR, HRES, S, SRES, HJRES, SJRES, HCONRES, SCONRES).

**Policy to establish (task 1):** for the US jurisdiction, congress.gov + govinfo are the primary source for congressional bills, texts, actions, members, committees and votes. LegiScan drops to a supplement, refreshed from its Sunday bulk dataset, used only to enrich fields congress.gov/govinfo lack. Write this down in a short doc (e.g. `apps/web/docs/federal-sources.md`) and in code comments where the switch happens.

## Tasks, in dependency order

1. **Source-of-truth policy** (above): document it, and make the US bill read path resolve against `congress_bills`, not LegiScan `Bills`. Restore standard citations everywhere a federal bill is shown or accepted as input. Coordinate with whatever the clerk-tools window already did for `get_bill`'s US citation so there is one implementation, not two. Keep an adapter so any surface that currently expects a LegiScan `bill_id` keeps rendering (map congress.gov identity ↔ existing ids where both exist).

2. **Re-key federal lobbying to correct bill identity.** `LobbyingBills` (560,789 federal rows: `filing_uuid, seq, bill_number, session_id, bill_id`) currently joins the LegiScan `Bills.bill_id`, so lobbying attaches to the wrong bill (our H.R.1 lobbying lands on the FEHB Protection Act). The LDA filings reference bills by citation text plus congress; re-match them to `congress_bills` identity. Verify: after the fix, lobbying for H.R.1 of the 119th must attach to the reconciliation act, and the client/firm counts should be in OpenSecrets' ballpark (~2,389 clients / ~1,509 firms on that bill per opensecrets.org; our raw data returns ~2,900 clients / ~1,525 firms, same source, so expect a close but not identical number).

3. **Roll-call votes — verify coverage, then build the page.** We have `congress_house_votes` (House; 657 rows for the 119th) and `congress_house_vote_positions`. We appear to have **no federal Senate roll calls** — confirm that, and if missing, ingest them from senate.gov XML (`https://www.senate.gov/legislative/common/generic/roll_call_lists.htm` and the per-vote XML it links). Confirm House completeness for recent congresses too. Then add **`/docs/roll-call-votes`**, laid out like the existing **`/docs/datasets`** page: an index of votes (House and Senate, by congress/session), each drilling into a vote's member-by-member positions. Reference: `congress.gov/roll-call-votes`, `congress.gov/votes/house/119th-congress/1st-session`.

4. **Legislative-action taxonomy audit.** congress.gov classifies actions into a full taxonomy (Introduction & Referral, Committee-Related Activity, Floor Consideration, Amendment Actions, Roll Call Votes, Resolving Differences, To President, Became Law, Veto Consideration, each with many sub-actions — the complete list is in `apps/web/docs/prompts/_congress-action-taxonomy.md`, which you should create from the list Brendan provided and keep as reference). Audit `congress_bill_actions` against it: are all action types captured, and does our bill-status display reflect the real stage? Note gaps; fix the display where it flattens distinct stages into one.

5. **Lobbying surfaces** (only after the re-key in task 2). We already hold the data: `LobbyingBills` (560,789), `LobbyingFilings` (357,379: registrant, client, income/expenses, client description/state, document URL), `LobbyingActivities` (677,465: lobbyist names, issue codes, issues, government entities). Build:
   - **`/docs/bill` lobbying block**: clients lobbying, registered lobbyists, firms, spend, with the document URLs, mirroring OpenSecrets' bill-lobbying page.
   - **Member page**: add lobbying alongside the existing finance block, including a revolving-door count (former staff now registered).
   - **Committee page**: lobbying activity on bills referred to it, top registrants active before it.
   - **`/docs/lobbying`**: a dedicated explorer laid out like `/docs/datasets` — top firms, top clients, top lobbyists, by sector, searchable — with entity pages behind it (a lobbyist profile, a firm profile, a client profile, in the shape of OpenSecrets' entity pages).

## Exploring the data

Aurora over the RDS Data API. Load ARNs from `apps/web/.env.local` and query:
```bash
cd apps/web
export $(grep -E '^(POLICY_CLUSTER_ARN|POLICY_SECRET_ARN|AWS_REGION)=' .env.local | tr -d '"' | xargs)
aws rds-data execute-statement --resource-arn "$POLICY_CLUSTER_ARN" --secret-arn "$POLICY_SECRET_ARN" \
  --database policy --format-records-as JSON --sql "select ..." --output json
```
Cluster auto-pauses; on `DatabaseResumingException`, wait 15s and retry. Always `limit` heavy scans.

## Constraints (do not violate)

- **No whole-project typecheck or eslint** — a PreToolUse hook blocks `tsc --noEmit`/`-p`/`--project` and any command containing `eslint` (this 8 GB machine spikes to ~6 GB otherwise). Verify changed files with a bounded `ts.createProgram` over just the touched files under `node --max-old-space-size=2048`; a working script is at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs` (copy into `apps/web` as `.check.mjs`, run, delete).
- **No local production builds** (`next build`). Amplify builds from GitHub. The dev server runs on `localhost:3000`; confirm a route compiles by curling it (expect 200).
- **Amplify cuts any response at ~30 seconds.** Keep every route and query under it.
- **Commit in logical chunks on `design/workspace`**, messages that say what and why, ending each with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and the `Claude-Session:` trailer. **Do not push.**
- Match house style: terse purposeful comments, and drop reflexive leading "The" from headings and labels (a standing preference). Lay `/docs/roll-call-votes` and `/docs/lobbying` out like `/docs/datasets`.

## Deliverable

Source-of-truth policy doc; US reads and lobbying keyed to `congress_bills`; roll-call coverage confirmed/backfilled and the `/docs/roll-call-votes` page live; action-taxonomy audit written up with fixes; lobbying block on the bill, member and committee pages plus the `/docs/lobbying` explorer. Each verified against the dev server. End with a short written summary of what shipped, what you confirmed about roll-call and taxonomy coverage, and anything deferred. Do the identity fix and lobbying re-key first — everything else depends on correct bill identity.
