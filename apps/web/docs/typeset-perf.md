# Typeset performance

Brief: `docs/prompts/2026-09-13-typeset-instant.md`. Page: `/workspace/typeset/bill/2058568`
(H.R. 6644) on the dev box, `localhost:3001` through the direct tunnel.

## Method

One headless Chromium (Chrome for Testing 1234, Playwright) on Brendan's Mac (M2, 8 GB),
1440×900, against `http://localhost:3001`. `127.0.0.1:3001` does not work: Next 16 refuses
dev resources to that origin, the page never hydrates and the HMR socket fails.

Numbers come from instrumentation inside the page; nothing is read off a screenshot.

- **Keystroke → paint.** A capturing `keydown` listener stamps `event.timeStamp`; a
  `MutationObserver` on the editor stamps the first DOM change after it, then
  `requestAnimationFrame` → `MessageChannel` stamps the moment after that frame. Checked
  against the Event Timing API (`PerformanceObserver` type `event`, `interactionId` max
  duration), which agrees within 20 ms. 50 characters typed at the end of the middle
  paragraph over 80 characters long, 150 ms apart.
- **Long tasks.** `PerformanceObserver` type `longtask`, buffered from navigation.
- **Toolbar.** Pointer and click events dispatched on the button in the page; the clock stops
  after the frame in which the Comment popover (`[data-radix-popper-content-wrapper]` holding
  the draft form) or the Editing menu (`[role=menu]`) exists.
- **Cold load → editable.** Navigation start to the end of the last long task before 1.5 s
  with none, with more than 1,000 Slate elements in the DOM. Route already compiled.
- **Re-renders.** A minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` installed before React loads
  counts function components that performed work in each commit, skipping subtrees React
  bailed out of, and attributes each render to the nearest ancestor that re-rendered on its
  own (props unchanged: state, context or a store). Separate run, so it does not touch the
  latency numbers.
- **CPU.** Chrome DevTools Protocol sampling profiler, 200 µs, over 20 keystrokes.

## Baseline

Taken 2026-09-13, 09:15–09:40 UTC, on the page as the lead and Brendan left it (toolbar above
a row of editor and actions aside, `BILL_KIT` = `EditorKit` without `fixed-toolbar`).
Three runs; the table gives the first full run, the others agree within 10%.

| measure | baseline | bar |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max (50 keys) | 504 / 608 / 1,487 ms | p95 < 16 ms |
| keystroke → DOM text change, p50 / p95 | 15 / 26 ms | |
| long tasks while typing 50 keys | 51, 23.5 s in total | none |
| long tasks, 5 s of mouse moving over the editor, idle | 3, 1.6 s in total | none |
| Comment click → draft form | 3,317 ms (one 3.2 s task) | < 16 ms |
| Editing click → menu | 1,823 ms (one 1.4 s task) | < 16 ms |
| cold load → editable | 16.6 s | < 5 s |
| JS heap: loaded / after 50 keys | 650 / 992 MB | flat |

Cold load, in order: HTML at 0.6 s, `load` at 4.8 s (209 script and CSS files, 6.1 MB
compressed), bill HTML requested at 5.1 s and back at 6.7 s (350 KB), editor in the DOM at
14.9 s, main thread free at 16.6 s. One task of 6.5 s parses the HTML and mounts the
editor.

Document as Slate sees it: 3,023 elements (1,906 paragraphs, 90 blockquotes, 259 `h4`, 204
`h3`, 147 `h5`, 109 `h6`, 69 `h2`, 238 links), 51,496 DOM nodes on the page. Slate's chunking
is on (`content-visibility: auto`).

## Where a keystroke goes

Every keystroke re-renders **`BlockCommentContent` 3,023 times**, once for every element in
the document, and nothing else re-renders more than a dozen components. Each of those renders
starts itself: `useBlockDiscussionItems` calls `useEditorVersion()`, which changes on every
edit, and the component then walks its block three times (`comment.node`, `comment.nodes`,
`suggestion.nodes`) and rebuilds `blockPath`, which defeats its own `useMemo`.

CPU over 20 keystrokes (15.8 s sampled, 3.5 s idle): React rendering 7.1 s, of which
`BlockCommentContent` 4.2 s and its node walks 1.2 s; development double renders
(`renderWithHooksAgain`) 2.2 s; `program` 3.1 s; garbage collection 0.6 s.

## Suspects

| # | suspect | number | verdict |
| --- | --- | --- | --- |
| 0 | request flood on the box | 08:58–09:00: ~5 requests/s of `/` and the typeset page. Caught live at 09:32:25–51 after a write from this session: 330 GETs of `/` only, ~13/s, one after another, Brendan's Chrome the only client on 3001 | A tab on `/` refetches in a loop after every server-side HMR, then stops by itself. Not caused by Typeset; source inside the home page not found. Open |
| 1 | plugin cost per keystroke | bench: kits beyond a bill's needs 20 ms a key; Plate's core navigation feedback 18 ms | guilty; fixed (fixes 2, 4) |
| 2 | DnD wraps every block | 30,000 DOM nodes, 2.3 s of mount, 150 MB; 7 ms a key | guilty; fixed (fix 3) |
| 3 | block-level re-rendering | `BlockCommentContent` × 3,023 per keystroke, self-triggered by `useEditorVersion`; then 66 from the table menu | guilty; fixed (fixes 1, 5). Now 60 components a keystroke |
| 4 | cursor overlay, block selection, block menu | block selection and menu 6 ms a key with slash, autoformat, emoji, mention, date and placeholder; cursor overlay under 1 ms with AI and parsers | block selection and menu out (fix 4); cursor overlay kept |
| 5 | parse on the main thread | parse 0.3 s, mount 1.1 s (bench); 1.9 s task on the page | server-side JSON crossed off (0.3 s of a 7.5 s load); parse kept per bill and version, and mount a screen at a time (fix 8) |
| 6 | inspector | idle mouse over the editor: 3 long tasks, 1.6 s before fixes; 0–1 (≤ 57 ms) after fixes 2–4 with the inspector still mounted | crossed off: the long tasks came from the editor, not the inspector's listeners |
| 7 | second editor (`StaticToolbar`) | built from the full `EditorKit` on Git, Redline, Diff and Fork | not measured; the lead session now builds it from BillKit |
| 8 | polling and re-fetching | 0 components re-render between keystrokes; no timer re-renders the editor | crossed off for Typeset; see 0 for `/` |
| 9 | Comment button | 3.3 s → 138–177 ms | partly fixed (fixes 1–4, 7). What is left: two forced style recalcs of the visible page (~25 ms each, see below), floating-ui positioning, Slate's DOM selection read, dev React |
| 10 | dev-mode weight | 209 files, 7.1 MB, `load` at 4.3 s; StrictMode second render ~28% of React's keystroke time | open; needs a server restart, Brendan's call |

## Fixes

### 1. Discussion wrapper renders one block, not 3,023

`lib/block-discussion-index.ts`, `components/plate/ui/block-discussion.tsx`,
`components/plate/editor/plugins/discussion-kit.tsx`. Landed on the box 09:32 UTC.

- One store per editor holds each block's discussions and suggestions, keyed by block id.
  Discussion plugin's `useHooks` rebuilds it 120 ms after edits stop; a rebuild walks only
  blocks that carry comment or suggestion props (cached per immutable block object) and keeps
  the identity of unchanged items.
- Each top-level block reads its own entry with `useSyncExternalStore` and one boolean
  (`commentingBlock` is this block). With nothing to show it returns the plain wrapper; the
  popover, its three node walks and its four option subscriptions mount only on a block with
  items or a draft comment. Nested blocks get no wrapper.

| measure | before | after |
| --- | --- | --- |
| `BlockCommentContent` renders per keystroke | 3,023 | 0 |
| keystroke → paint, p50 / p95 / max | 504 / 608 / 1,487 ms | 139 / 159 / 204 ms |
| long tasks while typing 50 keys | 51, 23.5 s | 50, 5.5 s |
| Comment click → draft form | 3,317 ms | 2,014 ms |
| JS heap after 50 keys | 992 MB | 719 MB |

What a keystroke still costs, 20 keys profiled: native time outside JavaScript (`program`)
3.2 s, React 1.4 s (Slate's `ChunkAncestor` re-mapping its chunk's children 0.74 s), Jotai
recomputing dependents of Plate's editor atom 0.5 s, `Editor.fragment` 0.18 s.

### 2. Chunks of 20 blocks, no navigation feedback

`components/workspace/typeset-editor.tsx` (`Document`'s `usePlateEditor` and `Editor`).
Landed on the box after 12:30 UTC.

- Slate re-maps every block of the chunk an edit lands in. Plate's default chunk is 1,000
  blocks, so each keystroke built and compared 1,000 element props; at 20 the path from root to
  leaf re-maps a few dozen. Bench, same kit: p50 134 ms at 1,000, 82 ms at 100, 77 ms at 20.
- Plate's core navigation-feedback plugin injects `useNavigationHighlight` into every element,
  one Jotai `selectAtom` per element on the editor atom, so each change recomputed 3,023
  selectors (0.5 s of 20 keys). A bill never jumps to a flashed target; `navigationFeedback:
  false`. Bench: p50 77 → 59 ms.
- Lowest chunks render with `content-visibility: auto` and `contain-intrinsic-size: auto 1000px`,
  so chunks not yet drawn keep a height and the scrollbar does not jump.

| measure | after fix 1 | after fix 2 |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max | 139 / 159 / 204 ms | 60 / 64 / 85 ms |
| long tasks while typing 50 keys | 50, 5.5 s | 50, 2.9 s |
| long tasks, 5 s of mouse moving, idle | 3, 1.6 s | 1, 0.1 s |
| Comment click → draft form | 2,014 ms | 392 ms |
| Editing click → menu | 1,763 ms | 104 ms |

### 3. No drag and drop on a bill

`components/workspace/typeset-editor.tsx`: `BILL_KIT` leaves out `dnd` as well as
`fixed-toolbar`. No toolbar button uses it. Table rows, columns and images call `useDraggable`
and `useDropLine`, which return empty without the plugin.

| measure | after fix 2 | after fix 3 |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max | 60 / 64 / 85 ms | 53 / 56 / 75 ms |
| long tasks while typing 50 keys | 50, 2.9 s | 30, 1.6 s |
| Comment click → draft form | 392 ms | 221 ms |
| Editing click → menu | 104 ms | 75 ms |
| cold load → editable | 15.6 s | 9.6 s |
| mount task | 5.9 s | 3.3 s |
| DOM nodes / heap after load | 51,584 / 628 MB | 21,974 / 326 MB |

### 4. BillKit

`components/plate/editor/editor-kit.tsx` (new `BillKit`), `typeset-editor.tsx` (`BILL_KIT =
BillKit`), `fixed-toolbar-buttons.tsx` and `floating-toolbar-buttons.tsx` (a button whose kit
the editor lacks is not drawn). `EditorKit` is unchanged, so the template editor and
`StaticToolbar` keep every kit and every button.

In: basic blocks, table, link, basic marks, font colour and background, list, align, line
height, discussion, comment, suggestion, cursor overlay, exit break, trailing block, Docx and
Markdown (import and export use them; they do nothing while typing), floating toolbar.

Out: Copilot, AI, code block, toggle, TOC, media, callout, columns, math, date, mention, slash,
autoformat, block selection and block menu, drag and drop, emoji, block placeholder, font size
and family.

Buttons no longer drawn on a bill: AI commands (fixed and floating), font size, toggle, emoji,
media, inline equation (floating). Insert and Turn into still list code block, toggle,
columns and the rest; choosing one inserts a block with no component, as Excalidraw already did
in the template.

Superseded the same afternoon by Brendan's ruling: every button is drawn again on every view,
and a button whose kit BillKit leaves out loads that kit when it is used (hover fetches the
code, the click adds the kit and rebuilds the editor from the live value;
`lazy-kit-button.tsx`, `lib/typeset/lazy-kits.tsx`, built by the lead session). BillKit stays
the base kit.

| measure | after fix 3 | after fix 4 |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max | 53 / 56 / 75 ms | 36 / 43 / 62 ms |
| long tasks while typing 50 keys | 30, 1.6 s | 1, 54 ms |
| long tasks, 5 s of mouse moving, idle | 1, 57 ms | 0 |
| Comment click → draft form | 221 ms | 235 ms |
| Editing click → menu | 75 ms | 77 ms |
| cold load → editable | 9.6 s | 8.8 s |
| mount task | 3.3 s | 1.9 s |
| heap after load / after 50 keys | 326 / 430 MB | 264 / 271 MB |

### 5. Toolbar reads nothing it does not show

- `use-selection-block-prop.ts` (new) replaces Plate's `useSelectionFragmentProp` in
  `turn-into-toolbar-button.tsx`, `align-toolbar-button.tsx` and
  `line-height-toolbar-button.tsx`. Plate's hook copies the selection's fragment on every
  change; with the caret collapsed the new one reads the prop of the block the caret is in, and
  an expanded selection reads its fragment as before.
- `table-toolbar-button.tsx`: the menu's `tableSelected` and `useTableMergeState` move into a
  `TableMenu` mounted only while the menu is open. The merge state returned a fresh array on
  every change and re-rendered the menu's 66 components per keystroke.

| measure | after fix 4 | after fix 5 |
| --- | --- | --- |
| keystroke → paint, p50 / p95 / max | 36 / 43 / 62 ms | 23.5 / 28 / 45 ms |
| long tasks while typing 50 keys | 1, 54 ms | 0 |
| components rendered per keystroke | 66 from the table menu, plus the typed block | 60 in all, the typed block and its chunk path |
| Comment click → draft form | 235 ms | 221 ms |
| Editing click → menu | 77 ms | 80 ms |

### 6. Bill text preloaded from the HTML

`typeset-editor.tsx`: `useContent` calls React's `preload(url, { as: "fetch", crossOrigin:
"anonymous" })` while rendering, so the server-rendered page carries `<link rel="preload"
as="fetch">` and the browser requests the bill's text while it parses the HTML. The effect's
`fetch` of the same URL takes the preloaded response; the page makes one request, not two.

| measure | after fix 5 | after fix 6 |
| --- | --- | --- |
| bill text requested / received | 2.9 s / 5.5 s | 0.8 s / 2.3 s |
| editor in the DOM | 7.8 s | 6.9 s |
| cold load → editable | 8.3 s | 7.5 s |

Text now arrives before the scripts do (`load` at 4.3 s). What is left of the cold load is
development JavaScript (209 files, 7.1 MB, `load` at 4.3 s, then hydration) and one 1.9 s task
that parses the bill and mounts 3,023 blocks. Bench marks around `usePlateEditor`: parse
0.3 s, mount 1.1 s, and a second 0.3 s parse after mount.

### 7. Comment popover mounts beside the block

`block-discussion.tsx`: the block's content keeps its place in the tree whether or not the
block is being discussed. Before, clicking Comment swapped `<div>{children}</div>` for a
popover wrapping the children, and React remounted the whole block. The popover and its count
badge now render after the content in the same `div` (`relative` while discussed; the badge
sits at `absolute top-0 left-full`, where the flex row used to put it).

| measure | after fix 6 | after fix 7 |
| --- | --- | --- |
| Comment click → draft form | 241 ms | 138–177 ms |

### 8. Editor mounts a screen at a time, from a parsed value it keeps

- `components/plate/ui/editor.tsx`: `renderProgressiveChunk`. The first 8 of Slate's lowest
  chunks render with the editor; every other chunk starts as a placeholder of 1,000 px and
  renders one per idle callback, inside `startTransition` so back-to-back releases never add up
  to a long task. A chunk nearing the scroll container's viewport (an `IntersectionObserver` on
  the container, 200% margin) goes to the front of the queue. Chunks created after mount (an edit
  splits one) render at once. Until a chunk renders, find-in-page and selection cannot reach its
  text.
- `components/plate/editor/editor-kit.tsx`: `billValue(key, html)` parses a bill's HTML with
  BillKit once per key (bill, version) and keeps the last four values; the next editor for that
  key starts from the parsed value. Slate never mutates nodes, so editors share it.
- Wired into `typeset-editor.tsx` (Typeset) and `potion-editor.tsx` (Outline) by the lead
  session, which also made both views share one in-flight content request per key.

Bench, same kit:

| measure | before | after |
| --- | --- | --- |
| mount task | 2,039 ms | 504 ms |
| HTML received → editor mounted | 1,470 ms | 382 ms |
| whole document rendered | at mount | +2.5 s after mount |
| long tasks while the rest renders | — | 0 |

Real page, timed from the sidebar click, "first screen" = more than 50 blocks in the editor:

| switch | first screen | whole document |
| --- | --- | --- |
| Outline → Typeset | 1.33 s | 4.5 s |
| Typeset → Outline | 1.6–1.8 s | 8.1–8.6 s |
| Git → Typeset | 1.09 s | 4.4 s |
| Typeset → Git | 0.36 s (quiet) | |
| cold load | 3.8 s | 8.0 s |

Before this fix a switch to Typeset took 8 s or more to an editable page. Of the 1.1–1.3 s left,
0.8–0.9 s passes between the click and the URL changing: the route's server round trip in
development. Leaving Typeset for Outline also unmounts 3,023 blocks, a 435–613 ms task.

### 9. Highlight.js and faker load only when used

- `plugins/lowlight.ts` (new) loads `lowlight`'s grammars with `import()`. `CodeBlockKit`
  loads them when a top-level code block is in the document and then redecorates;
  `BaseCodeBlockKit` loads them when a static editor is built. Checked on the bench: no grammar
  requests on a bill; a JavaScript code block inserted into the editor fetches them and shows
  `hljs-keyword` spans.
- `use-chat-samples.ts` (new) holds the template's fake AI answers, the only user of
  `@faker-js/faker`, and `use-chat.ts` imports it when `/api/ai/command` fails.

| Typeset page | before | after |
| --- | --- | --- |
| JavaScript and CSS, decoded / encoded | 42.2 / 7.0 MB | 39.8 / 6.5 MB |
| highlight.js grammars (1.5 MB), faker (0.6 MB) | loaded | not loaded |

Emoji data stays in `EmojiKit`: the kit itself is loaded on demand in Typeset and Outline, and
Plate keeps the first emoji library it is given for the session, so data loaded after the kit
could be ignored.

### 10. Template editor and export code off the bill page

By the lead session: `typeset-editor.tsx` loads `PlateEditor` (the no-bill template, every
kit) through `next/dynamic`; `export-toolbar-button.tsx` and `import-toolbar-button.tsx` import
`@platejs/docx-io`, the base editor kit and the docx export kit inside their click handlers;
the on-demand toolbar buttons (AI, emoji, font size, media, toggle, equation) are
`next/dynamic` too. On its own this changed nothing measurable: the bundle stayed at 39.7 MB,
because of fix 11.

### 11. BillKit in its own module

`components/plate/editor/bill-kit.tsx` (new) holds `BillKit` and `billValue` and imports only the
kits a bill uses; `editor-kit.tsx` re-exports both. Tracing the page's own chunks showed why fix
10 moved nothing: `typeset-editor.tsx`, `potion-editor.tsx` and `typeset-toolbar.tsx` imported
`BillKit` from `editor-kit.tsx`, which statically imports every kit for the template's
`EditorKit`, and development builds do not tree-shake. The three imports now point at
`bill-kit.tsx`. In the same pass, in this session's files: `cursor-overlay.tsx` reads the AI
plugin's `streaming` option by key instead of importing `@platejs/ai`, and `MarkdownKit` loads
remark-math, remark-gfm and remark-emoji after the editor mounts (checked: a GFM table, `:smile:`
and `$x^2$` parse and serialize once they have arrived).

JavaScript and CSS loaded by each view, decoded / encoded, route compiled:

| view | before fixes 9–11 | after |
| --- | --- | --- |
| Typeset | 42.2 / 7.0 MB | 29.1 / 4.9 MB |
| Outline | | 29.6 / 5.0 MB |
| Git | 43.1 / 7.0 MB | 32.6 / 5.5 MB |
| Diff | 43.0 / 7.0 MB | 32.5 / 5.5 MB |

No longer loaded with any of them: KaTeX, the AI SDK and zod, emoji-mart data and emojilib,
xmlbuilder2, highlight.js, faker. Still loaded: acorn and micromark (`@platejs/markdown` itself
imports remark-mdx) and parse5 (juice, in `DocxKit`). The per-view figures above include
Monaco's `editor.api`, 3.6 MB that arrives 5–7 s after load on every view: it is development
only, from the second dev inspector (`components/dev/trace.tsx` → `@react-trace/kit` →
`@monaco-editor/react`, loaded with `next/dynamic`), and resolves to a 254-byte stub in
production. Without it: Typeset 25.5 MB, Outline 26.0 MB, Git 29.0 MB, Diff 28.9 MB decoded.

Cold load, two runs: `load` at 2.6–2.9 s (was 4.3 s); first screen 3.7 s when the bill's text
came back in 1.2 s, 5.3 s when it took 4.1 s. Switches: Outline → Typeset 1.0–1.4 s, Git →
Typeset 0.9 s to first screen.

### 12. Bill text cached and gzipped by its route

`app/api/typeset/content/route.ts`: the article's JSON is kept per bill and version for ten
minutes (16 kept; a bill whose text has not been fetched is not kept) and served gzipped when the
request accepts it. The bill lookup and the reader's gate still run on every request. The
development server compresses scripts but not route responses. The lasting fix, Slate JSON per
document version stored at ingest, is with Brendan.

| `/api/typeset/content?item=article&bill=2058568`, warm | before | after |
| --- | --- | --- |
| on the box | 0.60–0.66 s | 0.05 s |
| through the tunnel | 0.56–0.93 s, 358 KB | 0.16–0.25 s, 76 KB |

Cold loads taken around this change moved with the shared dev server rather than with the
change: time to first byte 0.8–2.4 s and `load` 3.6–4.9 s across runs, against 0.7 s and
2.6–2.9 s an hour earlier, with other sessions compiling. First screen 5.1–5.7 s in those runs.
Switches were steady: Outline → Typeset 1.0–1.3 s, Git → Typeset 1.0 s, Typeset → Outline
1.4–1.9 s to first screen.

### 13. Bill document built on the server: HTML, Slate value and snapshot

`lib/typeset/document.ts` (new, server-only): `getTypesetDocument(billId, version?, bill?)` →
`{ html, value, snapshot, documentId, version, date }`, and `billStaticKit`, the static side of
BillKit. The article builder moved here from the content route, which now calls it; the lead
session's server page consumes it. Cached per bill and version for ten minutes.

- **New dependency: `linkedom`** (apps/web). Plate's HTML deserializer needs `Node` and
  `DOMParser`, which the server does not have. `linkedom` supplies them for the one synchronous
  deserialize call and the globals are restored straight after, so nothing else in the server
  process sees a DOM. On H.R. 6644 in Node: parse 34 ms, deserialize 155 ms, and the value matches
  the browser's parse element for element (1,906 p, 259 h4, 204 h3, 147 h5, 109 h6, 90 blockquote,
  69 h2, 238 links).
- `value` is available from the content route with `&value=1` (154 KB gzipped with the HTML,
  against 76 KB without), and `billValue` accepts it, so an editor can skip parsing.
- `snapshot` is the value drawn by the editor's static components (`EditorStatic`,
  `billStaticKit`) with data attributes stripped, for a page to show before the editor mounts.
  Measured with a dev-only probe (`/dev/typeset-bench/snapshot`, which refuses to run above 60% of
  the heap limit): 1.34–1.80 s per render in development, synchronous; 120–180 MB of garbage per
  render, all reclaimed (five renders took used heap from 713 to 1,716 MB, and it fell back to
  756 MB within 20 s); 1,542 KB with data attributes, 1,082 KB without (155 and 140 KB gzipped),
  against 349 KB of article HTML. Built once with the document, never per request.

The lead session's first page wiring handed the static element tree from the server component
into a client component's props. React Flight serialized it as a tree and the dev server died
twice with "JavaScript heap out of memory" at its 4 GB limit (18:31:45 and 18:35 UTC, the second
80 s after systemd restarted it, while compiling the page); the first crash's core dump briefly
filled the disk. The wiring was pulled; the page now takes the snapshot string.

With the string, the bill's text lands twice in the document response: once as markup in the
server-rendered slot and once, JSON-escaped, in the Flight payload that hydrates it. Accepted for
now; serving the snapshot from its own request is the fallback if the payload matters on real
connections.

Real page with the snapshot, headless, a fresh browser context ("cold", route compiled) then a
second load in the same context ("warm"). "Bill in the DOM" is the first frame with the
snapshot's headings; "editable" is the live editor (`contenteditable`) with more than 50 blocks,
the moment it takes over the slot.

| | time to first byte | bill in the DOM | first contentful paint | editable |
| --- | --- | --- | --- | --- |
| Typeset, cold | 0.78 s | 1.26 s | 1.61 s | 4.57 s |
| Typeset, warm | 0.78 s | 1.07 s | 1.12 s | 3.29 s |
| Outline, cold | 0.70 s | 1.23 s | 1.58 s | 5.20 s |
| Outline, warm | 0.73 s | 0.87 s | 0.92 s | 3.35 s |

The bill is on screen with the first paint. The document response is 338 KB gzipped (2.76 MB
decoded) and took 0.97 s through the tunnel, 0.70 s of it before the first byte. An earlier cold
run of the same page reached editable at 8.4 s with `load` at 7.0 s; cold numbers still move with
the shared server.

### 14. Stored documents (code in place, table not yet created)

- `sql/004_typeset_documents.sql`: `typeset_documents` keyed by document id, with the HTML, value
  and snapshot gzipped, their sizes, the builder version and `built_at`. Gzipped because the site
  reads Aurora over the RDS Data API, which refuses a result over 1 MB; H.R. 6644 is 348 KB of
  HTML, 460 KB of value and 1.1 MB of snapshot before gzip, 73, 77 and 140 KB after.
- `lib/typeset/document-store.ts`: reads and writes each column in base64 slices of 600 KB. A row
  is written with `builder` 0 and marked with `TYPESET_BUILDER` only when every slice is in, so a
  reader never takes half a row; raising `TYPESET_BUILDER` rebuilds older rows on read.
  `getTypesetDocument` reads the stored row for the newest document with text (or the named
  version) and builds only on a miss, storing the result behind the reader. With no table, every
  store call fails quietly and the document is built as before; the dev log says so once.
- `app/api/typeset/documents/route.ts` builds and stores one bill version and waits for the write;
  open in development, behind `TYPESET_BACKFILL_TOKEN` anywhere else.
- `scripts/typeset/backfill.mjs`: `--bill`, `--state`, `--session`, `--limit`, `--dry`, `--force`,
  `--origin`; resume by default (skips documents stored under the current builder). Dry run for
  H.R. 6644: one bill, document -205856809, to build.
- The snapshot's root no longer carries `data-slate-editor` (the strip leaves it on the root); it
  carries `data-typeset-snapshot`, so code that looks for the editor before hydration does not find
  the snapshot.

The table is not created: it goes into the production Aurora cluster, and waits for Brendan.

## TocKit

Bench, BillKit-equivalent kit, chunk 20, progressive mount, 40 keys: keystroke → paint p50 26.4 →
27.5 ms and p95 29.6 → 32.0 ms with `TocKit` added, no long tasks. About 1–2 ms a keystroke, so
Typeset can carry it when Outline becomes one of its modes.

## HMR

A line appended to `components/plate/ui/paragraph-node.tsx` on the box, page open headless:
Fast Refresh starts 0.2 s after the write, finishes in 530 ms, and the page is usable 0.8 s
after the write, with the same editor instance (no remount, no reparse). The file was restored
straight after.

## Where it stands

Page as of 13:30 UTC (keystrokes, clicks, heap) and after fix 9 (load and switches), headless Chromium on the Mac, same method as the baseline.

| measure | baseline | now | bar |
| --- | --- | --- | --- |
| keystroke → paint, p50 / p95 | 504 / 608 ms | 22–24 / 28–33 ms | p95 < 16 ms |
| Comment click → draft form | 3,317 ms | 138–177 ms | < 16 ms |
| Editing click → menu | 1,823 ms | 70–80 ms | < 16 ms |
| long tasks while typing 50 keys | 51, 23.5 s | 0 | none |
| long tasks, 5 s of mouse moving, idle | 3, 1.6 s | 0–1 (≤ 57 ms) | none |
| cold load → first screen editable / whole document, route compiled | 16.6 s | 3.8 / 8.0 s | < 5 s |
| Outline or Git → Typeset, first screen | 8 s or more | 1.1–1.3 s | |
| HMR after a plate file edit → usable | not taken | 0.8 s | < 5 s |
| heap: loaded / after 50 keys | 650 / 992 MB | 253 / 258 MB | flat over 10 min |
| DOM nodes | 51,496 | 21,880 | |

Ten minutes of editing was started and stopped before it finished; the heap is flat across 50
keys, not yet across ten minutes.

## Open

1. **Style recalculation of the whole visible page on any `data-state` change.** Toggling
   `data-state` on one toolbar button forces a 15–27 ms style recalc of 1,586 elements. Chrome's
   invalidation trace names the root layout `div` (`group/layout … has-data-[slot=designer]:h-svh
   has-data-[slot=inbox]:…`, `app/layout.tsx`, auth-scope's file) as "affected by :has()" and
   invalidates its subtree; `group/sidebar-wrapper has-data-[variant=inset]` and `site-header`'s
   `group-has-[[data-slot=…]]/layout` do the same. Every tooltip, dropdown and popover open or
   close pays it, which is the lag moving across toolbar buttons and most of what the Comment
   click still costs. Stripping those classes at runtime cut it only to 12 ms because Chrome keeps
   the flags, so the proof is a change to the layout, not a runtime experiment.
2. **StrictMode.** React's development double render is about 28% of React's keystroke time and
   parses the bill a second time on mount. `reactStrictMode: false` in `next.config.ts` needs a
   dev-server restart and changes development for every session on the box.
3. **Unmount and route round trip.** Mount is a screen at a time (fix 8); leaving Typeset still
   unmounts every block in one task (435–613 ms), and a switch waits 0.8–0.9 s on the route's
   development server render before anything changes.
4. **Development JavaScript.** 208 files, 6.5 MB encoded, 39.8 MB decoded. Still on the page
   with it: KaTeX (0.8 MB), the AI SDK (0.8 MB), emoji data (0.5 MB), acorn (0.5 MB), and
   xmlbuilder2 (1.1 MB) with parse5 (0.5 MB). They come in through `PlateEditor`, the
   template editor, which `typeset-editor.tsx` imports statically for the no-bill case and which
   pulls in `EditorKit`, and through `export-toolbar-button.tsx`, which imports `BaseEditorKit`
   and `@platejs/docx-io` for export. Both files belong to the lead session.
5. **Insert and Turn into** still list blocks a bill's editor lacks (code, toggle, columns);
   choosing one inserts a block with no component. Hiding those items changes the template
   editor's menus too.
6. **Server render throws** `useAssistPanel must be used within AssistPanelProvider`
   (`typeset-workspace-2.tsx`) on the first render after a compile; the lead's unshipped fix is in
   `lib/assist-panel.tsx` on the Mac.
7. **Flood on `/`** after each server-side HMR (suspect 0).

## Bench bisection

`/dev/typeset-bench` (dev only): same bill, `Editor` and toolbar, plugins dropped by key from
`?drop=`, `?chunk=`, `?nav=0`, `?toolbar=0`. p50 keystroke → paint with chunk 20 and no
navigation feedback, 40 keys each:

| variant | p50 | long tasks / mount task / DOM nodes / heap |
| --- | --- | --- |
| all kits | 59 ms | 30 / 5.7 s / 51k / 572 MB |
| without DnD | 52 ms | 17 / 3.4 s / 22k / 418 MB |
| without DnD, Copilot, AI, cursor overlay, Markdown, Docx | 51 ms | 17 |
| without DnD, block selection and menu, placeholder, floating toolbar, slash, autoformat, emoji, mention, date | 46 ms | 2 |
| without DnD, code block, toggle, media, callout, columns, equations, footnotes, font size and family, kbd | 42 ms | 0 |
| all of those dropped | 33 ms | 0 / 2.0 s / 22k / 254 MB |
| all of those dropped, no toolbar | 22 ms | 0 |

What the smallest kit still pays per keystroke (20 keys traced): React's render and commit in
the input event 18 ms, Slate applying the operation and normalising 11 ms; style, layout and
paint under 2 ms. Toolbar selectors add 10 ms, most of it `useSelectionFragmentProp` calling
`editor.api.fragment` on every change, and `TableToolbarButton` re-rendering 66 components.
