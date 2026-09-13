# Typeset: instant

Brendan, 2026-09-13: the Typeset editor is unusable. On a t4g.2xlarge with a
direct 4.7 MB/s tunnel the page still would not load, the Comment button took
an age to answer, and moving from one toolbar button to the next lagged. The
last two explanations offered to him were the database and the instance size.
Both were wrong: typing in an editor calls neither. He lost half an hour to
them.

The bar is **instant**. His words: "so fast it's almost like the keystroke put
the text on the page before your finger came off the button." Not better. Not
acceptable. Instant. Every keystroke paints inside one frame, every toolbar
button answers inside one frame, and the page is editable within a few
seconds of a cold load on the dev box. This session's job is to find every
reason it is not, prove each one with a number, remove them, and prove the
result with a number.

## Who is who

- **This session is `typeset-perf`.** It works on the editor's guts:
  plugins, parsing, rendering, dev-server configuration, the inspector.
- **The lead is `govblock-76`.** Brendan and the lead are changing Typeset's
  *layout* at the same time (a new toolbar button and a right-hand aside).
  `typeset-perf` defers to the lead on every conflict, without exception.
  Message the lead with `SendMessage` (`to: "govblock-76"`): once on start,
  once with the measurements before any edit, once per landed fix, and
  before touching any shared file named below. If the lead says stop, stop.
- **`auth-scope`** is a third session, on sign-in and the free/registered
  scope. It owns `app/layout.tsx`, the `(records)` pages, the policy API
  routes, `lib/policy/use-policy.ts`, `lib/policy/jurisdiction.tsx`. Do not
  edit those. If the inspector's mount line in `app/layout.tsx` must change,
  gate it inside `components/dev/inspector.tsx` instead, or ask the lead.

### Files

Owned by `typeset-perf` — edit freely:

- `components/plate/editor/editor-kit.tsx` and every file under
  `components/plate/editor/plugins/`
- `components/plate/ui/*` **except** `fixed-toolbar-buttons.tsx`,
  `toolbar.tsx`, `comment-toolbar-button.tsx`
- `components/dev/inspector.tsx` (577 lines of it are uncommitted work from
  today; keep every feature, fix its cost)
- `app/api/typeset/content/route.ts`, `lib/policy/bill-html.ts` and whatever
  builds the bill's HTML
- `next.config.ts`, `turbo.json`, `package.json` (announce dependency changes
  to the lead first; `pnpm install` on the box after)
- the box's `govblock-dev.service` unit and its environment

Owned by the lead — **do not edit; ask, and the lead makes the change**:

- `components/workspace/typeset-editor.tsx` (the lead is restructuring
  `Document` right now: an explicit toolbar above a row of editor + aside).
  Anything about *how the editor is built* — `usePlateEditor` arguments, the
  plugin list it takes, how `html` is fetched and parsed — is `typeset-perf`'s
  to decide, but the edit goes through the lead until the lead says the file
  is released.
- `components/workspace/typeset-workspace-2.tsx`,
  `components/workspace/typeset-toolbar.tsx`, `lib/typeset/views.ts`
- `components/plate/ui/fixed-toolbar-buttons.tsx`, `toolbar.tsx`,
  `comment-toolbar-button.tsx`
- `components/policy/bill-text-pane.tsx`, `components/create/*`,
  `app/glossary/**`

Nothing else is off limits, but every file in `git status` belongs to a live
session. Never revert, stash, checkout or reformat a file you did not write.

## The page

`/workspace/typeset/bill/2058568` — H.R. 6644, the 21st Century ROAD to
Housing Act, the bill Typeset opens by default. Route:
`app/workspace/typeset/bill/[id]/[[...view]]/page.tsx` →
`TypesetWorkspacePage` → `TypesetEditor` → `Document`.

Measured 2026-09-13, so nobody has to measure it again:

| what | number |
| --- | --- |
| HTML from `/api/typeset/content?item=article&bill=2058568` | 355 KB |
| elements in it | 4,378: 1,906 `<p>`, 259 `<h4>`, 204 `<h3>`, 69 `<h2>` |
| where it is parsed | the browser: `usePlateEditor({ plugins: EditorKit, value: html })`, on every mount and every re-key |
| plugins on that editor | all of `EditorKit`: 36 kits, among them Copilot, AI, Discussion, Comment, Suggestion, DnD, Cursor overlay, Block menu, Block placeholder, Slash, Autoformat, Emoji, Mention, Math, Media, Table, TOC, Docx and Markdown parsers, fixed and floating toolbars |
| second editor on the same page class | `StaticToolbar` (`typeset-toolbar.tsx`) builds a whole second Plate editor with the full `EditorKit` to draw a disabled toolbar on the Git, Diff, Versions and Fork views |
| dev inspector | mounted in `app/layout.tsx` in development; `inspector.tsx` registers capturing `mousemove` and `click` listeners on `window` (lines 586–587), `scroll` and `resize` listeners, and a `document.querySelectorAll("body *")` scan (line 347) |
| chunks the page ships in dev | 34.8 MB across 98 script/CSS files (`/bills` is 12.2 MB across 44) |
| server, warm, on the box | `/bills` 0.31 s; the typeset page HTML 0.76 s through the tunnel |
| tunnel | direct SSH, 4.7 MB/s (was SSM at 340 KB/s until this morning) |

The server is not the problem once a route is compiled, and the transfer is
now about seven seconds cold. What is left is the browser's work, and that is
where the time goes.

## Suspects, in the order to test them

Measure each before touching it. A suspect that measures clean is crossed off
in the report, not fixed anyway.

1. **Plugin cost per keystroke.** Slate runs every plugin's `decorate`,
   `normalizeNode` and `onChange` on every change; over 4,378 nodes, with 36
   kits, that is the first place to look. Bisect: mount the same document with
   the kits halved until the keystroke is instant, then name each kit's cost.
   A bill needs headings, paragraphs, marks, lists, links, tables, comments and
   suggestions. It does not need Copilot ghost text, AI, Math, Media upload,
   Docx and Markdown parsers, Mention, Date, Emoji, Callout, Column, Toggle,
   Slash, Autoformat or a block placeholder running on every change.
2. **DnD wraps every block.** `DndKit` gives each of the 4,378 blocks a
   draggable with its own handle and hooks. Measure the editor with it off.
3. **Block-level re-rendering.** Which element components re-render on a
   keystroke in a paragraph? Profile with React's profiler API
   (`<Profiler>` around `Editor`, or `react-dom`'s `onRender` counts) and
   name the components whose render count equals the block count. The
   template's node components carry hooks (`useBlockSelected`,
   `useDraggable`, comment and suggestion leaf decorators) that subscribe
   every block to state that changes on every keystroke.
4. **Cursor overlay, block selection, block menu.** Each tracks selection or
   the pointer across the whole document. Measure with each off.
5. **Parse on the main thread.** 355 KB of HTML deserialised and normalised
   in the browser before first paint. Options, in order of preference: do the
   HTML→Slate conversion on the server and ship JSON; cache the parsed value
   per bill and version; parse in a worker. Measure time-to-editable before
   and after.
6. **The inspector.** With inspecting off, its `mousemove` and `click`
   captures must return in microseconds and the `body *` scan must never run.
   Measure long tasks while moving the mouse over the editor with the
   inspector idle, then with it disabled entirely.
7. **The second editor.** `StaticToolbar` on the non-editor views. Measure
   view switching; if it costs, the fix is the lead's (it owns the file) —
   propose it.
8. **Polling and re-fetching.** `useBillSubject` fetches the bill for the
   chat drawer; `TypesetHistoryProvider`, `LocksProvider`, the assist panel
   and the customizer sit above the editor. Confirm nothing above the editor
   re-renders it on a timer or on unrelated state. `/workspace/data` polls
   once a minute (`use-folder.ts`); confirm Typeset does not.
9. **The Comment button.** "Took forever to load": measure click → draft
   comment UI. The comment and discussion kits render into every block; find
   out what the first click pays for.
10. **Dev-mode weight.** React's development build, Turbopack HMR, 98 chunks,
    source maps. The dev server must itself be instant, so this is the last
    suspect, not the first. Do not run a production build anywhere without
    asking Brendan; there are no local builds, ever, on the Mac.

## What "done" means

All of these, measured on H.R. 6644 in Typeset on the dev box, reported with
the numbers and the method:

| measure | bar |
| --- | --- |
| keystroke → DOM paint, p95 over 50 keystrokes in a paragraph mid-document | under 16 ms |
| toolbar button click → its UI (Comment → draft, Editing → menu), p95 | under 16 ms |
| long tasks (over 50 ms) while typing, and while idle with the mouse moving | none |
| cold load → editable, through the tunnel, route already compiled | under 5 s |
| HMR after an edit to a plate file → page usable | under 5 s |
| memory of the page tab after ten minutes of editing | flat, not climbing |

Brendan is the final judge, in his own browser, on the dev box. Numbers are
how the session earns the right to say "instant"; his fingers decide.

## How to measure

There is a dev server and Brendan reviews in his own browser, so the standing
rule is: stop at "the page compiles". This task is the exception that rule
names — proof of a specific behaviour — because a keystroke's latency cannot
be read from a curl. Measure with instrumentation the page itself reports
(`performance.mark`/`measure` around Slate's `onChange` and the next paint,
`PerformanceObserver` for `longtask`, React's `<Profiler>`), and with a
headless Chromium trace against `localhost:3001` when that is the only way to
get a number. Keep headless runs short and few: each one compiles routes and
occupies the box. Never screenshot for design review; that is Brendan's.

Baseline first, on the untouched page, and write the baseline to the report
before changing anything. Then one change at a time, measured, kept or
reverted on the number.

## The box

The dev server Brendan watches on `localhost:3001` runs on EC2 `govblock-dev`
(`i-0b5e3556a1fa8f1d4`, us-east-1, t4g.2xlarge since this morning), not on
the Mac. Read the memory note `govblock-dev-box.md` in
`~/.claude/projects/-Users-brendanstanton-Code-govblock/memory/` whole before
touching it. The short form:

- SSH host `govblock-dev-direct` for anything bulky (public IP, port 22 open to
  this Mac only); `govblock-dev` (SSM) for control. The tunnel is
  `ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 3001:127.0.0.1:3000 govblock-dev-direct`.
  If nothing answers, the box has probably stopped itself (an hour idle):
  `~/bin/govblock-dev-up`.
- The server is `govblock-dev.service`; restart with
  `sudo systemctl restart govblock-dev`, never `pkill`. Tell the lead after
  every restart; two other sessions are watching the same server.
- Sync **only your files**: from `apps/web`,
  `ssh govblock-dev-direct "cd ~/govblock/apps/web && git status --short <your files>"`
  must be empty for your files first, then
  `rsync -av --relative <your files> govblock-dev-direct:~/govblock/apps/web/`.
  Never push a branch to the box, never checkout or stash there: its tree is
  three sessions' uncommitted work.
- After syncing, curl the route so Turbopack compiles it, then read
  `sudo journalctl -u govblock-dev --since "5 min ago"` for `⨯` and
  `Module not found`.
- Do not go roomier than the unit's current limits and do not warm every
  route; that put the box 6.5 GB into swap this morning. Warm
  `~/warm-short.txt` only.

## Type-checking

A hook blocks whole-project `tsc` and any `eslint`. Check changed files with
a small node script that calls `ts.createProgram` on the app's tsconfig
options with only the changed files as roots, run under
`node --max-old-space-size=2048` from `apps/web` (memory note
`bounded-typecheck.md`). Do this after every edit to TSX; the dev server
compiles but never type-checks, and Amplify is otherwise the only gate.

## The report

`apps/web/docs/typeset-perf.md`, kept current as the work goes, in the third
person, with no "I": the baseline table, each suspect with its number and its
verdict, each fix with before and after, and the final table against the bars
above. Brendan's headline style: state the fact, no hedging, no "the".

## Posture

Nothing about the editor's feature set is sacred except what a bill needs;
nothing about the template's defaults is sacred at all. If a kit costs a
frame, it goes, and the lead is told so it can decide whether the toolbar
still shows its button. If the fix is to parse on the server, build it. If
the fix is to write a windowed renderer for Slate, write it. Every number in
the done table is a floor, and the measure of this session is how far under
it lands.
