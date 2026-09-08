# Wire the Clerk to honor the report type

You are in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), a Claude Code session. App is `apps/web` (Next.js App Router on AWS Amplify). Build tranche. Read the whole brief before touching anything, and read the current state of the files named — several were edited today by other sessions.

## The gap

The Agentic Inbox now has a **report-type picker** in the compose subject line (`Traditional Report` default, `Trace Report`, `Memo`, `Executive Summary`, `Talking Points`, `Root Cause Analysis`). The choice is stored on the draft and the thread as `reportType` and shown as a chip. But the Clerk agent (`bill-reader`) never reads it: a live task produces the Clerk's default short brief regardless of the type picked. Your job is to make a real request honor the selected type end to end.

Read first:
- `apps/web/registry/blocks/sidebar-09/components/compose.tsx` — `REPORT_TYPES`, `DEFAULT_REPORT_TYPE`, `Draft.reportType`.
- `apps/web/lib/agents/inbox.ts` — `Thread.reportType`, `Message.attachments`, `Attached`.
- `apps/web/lib/agents/run-client.ts` — the browser's run loop; the request it POSTs to the chat route.
- `apps/web/app/api/agents/chat/route.ts` — the chat route contract.
- `apps/web/lib/agents/loop.ts` — `runStep`, and `systemSuffix` (appended to `definition.system`).
- `apps/web/lib/agents/registry.ts` — the `bill-reader` (Clerk) definition and the shared `GROUND` preamble. Note GROUND deliberately says "no headings on a three-paragraph answer, no bibliography, keep it short" — correct for Q&A, wrong for a report. A report type must override that.
- Report conventions: memory `report-voice` (newspaper voice, no stat tiles on paper, third person, never name the model, no leading "The", plain numbered sections, three money tables); the reusable template at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/1ed52990-59e9-47ef-a8d2-7536582c9807/scratchpad/reusable-report-template.md`; the Trace Report worked example at `apps/web/public/reports/open-primaries-trace.html`; the featured examples in `apps/web/lib/agents/featured.ts`.

## What to build

1. **Carry `reportType` into the run.** Thread it from the draft/thread → `run-client.ts` request → `chat/route.ts` → `runStep` as a `systemSuffix` (or a dedicated field). When a type is set, the Clerk switches into report mode; when absent, it behaves as today.

2. **Author a report-mode instruction per type.** One place (e.g. `lib/agents/report-modes.ts`) mapping each `REPORT_TYPES` value to the instructions that produce it, each explicitly overriding GROUND's "keep it short" rules for that answer:
   - **Traditional Report** (default): headline (newspaper voice, accurate framing, ideally a number), deck, Key takeaways (2–3), numbered plain-titled sections, tables where there are columns, a Money section as three tables when the topic has contested figures (as-Tavily / as-Exa / reconciled), Sources, Method and gaps.
   - **Trace Report**: the staged format — the run's own tool calls become the sections, each a source paired with the Clerk (source retrieves, Clerk reasons), a "Reasoning" disclosure, then the output, ending in a synthesis with the money tables. See the worked HTML. The Trace Report is largely a *rendering of the run*, so lean on the run's `steps` rather than re-authoring them.
   - **Memo / Executive Summary / Talking Points / Root Cause Analysis**: short, standard shapes; write tight instruction sets for each.
   All modes: newspaper voice, third person, never name the model, no leading "The", no stat tiles.

3. **Render the type in the reading pane.** The inbox currently renders the reply body as markdown plus an attachment card. Traditional/Memo/etc. are markdown and already render. **Trace Report needs a dedicated renderer** in the reading pane that lays out the run's steps as the trace (paired source+Clerk facepile, Reasoning disclosure, output) — port the structure from `open-primaries-trace.html` into a React component. Switch on `thread.reportType`.

4. **The PDF attachment — decide and note.** Reports attach a PDF (`Message.attachments`). Decide how it's produced on a live run: the app already depends on `jspdf` + `jspdf-autotable` (used in `components/policy/vote-record-pdf.tsx`) — a client-side render of the report is the low-risk path, since Amplify can't run headless Chrome. Implement client-side PDF from the report content, or, if you defer, attach nothing rather than a broken link and say so in your summary. Do not add a server-side headless-browser dependency.

## Constraints

- **No whole-project typecheck or eslint** (a hook blocks it). Verify changed files with a bounded `ts.createProgram` over just the touched files under `node --max-old-space-size=2048`; a working script is at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs` (copy into `apps/web` as `.check.mjs`, run, delete).
- **No local production builds.** Start the dev server only if you need it: `cd apps/web && BRENDAN_OK_LOCAL_BUILD=1 NODE_OPTIONS=--max-old-space-size=2048 ../../node_modules/.bin/next dev` (log to /private/tmp/govblock-dev/dev.log); confirm a route with `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/workspace/inbox`. Kill it when done.
- **Amplify cuts any response at ~30 seconds.** A report is many rounds; each round must fit. The run loop already goes round by round — keep it that way.
- **Don't break the chat protocol or the existing inbox.** `/agents` chat and `/workspace/inbox` both use the same loop; add, don't rewrite.
- **Commit in logical chunks on `design/workspace`**, each message ending with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and the `Claude-Session:` trailer. **Do not push.**
- Other sessions are live on this branch (docs, lobbying, roll-call, tables) but not in the inbox/agent files; read current state before editing, commit only your own paths.

## Verify and deliver

Send a real task through the local chat route for each of at least Traditional and Trace, confirming the Clerk produces the right format and the reading pane renders it. Confirm the default (no type) still gives the short brief. Bounded typecheck clean on every touched file. End with a short summary: what each type produces, how the Trace renders, and the PDF decision you made.
