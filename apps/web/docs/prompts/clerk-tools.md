# Build the Clerk's tools

You are working in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), an Anthropic Claude Code session. The app is `apps/web`, a Next.js App Router site deployed on AWS Amplify (not Vercel). Your job is to expand the tool set the platform's agents can call, and to fix three defects found on 2026-09-07. Read this whole brief before touching anything.

## The product context

GovBlock has one agent that people reach by email and in an in-app "Agentic Inbox": the **Clerk** (slug `bill-reader`). A design decision was made on 2026-09-07: **one agent, many tools.** The other personas (Whip, Treasurer, Parliamentarian, Librarian) are not separate agents; they are capabilities the Clerk should have. So everything you build attaches to the shared tool set, not to a new agent.

The Clerk answers over the GovBlock legislative record: all 50 states, DC and Congress, from the 2009 sessions to now. A user emails `govblock-clerk@agentmail.to` or writes in the inbox; a loop runs the agent one round at a time and replies.

## How the tools work today — read these files first

- `apps/web/lib/agents/tools.ts` — the tool catalogue. Each tool is a `Definition` with a JSON-schema `properties` block, `required`, a `request(input)` that returns a path like `bill?state=US&number=HB155`, and a `shape(data)` that trims the JSON before it becomes input tokens. The `query(resource, input, keys)` helper builds the querystring. Read the header comment; it explains the design (tools call the same `/api/policy/[resource]` routes the website uses, so they inherit jurisdiction scoping and the CloudFront cache).
- `apps/web/app/api/policy/[resource]/route.ts` — the resource router. It already has a `switch` with dozens of `case`s: `bill`, `text`, `bill-texts`, `votes`, `rollcall`, `vote-record`, `committee`, `committee-bills`, `committee-nominations`, `committee-communications`, `hearings`, `hearings-recent`, `hearing-days`, `latest-hearing`, `roster`, `sponsors`, `member`, `record`, `departments`, `department-bills`, `department-nominations`, `department-forms`, and more. **Many of the Clerk's requested tools already have a route case; the work is often just exposing it as a tool in `tools.ts`, and adding federal (congress.gov) coverage where a case is state-only.**
- `apps/web/lib/policy/*.ts` — the query layer (`db-queries.ts`, `queries.ts`, `department-queries.ts`). This is where SQL lives.
- `apps/web/lib/agents/registry.ts` — agent definitions; `bill-reader` is the Clerk. Tools are attached to agents here (check how the `tools` array on each agent is built).
- `apps/web/app/api/agents/chat/route.ts` and `apps/web/lib/agents/loop.ts` — the agent loop. **Do not change the protocol.** Note the loop's hard constraint: Amplify WEB_COMPUTE cuts any response at ~30 seconds. Each tool call must return well inside that.

## The data you have

Two families of tables:

- **State + everything (LegiScan):** `Bills`, `Calendar`, `Votes`, `Roll Call`, `Sponsors`, `Committees`, `People`, `Forms`, `BillTexts`, `BillTextChunks`. `Bills.state` is the two-letter code; `US` is Congress via LegiScan's mirror.
- **Congress, direct from congress.gov (richer and more current for federal):** `congress_bills`, `congress_bill_actions`, `congress_cosponsors`, `congress_amendments`, `congress_amendment_texts`, `congress_amendment_cosponsors`, `congress_committees`, `congress_committee_members`, `congress_committee_meetings`, `congress_hearings`, `congress_hearing_texts`, `congress_nominations`, `congress_nomination_actions`, `congress_house_votes`, `congress_house_vote_positions`, `congress_summaries`, `congress_cbo_estimates`, `congress_crs_reports`, `congress_related_bills`, `congress_titles`, `congress_text_formats`, `congress_members`. These carry the fields the tool list below needs and match congress.gov almost exactly (verified 2026-09-07: `congress_bills` and `congress_amendments` for the 119th match congress.gov counts to within a handful of sync-lag rows).

**Exploring the schema.** The database is Aurora Serverless v2 over the RDS Data API. Query it with the AWS CLI, loading the ARNs from `apps/web/.env.local`:

```bash
cd apps/web
export $(grep -E '^(POLICY_CLUSTER_ARN|POLICY_SECRET_ARN|AWS_REGION)=' .env.local | tr -d '"' | xargs)
aws rds-data execute-statement --resource-arn "$POLICY_CLUSTER_ARN" --secret-arn "$POLICY_SECRET_ARN" \
  --database policy --format-records-as JSON --sql "select column_name from information_schema.columns where table_name='congress_hearings' order by ordinal_position" --output json
```

The cluster auto-pauses; if a query errors with `DatabaseResumingException`, wait 15 seconds and retry. Never run heavy scans; add `limit`.

## The tools to build

Each is a new entry in `tools.ts` (schema + `request` + `shape`) and, where the route lacks a case, a new `case` in `[resource]/route.ts` plus a query in `lib/policy`. Attach each to the Clerk in `registry.ts`. Match the existing style exactly: tight descriptions that tell the model when to use it, `shape` that trims to the rows the model needs, jurisdiction-aware.

1. **calendar** — upcoming legislative events for a jurisdiction. State from `Calendar`; federal from `congress_committee_meetings`. Params: jurisdiction, optional from/to date, optional committee.
2. **hearings** — committee hearings with date, committee, title, and whether a transcript exists. Federal from `congress_hearings`; a route case already exists — check whether it covers Congress. Params: jurisdiction, optional committee, optional bill.
3. **transcripts** — the text of a hearing or of the Congressional Record. `congress_hearing_texts`, `congress_record_articles`. Return an excerpt plus a length, never the whole thing (see the 30-second rule). Params: hearing id or bill, optional search term.
4. **nominations** — presidential nominations and their status. `congress_nominations` + `congress_nomination_actions`. Federal only; say so in the description. Params: optional committee, optional nominee search, optional congress.
5. **votes** — recorded votes on a bill or in a chamber. State `Votes`; federal `congress_house_votes`. Params: jurisdiction, bill or date range.
6. **roll_call** — one vote's member-by-member positions. State `Roll Call`; federal `congress_house_vote_positions`. Params: the vote/rollcall id. Trim to totals + a capped list of positions.
7. **sponsors** — a bill's sponsor(s) with party and district. Often already in `get_bill`; add a focused tool only if useful. `Sponsors`, `congress_bills.sponsor_*`.
8. **cosponsors** — a bill's cosponsors, with the date each signed on. `congress_cosponsors` (federal, 174k rows — always filter by bill), state via `Sponsors`. Params: bill, jurisdiction.
9. **roster** — a committee's members with role (chair, ranking member). `congress_committee_members`, `Committees`. Params: committee, jurisdiction.
10. **committee_agenda** — what a committee has scheduled. `congress_committee_meetings`. Params: committee, jurisdiction, date range.
11. **bill_status** — the action history / current status of a bill, compactly. `congress_bill_actions` (71k rows, filter by bill), state via `Bills` history. Params: bill, jurisdiction.
12. **bill_amendments** — amendments to a bill. `congress_amendments` + `congress_amendment_cosponsors`. Params: bill, jurisdiction.
13. **bill_diff** — this one is real new work. Compare two text versions of a bill (e.g. Introduced vs Engrossed) and return a readable diff. Text versions are in `congress_text_formats` / `BillTexts` / `BillTextChunks`. Produce a unified or section-level diff, trimmed hard for token budget. If full-text diffing blows the 30-second or token budget, return a structured summary of what changed (sections added/removed/modified) rather than a raw diff, and say so in the description. Start simple; a section-count diff that works beats a line diff that times out.

## Three defects to fix (found 2026-09-07)

**A. Federal bill-number citation collides (real bug).** The agent's `get_bill` reads the LegiScan `Bills` table, which uses LegiScan's universal scheme: `HB` = House **bill**, `HR` = House **resolution**, `SB`/`SR` likewise. But people cite Congress the standard way: `H.R. 155` is a House **bill** (the Let America Vote Act), and `H.Res. 155` is a resolution. The route's normalizer in `[resource]/route.ts` (case `"bill"`) strips punctuation *before* lookup, so `H.R. 155` becomes `HR155` and returns LegiScan's House Resolution 155 (a Ukraine measure) — the wrong document. Verified: LegiScan `US HB155` = "Let America Vote Act"; `US HR155` = "Reaffirming... Ukraine".

Fix: for the `US` jurisdiction, translate congress.gov citation to the record's scheme, disambiguating on the punctuation *before* it is stripped: `H.R.`→`HB`, `H.Res.`→`HR`, `S.`→`SB`, `S.Res.`→`SR`, `H.J.Res.`→`HJR`, `S.J.Res.`→`SJR`, `H.Con.Res.`→`HCR`, `S.Con.Res.`→`SCR`. Update the `get_bill` tool description's examples accordingly.

**Strongly consider the better fix instead:** for `US` bill reads, route to the `congress_bills` family rather than LegiScan `Bills`. congress.gov is more current (its House-bill count led LegiScan's by ~120 on 2026-09-07), uses the citation scheme people actually type, and carries the actions, cosponsors, CBO, CRS and committee data that half the tool list above needs anyway. If you do this, keep LegiScan for the 50 states and branch on jurisdiction. Decide, implement one path cleanly, and write down why in a comment.

**B. A single round can exceed 30 seconds.** A real read of `H.R. 155`'s full record timed out (HTTP 500, empty body) because one tool pulled too much. Audit `get_bill` and especially `get_bill_text`/`transcripts` for payload size; cap text returns to an excerpt with a length, and make `shape` trim aggressively. The loop retries, but a tool that reliably fits under ~20 seconds is the goal.

**C. No web search, and it is needed.** On 2026-09-07 the Clerk was asked for a report that required knowing who funds open-primary ballot campaigns. That money lives in 50 state ballot-measure committees (not the FEC) and in public reporting, and the agent had no way to reach any of it. There is **no** web-search key or tool in the repo today. Add a `web_search` tool. Recommended: Anthropic's server-side web search tool if the Bedrock/Anthropic path in `lib/agents/` supports it; otherwise wire a search API (Brave, Tavily, or Exa) behind a new key in `.env.local` and a thin `/api/agents/search` route. Return titles, URLs and short snippets, and require the agent to cite URLs. Keep it to a handful of results to stay in budget. Note: the existing `get_fec` tool reads only our loaded FEC data (candidate/PAC committees, ~991), keyed to members of Congress; it cannot see ballot-measure money and is not the fix here.

## Constraints (do not violate)

- **No whole-project typecheck or eslint.** A PreToolUse hook blocks `tsc --noEmit`, `-p`, `--project`, and any command containing `eslint`; whole-project `tsc` spikes this 8 GB machine to ~6 GB. Verify changed files with a bounded `ts.createProgram` script over just the touched files, run with `node --max-old-space-size=2048`. A working script exists at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs`; copy it into `apps/web` as `.check.mjs`, run it, then delete it. File-scoped `eslint` on a single file is allowed only if the hook lets it through; if it blocks, skip lint.
- **No local production builds.** Do not run `next build`. Amplify builds from GitHub. The dev server is running on `localhost:3000`; confirm a route compiles by curling it (expect 200), e.g. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/workspace/inbox`. Do not restart the dev server unless asked.
- **Do not break the existing tools or the chat protocol.** The in-app inbox and `/agents` chat both speak the loop in `chat/route.ts`. Add; don't rewrite.
- **Match the house style.** Terse, purposeful comments that explain *why*. Tool descriptions written for the model, not the developer. Look at `search_bills` and `get_bill` as your templates.
- **Attribution on commits:** end each commit message with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  and the `Claude-Session:` trailer for your own session. Commit in logical chunks (a tool or two per commit) with messages that say what and why. Do not push. The working branch is `design/workspace`.

## Deliverable and verification

For each tool: the schema, the route case if new, the query, the registry wiring, and a live check against the dev server that the underlying route returns real rows (curl `http://localhost:3000/api/policy/<resource>?...`). For the three defects: a test proving the fix (e.g. `get_bill` for `US` `H.R. 155` now returns the Let America Vote Act; a full bill read returns inside the time budget; `web_search` returns cited results). Bounded typecheck clean on every file you touch. End with a short written summary: what shipped, what each tool reads, and anything you deferred.

Start by reading `tools.ts`, `[resource]/route.ts`, and `registry.ts` end to end, then pick the defects first (they are small and unblock trust), then the tools in the order above. Bill diff is last and hardest; timebox it and fall back to a section-level summary if a real diff won't fit the budget.
