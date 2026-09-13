# Hand-off: Typeset instant (lead + typeset-perf), 2026-09-13

For a fresh session that has to take over either seat if usage runs out. Read
this, then `docs/prompts/2026-09-13-typeset-instant.md` (the brief), then
`docs/typeset-perf.md` (the running report), then act. Nothing here needs
re-deriving.

## The two seats

- **typeset-perf** works the editor's guts under the brief. It reports to the
  lead at each checkpoint and defers on conflicts.
- **lead (was govblock-76)** owns Typeset's layout and rules on seams. If the
  lead's session is gone, the new lead reads this file and announces itself to
  typeset-perf by name with `SendMessage` (`ListAgents` shows the live names).
- **auth-scope** is a third session on sign-in and the free/registered gate.
  It owns `app/layout.tsx`, the `(records)` pages, the policy API routes,
  `lib/policy/use-policy.ts`, `lib/policy/jurisdiction.tsx`. Not to be edited
  by either seat.

Brendan's standing rules, all of which he has had to repeat: one shell
command at a time, nothing in the background, no subagents, no parallel tool
calls. Do only what was asked. Do not start, stop or restart the dev box or
its server unless he says so. He reviews on `localhost:3001` in his own
browser; stop at "the page compiles".

## Where it stands

Baseline, H.R. 6644 (`/workspace/typeset/bill/2058568`), headless Chromium
from the Mac against `localhost:3001`, taken before any fix:

| measure | baseline | bar |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max | 504 / 608 / 1,500 ms | p95 < 16 ms |
| long tasks over 50 keystrokes | 51, 23.5 s in total | none |
| Comment click → draft form | 3.3 s | < 16 ms |
| Editing click → menu | 1.8 s | < 16 ms |
| idle, mouse over editor, 5 s | 3 long tasks, 1.6 s | none |
| cold load → editable | 16.6 s (HTML at 6.7 s, then one 6.5 s parse-and-mount task) | < 5 s |
| heap over 50 keystrokes | 650 MB → 992 MB | flat |

**Cause, measured with a React commit hook:** every keystroke re-renders
`BlockCommentContent` (`components/plate/ui/block-discussion.tsx`, the
DiscussionKit wrapper) 3,023 times, once per element in the bill; each render
calls `useEditorVersion` through `useBlockDiscussionItems` and walks its block
three times. That is 4.2 s of CPU per 20 keys; React's development
double-render adds 2.2 s. Nothing else re-renders more than a dozen
components.

**Approved plan:**

1. A dev-only bench route, `app/dev/typeset-bench/page.tsx` (`notFound()`
   outside development), mounting the same bill, editor and toolbar with
   plugins dropped by query string (`?drop=discussion,dnd,…`), so the
   bisection runs off one compile without touching watched files.
2. Fix one: the discussion wrapper's per-keystroke re-render. Land on the
   real page, re-measure, record in `typeset-perf.md`.
3. Then one kit per change, each with before/after. If a kit is dropped, the
   toolbar button it orphans changes in the same step (`fixed-toolbar-buttons.tsx`
   is the lead's file; ask, or take it over if the lead is gone).
4. Cold load (the 6.5 s parse-and-mount) only after the keystroke path is
   under the bar. Preferred fix: HTML→Slate on the server, JSON to the client.

## Files and who touched what (all uncommitted)

The lead's work today, on the Mac and shipped to the box, type-checked clean:

- `components/policy/pane-aside.tsx` — new. The Git view's outline aside
  lifted into one component (320 wide, hairline left, 36px title row with
  close, scrolling body).
- `components/policy/bill-text-pane.tsx` — uses `PaneAside`; no visual change.
- `lib/typeset/actions-panel.tsx` — new. Context: the bill, open/toggle/close,
  shared by the toolbar button and the aside.
- `components/plate/ui/actions-toolbar-button.tsx` — new. After Comment in
  the same toolbar group; pressed while open; disabled with no bill.
- `components/plate/ui/fixed-toolbar-buttons.tsx` — imports and places it.
- `components/workspace/typeset-actions-aside.tsx` — new. The aside's
  content in the /changelog pattern: one entry per day, newest first, dot on
  the line, the day as the title over a hairline, the day's actions as the
  changelog body (`### Chamber`, a bullet per action, the step number in the
  code chip) through the same `Prose` renderer the changelog page uses.
- `components/workspace/typeset-editor.tsx` — `Document` renders
  `FixedToolbar` explicitly above a row of `EditorContainer` +
  `TypesetActionsAside`; `BILL_KIT = EditorKit` minus the `fixed-toolbar`
  plugin. Released to typeset-perf on condition that structure stays.
- `components/workspace/typeset-workspace-2.tsx` — wraps `content` in
  `ActionsPanelProvider bill={bill}`.
- `app/glossary/page.tsx` — new. The docs shell inline (SidebarProvider +
  DocsSidebar + DocsPage). Defines "action"; maps actions / latest action /
  stage / one-word status across Congress.gov, New York and LegiScan; lists
  Congress's ten action `type` values and New York's fifteen `statusType`
  values.

**On the Mac only, not shipped, not approved by Brendan:**
`lib/assist-panel.tsx` — `useAssistSubject` reads the drawer context with
`useContext` and no-ops when null, instead of throwing. Reason: on the first
server render after a route compiles, the typeset page threw
`useAssistPanel must be used within AssistPanelProvider` and React discarded
the server HTML for the subtree (warm renders do not throw). Brendan stopped
the type-check of this edit. Ask him before shipping or `git checkout -- lib/assist-panel.tsx`.

## Facts already established (do not re-measure)

- Bill HTML from `/api/typeset/content?item=article&bill=2058568`: 355 KB,
  4,378 elements (1,906 `<p>`, 259 `<h4>`, 204 `<h3>`, 69 `<h2>`), parsed in
  the browser by `usePlateEditor({ value: html })`.
- `EditorKit` is 36 kits. `StaticToolbar` (`typeset-toolbar.tsx`) builds a
  second full editor for the disabled toolbar on Git/Diff/Versions/Fork.
- `DevInspector` mounts in `app/layout.tsx` in development; capturing
  `mousemove`/`click` on `window` (inspector.tsx ~586), a `body *` scan (~347).
- Dev page ships 34.8 MB of chunks across 98 files; the tunnel is direct SSH
  at ~4.7 MB/s; the server answers warm routes in ~0.3 s. Not the server, not
  the database, not the instance size.
- The "flood" seen at 08:58–09:00 UTC (≈6 req/s of `/` and the typeset route)
  was Next's server-component refresh in Brendan's open tabs on every file
  write, plus a retry loop while the route threw the provider error. Not a
  process. typeset-perf keeps a journal monitor for it.

## Naming, settled by the sources (not by anyone's opinion)

- Congress.gov: `actions` (every step), `type` on each action (ten values:
  IntroReferral, Committee, Calendars, Floor, Discharge,
  ResolvingDifferences, President, BecameLaw, Veto, NotUsed), `latestAction`.
- New York (legislation.nysenate.gov): `actions` (every step: date, chamber,
  text, sequenceNo), `statusType` on `status` and `milestones` (fifteen
  values), `status` for where the bill stands.
- Neither uses activity, history, or progress. The Typeset view labelled
  "Activity" is keyed `actions` in `lib/typeset/views.ts`; its label is
  Brendan's call and has not been changed.

## The box

EC2 `govblock-dev`, `i-0b5e3556a1fa8f1d4`, us-east-1, t4g.2xlarge. Memory
note `govblock-dev-box.md` has the full picture. Two things learned today:

- **The old nightly `govblock-stop.timer` still fires at 09:00 UTC (5:00 AM
  Eastern)** and stopped the box under Brendan this morning; the hour-idle
  watcher did not replace it. Not touched; Brendan decides.
- The public IP changes on every start; `~/bin/govblock-dev-up` on the Mac
  rewrites the `govblock-dev-direct` host and reopens the 3001 tunnel. Do not
  run it unless Brendan asks.

Ship files with `tar cf - <files> | ssh govblock-dev-direct "cd ~/govblock/apps/web && tar xf -"`
(in zsh, `rsync --relative` with an unquoted list of files fails: the list is
one word). Guard first with `git status --short <files>` on the box; the
box's tree is three sessions' uncommitted work and must never be checked out,
stashed or reset.

Type-check changed files with the bounded script (memory note
`bounded-typecheck.md`); a hook blocks whole-project `tsc` and any command
whose text contains the lint tool's name, including a heredoc that quotes a
source comment. Use the Edit tool for such files.

## Update, 2026-09-13 late morning

- Both seats were cut off by the usage limit and relaunched. **Auth-scope is now
  the lead agent** for the repo; this session (the former lead) stands down on
  any collision with it and reports there. It remains QA and lead for
  typeset-perf only.
- typeset-perf's first fix landed: the discussion wrapper no longer re-renders
  per block. Keystroke p95 608 → 159 ms; Comment click 3.3 → 2.0 s; heap after
  50 keys 992 → 719 MB. Next on its list: Slate's chunk re-mapping, Jotai
  recomputation of the editor atom, then the cold-load parse.
- Glossary: the New York status list is now two views under animate-ui tabs,
  Table (default, a bordered grid) and List, both inside the surface block with
  the copy button (`app/glossary/status-views.tsx`; tabs files under
  `components/animate-ui/` and `lib/get-strict-context.tsx`, placed by hand from
  the registry because the CLI stopped on an overwrite prompt).
- `docs/state-bill-stages.md`: the lifecycle stages of all fifty states and DC,
  derived from the `Progress` and `History Table` rows of each state's latest
  session (top forty action lines per state, classified onto sixteen stages;
  1,672 of 2,003 lines placed). Not on any page yet.
- `lib/assist-panel.tsx` on the Mac still carries the unshipped, unapproved
  tolerant `useAssistSubject`.
