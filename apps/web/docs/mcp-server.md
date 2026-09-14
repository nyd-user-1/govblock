# The GovBlocks MCP server

`https://<site>/api/mcp` — Streamable HTTP, thirteen read-only tools, a
GovBlocks API key as the bearer token.

A reader connects their own Claude to the record and asks it questions: what
is before the Housing committee in Albany this week, how did the House vote on
H.R. 6500, who sits for the 4th Senate district. GovBlocks pays no model
spend; the reader's model does the thinking and the server serves the rows.
Adapted from 44b's server (`/Code/44b/src/app/api/[transport]/route.ts`) and
leuk's (`/Code/leuk/app/api/mcp/route.ts`): the transport, the
instructions-as-product idea and the result-shape discipline are theirs.

## Connect

Mint a key under Settings → API (a plan is required), then:

```bash
claude mcp add --transport http govblocks https://<site>/api/mcp --header "Authorization: Bearer gb_…"
```

Claude Desktop and Cursor take the same URL and header. In claude.ai the
custom-connector form is OAuth-first; a static header is the beta path there.
Discovery card at `/.well-known/mcp.json`.

## Tools

All in `lib/mcp/tools.ts`, plain functions over `lib/policy/db-queries.ts`,
the same reads the site's pages use. The route (`app/api/mcp/route.ts`) owns
schemas, auth, metering and the rule.

| Tool | Reads | Entity |
|---|---|---|
| `search` | `searchAll`, every state at once | search |
| `list_bills` | `getBills` | bills |
| `get_bill` | `getBill` | bills |
| `get_bill_text` | `getBillText`, windowed | bills |
| `bill_votes` | `getBillVotes` | votes |
| `list_members`, `get_member` | `getMembers`, `getMember` | members |
| `list_committees`, `get_committee` | `getCommittees`, `getCommittee` | committees |
| `list_roll_calls`, `get_roll_call` | `getRollCalls`, `getRollCall` | votes |
| `calendar` | `getCalendar` | calendar |
| `record_status` | `getStates`, `getSessions` | meta, free |

## The rule and the meter

Every call is one metered request on the same `api_usage` rows as
`/api/policy`, held to the plan's day and month first, then to the site's
entitlement rule (`lib/entitlements.ts`) for the jurisdiction, session and
entity the call names: a Team key opens Congress and the reader's home state,
a Pro key every state. A refused call answers `{ error: "not_on_plan" }` with
the gate's own sentence, not a 403 — the model is told which plan opens it.

Unknown or revoked key: 401. A key on the free plan: 403 `plan_required`.
