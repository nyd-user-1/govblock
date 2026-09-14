# API keys and the MCP server — build log, 2026-09-13

Brendan, 2026-09-13: "set up our self-serve api key process now, when you are
finished set up our mcp server." Two batches, API first. The shape comes from
`/Code/44b` (keys, metering, the `[transport]` MCP route) and `/Code/leuk`
(the `/api/mcp` route on mcp-handler v2, the `/.well-known/mcp.json` card,
tools kept in `lib/mcp/tools.ts`). This file is the running record so a
fresh session can pick up mid-build. Stages are ticked as they land on the
box; nothing is committed.

## Decisions (do not re-derive)

- **Key shape** `gb_` + 40 hex (20 random bytes). Only the SHA-256 hash is
  stored, plus a 9-char prefix (`gb_` + 6 hex) for the keys table. Shown
  once at creation, as in 44b.
- **Where keys live** Aurora, database `policy`, two new tables `api_keys`
  and `api_usage` (one row per key per UTC day, atomic upsert). Same shape
  as 44b's migration 0013, keyed by `readers.id`-style user ids (text).
- **What a key buys** The reader's plan, read from `reader_profiles.plan`
  (new column, text, default `free`). Plans and their limits live in ONE
  module, `lib/plans.ts`: free (no API), team, pro, custom. Nobody has a
  paid plan yet; `plan` is set by hand until Stripe exists. A key on a free
  plan is refused with `403 plan_required` — the key outlives the plan.
- **How a key is sent** `Authorization: Bearer gb_…`; `x-api-key` also
  accepted. Never in a URL.
- **Where it is checked** `lib/entitlements-server.ts` `readerOf()`: a valid
  key resolves to a Reader with the plan's license, so `/api/policy/*`,
  `/api/dataset/*` and typeset content all honour it without changes of
  their own. Metering happens in the policy route only (the product), via
  `recordUsage(keyId)`, with 44b's `X-RateLimit-*` headers and 429 body.
- **Self-serve UI** the existing Settings → API tab
  (`components/admin/pages/settings.tsx`, `Api()`), which was a mock with
  three fake keys. Now real: create (named), the key shown once with Copy,
  the list with prefix / created / last used, Revoke. Usage card reads
  `api_usage`. The webhook card is gone (nothing behind it).
- **Docs** `/docs/api` gets a "Keys and limits" paragraph; the full keyed
  reference is a later pass.
- **MCP** `/api/mcp` on `mcp-handler` 2.1.1, whose types come from
  `@modelcontextprotocol/server` 2.0 (installed with it; the tool context's
  auth is `ctx.http.authInfo`), plus zod (already 4.4.3), Streamable HTTP, stateless, tools-only. Auth: the
  same `gb_` key as a bearer (Claude Code/Desktop/Cursor take a static
  header); no OAuth server this pass. Tools are thin wrappers over the
  existing read functions in `lib/policy/db-queries.ts` and `searchAll`,
  bodies in `lib/mcp/tools.ts`, transport in the route. Card at
  `/.well-known/mcp.json`. One quota across REST and MCP: `recordUsage` on
  every tool call.

## Stage 1 — schema

- [x] `api_keys`, `api_usage` created on Aurora; `reader_profiles.plan`
      added. DDL in `scripts/sql/2026-09-13-api-keys.sql` (also run by hand
      on the box with `aws rds-data execute-statement`).

## Stage 2 — library

- [x] `lib/plans.ts` — `PLANS`, `hasApiAccess`, limits.
- [x] `lib/api-keys.ts` (server-only) — `hashKey`, `createApiKey`,
      `listApiKeys`, `revokeApiKey`, `resolveApiKey`, `touchApiKey`,
      `recordUsage`, `getUsageForUser`, `nextUtcMidnight`, `nextUtcMonth`.
- [x] `lib/profile.ts` — `plan` on the Profile type and in the column list.

## Stage 3 — the gate

- [x] `lib/entitlements-server.ts` — `readerOf()` resolves a bearer key.
- [x] `app/api/policy/[resource]/route.ts` — meter keyed calls, 429s,
      rate-limit headers, `plan_required` on a free plan.

## Stage 4 — self-serve UI

- [x] `app/api/keys/route.ts` (GET list, POST create) and
      `app/api/keys/[id]/route.ts` (DELETE = revoke), session-gated.
- [x] Settings → API rebuilt on those routes.

## Stage 5 — docs

- [x] `/docs/api` paragraph on keys, headers, limits, errors.

## Stage 6 — MCP

- [x] deps installed (`mcp-handler`, `@modelcontextprotocol/sdk`).
- [x] `lib/mcp/tools.ts`, `app/api/mcp/route.ts`,
      `app/.well-known/mcp.json/route.ts`, `docs/mcp-server.md`.
- [x] Settings → API shows the connect command.

## Stage 7 — proof

- [x] curl, 2026-09-13 22:30–22:50 UTC on the box, as the dev reader
      `apikey-probe@example.com` (`u-dev-apikey-probe-example-com`, left on
      the Pro plan with one key `gb_a7ef14…`, for the next proof):
      - free plan: POST /api/keys → "API keys come with a plan"; set to pro
        by hand; POST → a `gb_` key, 43 chars, shown once; GET lists it.
      - `/api/policy/bills?state=AK`: 403 as a stranger, 200 with the key
        and `x-ratelimit-limit: 10000`, `-remaining: 9999`, `-window: day`,
        `cache-control: private, no-store`; an unknown key → 401
        `invalid_api_key`; `x-api-key` accepted.
      - `/.well-known/mcp.json` → 13 tools; MCP without a key → 401;
        `initialize` → GovBlocks 1.0.0, protocol 2025-06-18, 2,461 chars of
        instructions; `tools/list` → 13; `search housing NY` → bills with
        absolute urls; `list_bills AK` → 848 bills, SB9 first.
      - the rule over MCP: the first Team run OPENED Alaska — a keyed reader
        on any plan with API access counted as fully paid. Fixed the same
        hour: `Reader.license` gained `team` (every entity and session, but
        only Congress and the home state; `lib/entitlements.ts`), and
        `readerForKey` maps team → team, pro/custom → paid. Re-run: on Team,
        Alaska → `not_on_plan` with the gate's sentence, New York (home)
        opens, Congress lobbying opens; on free, MCP → 403 and REST → 403
        `plan_required`.
      - usage: every REST and MCP call bumped the same `api_usage` row.
      Not proven: the 429 (would take 10,000 calls); `limitExceeded` is the
      same comparison 44b ships.
