# Finish the search

You are in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), a Claude Code session, working in `apps/web` (Next.js App Router, AWS Amplify). Build tranche. Read current state before editing — the search was heavily worked on 2026-09-08 by another session and the shared pieces already changed.

## What already exists (don't rebuild it)

One search now backs four surfaces: the /home hero bar, the / (root) hero bar, ⌘K, and the navbar. They share:
- `components/command-menu.tsx` — `useSiteSearch` (the fetch/selection hook), `SearchResults` (the result groups: Bills, Members, Committees, Pages), and `CommandMenu` (the ⌘K + navbar dialog).
- `components/home/home-search.tsx` — the inline hero bar (used by /home and /). 
- The dialog is sized ~986px, rows read as aligned columns, members show `party · chamber · jurisdiction`, committees show `chamber · N bills`. Build on this; don't revert it.

The dedicated results page is `/search` (`app/search/…`), with a Filters rail (Show: Bills, Text, Members, Committees, Topics, Pages; Jurisdiction; Chamber) and result sections.

## Tasks

1. **Highlight the query everywhere on /search, not just in Text snippets.** Right now `/search?q=119&state=US` highlights "119" inside the Text-snippet group but NOT in the Bills group's numbers or titles (see the Bills rows: "H.Res. 1489", "119 HRES 1489 IH…" — the number is unhighlighted). Apply the same match-highlight to bill numbers and titles, member names, and committee names across every result group on /search. One shared highlight helper; case-insensitive; highlight all occurrences.

2. **Make each filter a jump link with an animated arrow.** In the Filters rail, each Show row (Bills, Text, Members, Committees, Topics, Pages) keeps its checkbox (show/hide) but also gains a small right-arrow at the row's end that, on hover, animates/rotates to an up-right arrow (↗), and clicking it scrolls the page to that result section (e.g. clicking Text jumps to the "Text (32)" section). Keep the checkbox toggle and the jump affordance distinct so one doesn't fire the other. Smooth scroll, respect `prefers-reduced-motion`.

3. **Fix the /docs index-page searches.** Each docs index page (`/docs/bills`, `/docs/members`, `/docs/committees`, `/docs/laws`, and the rest) has its own filter input that is weaker than the unified search — `/docs/bills` searching "hr 119" returns "No bills for Congress matching 'hr 119'" while the unified search finds 119-related bills. Make each index page's search behave like the unified one (parse "hr 119" / "H.R. 119" style queries, search number + title + more). Prefer reusing `useSiteSearch`/the `/api/policy/search` route over each page's bespoke filter; if a page must keep its own list filter, at least make the query parsing match. Verify "hr 119", "hr119", "H.R. 119" all return the right bills on `/docs/bills`.

4. **Member rows: aim for an avatar photo with a red/blue party dot; keep the flag if you can't.** Brendan wants a member's portrait with a party dot (red R / blue D), the way the dashboard member picker does it (`MemberPortrait` + `PartyDot` in `components/policy/imagery`). The blocker: the search payload doesn't carry a photo URL or district. So:
   - Add `district` and a photo id/url to the `/api/policy/search` route's member rows and to `SearchPayload["members"]` in `command-menu.tsx` (small backend change; the member data already has both, used on the member pages).
   - Then render member results with the portrait + party dot when a photo exists for that member, and show district in the description (`party · chamber · district`). If a photo is missing, fall back to the existing `FlagChip`.
   - Optional, only if it looks good: a chamber/jurisdiction **seal** instead of the flag for members/committees (seals are in `public/seals`, helper `ChamberSeal` in `components/policy/imagery`). Brendan's rule: "if it looks like trash, roll it back — the flags look good as is." So try it behind a quick visual check and keep the flag if the seal doesn't clearly beat it.

## Constraints

- **No whole-project typecheck or eslint** (a hook blocks it). Verify changed files with the bounded `ts.createProgram` script at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs` (copy into `apps/web` as `.check.mjs`, run under `node --max-old-space-size=2048`, delete after).
- **No local prod builds.** Start the dev server only if you need to verify: `cd apps/web && BRENDAN_OK_LOCAL_BUILD=1 NODE_OPTIONS=--max-old-space-size=2048 ../../node_modules/.bin/next dev` (log to /private/tmp/govblock-dev/dev.log), curl the route, then **kill it when done** — Brendan wants it down overnight.
- Keep each route/query under Amplify's ~30-second cut.
- **Commit in logical chunks on `design/workspace`**, each message ending with the attribution trailer your own session is configured to use, plus `Claude-Session:`. **Do not push.**
- Other sessions touch inbox/agent and dashboard files; you're in search + /search + /docs index pages + the search API. Read current state, commit only your own paths.

## Deliver

Highlighting across /search; filters that jump with the animated arrow; the docs index-page searches parsing bill-number queries correctly; member results with portrait + party dot where possible (flag fallback). Bounded typecheck clean on every touched file. End with a short summary of what shipped and the seal-vs-flag decision you made.
