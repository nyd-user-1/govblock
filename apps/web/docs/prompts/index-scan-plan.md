# Index, scan, and plan: the congressional data universe

You are in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), a Claude Code session. App is `apps/web` (Next.js App Router on AWS Amplify). **This is a research and planning tranche. Produce written inventories, gap analyses and ranked build briefs. Do NOT change application code.** The only files you write are plan documents under `apps/web/docs/plans/`.

Your job is to turn a pile of newly-found federal resources into a decision-ready map: for each, what it offers, whether we already hold the equivalent data or a page, the gap, the upstream API/source, and a feasibility-and-priority rating. Then a schema-reconnaissance pass on OpenSecrets/Follow the Money so we know how to rebuild their datasets from primary sources.

## What we already have (check before calling anything a gap)

Read-only, via the RDS Data API:
```bash
cd apps/web
export $(grep -E '^(POLICY_CLUSTER_ARN|POLICY_SECRET_ARN|AWS_REGION)=' .env.local | tr -d '"' | xargs)
aws rds-data execute-statement --resource-arn "$POLICY_CLUSTER_ARN" --secret-arn "$POLICY_SECRET_ARN" \
  --database policy --format-records-as JSON --sql "select table_name from information_schema.tables where table_schema='public' order by 1" --output json
```
There are congress.gov-derived tables (`congress_bills`, `congress_bill_actions`, `congress_committees`, `congress_committee_meetings`, `congress_hearings`, `congress_nominations`, `congress_house_votes`, `congress_record_daily`, `congress_record_articles`, `congress_congresses`, and more), plus state/LegiScan tables (`Calendar`, `Votes`, `Roll Call`) and existing pages under `apps/web/app/docs/` (look at `/docs/datasets` as the layout template). Congress keys are in `apps/web/.env.local` (`CONGRESS_API_KEY`); there is a govinfo key too. Web search and fetch are available to you.

## Part A — Inventory the resources

For each resource below, produce a row: **what it provides · do we already ingest it / have a page · the gap · upstream API or source · ingest feasibility (easy/medium/hard) · priority**. Group by theme.

Calendars & schedules:
- `https://www.congress.gov/calendars-and-schedules`
- `https://www.congress.gov/committee-schedule/weekly/2026/08/24`
- `https://docs.house.gov/Committee/Calendar/ByMonth.aspx?M=9&Y=2026` (Brendan: "this is what should be on our calendar views")
- `https://www.dailypress.senate.gov/`
- `https://clerk.house.gov/FloorSummary?date=08/10/2026`
- `https://www.congress.gov/days-in-session/119th-congress` (session calendar, drills into a day → `.../congressional-record/volume-172/issue-3/daily-digest` → `.../senate-section/page/S19-23`)

Committees:
- `https://www.congress.gov/committees`, `https://www.congress.gov/help/committee-profiles`
- `https://www.senate.gov/committees/index.htm`
- `https://www.senate.gov/about/research-tools/site-index.htm` (skim for anything else useful)
- LIS Calendar of Business lists: `http://lis.gov/crtext/lists.html#lcal`

Congressional Record: volume/issue/daily-digest/section drill-down (see the days-in-session chain above).

Video (for our evolving video capabilities): `https://www.congress.gov/committees/video` and per-committee feeds like `https://www.congress.gov/index.php/committees/video/house-agriculture/hsag00`.

Sessions of Congress: `https://www.senate.gov/legislative/sessions_of_congress.htm`.

**Deliverable A:** `apps/web/docs/plans/federal-resources-inventory.md` — the table above, then a ranked list of proposed pages/tranches, each sized (rough effort, data on hand vs new ingest). Call out the standouts Brendan flagged: a calendar built on the House Committee calendar + congress.gov weekly committee schedule; a days-in-session page; a floor-summary feed. Note which map to data we already ingest versus new ingests.

## Part B — OpenSecrets / Follow the Money schema reconnaissance (NOT bulk)

Goal: learn how OpenSecrets/Follow the Money built their database so we can rebuild the useful parts from primary public sources ourselves — the same way we scraped 50+ jurisdictions for bill text. **Do not attempt bulk downloads.**

- The Follow the Money free API key has a hard cap of **1,000 rows per YEAR**, so treat it as a schema probe, not a data feed. It was obtained for the livingston project and lives in that repo's `.env.local` (`api.followthemoney.org/?...&mode=json&APIKey=`, groups via `gro=`, paging via `p=`). If it is not available in govblock, ask Brendan or do this part from public documentation and web search alone — do not copy secrets between repos without his say-so.
- Pull only: the group/tag taxonomy (near-free) and one or two sample rows per group/table to capture the columns. A few dozen rows total, well under the cap.
- OpenSecrets itself no longer has a public API (confirmed 2026-09-07; a plain fetch of opensecrets.org returns 403). So reverse-engineer from the FTM schema plus their public pages.
- Then, by plain web search, map each table/column back to its **upstream public source** (state campaign-finance disclosure agencies, the Senate LDA lobbying database, the FEC) and rate ingest feasibility for each.

**Deliverable B:** `apps/web/docs/plans/opensecrets-reconstruction.md` — a schema map (tables and columns), a source-attribution map (table → upstream public source → API/bulk availability → feasibility), and a recommendation on which datasets are worth ingesting ourselves and in what order. Note explicitly what we already cover (we hold the full federal LDA lobbying set and the FEC campaign-finance pull) versus what would be net-new (state-level campaign finance, ballot-measure committees).

## Constraints

- **No application code changes. No commits except the two plan docs** under `apps/web/docs/plans/`. Read-only DB exploration; web search and fetch allowed.
- Respect the Follow the Money 1,000-row/year cap; do not batch or cron it.
- If you write the plan docs and commit them, do so on `design/workspace`, message ending with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and the `Claude-Session:` trailer; do not push.

## Deliverable

The two plan documents, then a short written summary to the operator: the three or four highest-value, lowest-effort builds from Part A, and your verdict from Part B on whether rebuilding OpenSecrets' datasets from primary sources is worth it and where to start. Output is briefs, not builds.
