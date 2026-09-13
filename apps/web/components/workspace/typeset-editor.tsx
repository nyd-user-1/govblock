"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { preload } from "react-dom"

import type { TRange, Value } from "platejs"
import { Plate, usePlateEditor } from "platejs/react"
import { Toaster } from "sonner"

import { BillKit, billValue } from "@/components/plate/editor/bill-kit"
import { Editor, EditorContainer, renderProgressiveChunk } from "@/components/plate/ui/editor"
import { FixedToolbar } from "@/components/plate/ui/fixed-toolbar"
import { FixedToolbarButtons } from "@/components/plate/ui/fixed-toolbar-buttons"
import { TypesetActionsAside } from "@/components/workspace/typeset-actions-aside"
import { BillSkeleton } from "@/components/workspace/bill-skeleton"
import { PotionOutline } from "@/components/workspace/potion-outline"
import { TocKit } from "@/components/plate/editor/plugins/toc-kit"
import { LazyKitsProvider, useLazyKitState, type LazyKit } from "@/lib/typeset/lazy-kits"

// The template's own playground, drawn only when no bill is open; loaded then,
// so its every-kit editor (KaTeX, the AI SDK, emoji data, acorn) stays off
// the bill page (2026-09-13).
const PlateEditor = dynamic(() => import("@/components/plate/editor/plate-editor").then((m) => m.PlateEditor), { ssr: false, loading: () => <BillSkeleton /> })

// The Typeset editor (Brendan, 2026-09-09): Plate's playground editor, as the
// template ships it — its fixed toolbar under the shell's header, the centred
// column, every kit — opened on one of the bill's pages. With no bill in the
// URL it is the template's own placeholder document, untouched, so the two
// can be held side by side (Brendan: "a 1:1 comparison"). A page arrives as
// HTML from /api/typeset/content and Plate reads it in; a new page or bill
// rebuilds the editor rather than patching a document under a reader's hands.
//
// Outline is a rail on this same editor, not a second one (Brendan,
// 2026-09-13, "they are all features of a single editor"): the Typeset and
// Outline routes render the one mounted document, and the switch only shows
// or hides the outline, so it costs nothing.

export type TypesetSurface = "plate" | "potion"

type Loaded = { key: string; html: string; value?: Value }

function contentUrl(item: string, bill: string, version?: string) {
  // `value=1` asks for the parsed document beside the HTML (typeset-perf,
  // 2026-09-13; 78 KB more gzipped) so the browser skips its own parse. The
  // preload URL and the fetch URL must stay identical or the preload is wasted.
  const sp = new URLSearchParams({ item, bill, value: "1" })
  if (version) sp.set("version", version)
  return `/api/typeset/content?${sp}`
}

// One request per page, shared (Brendan, 2026-09-13): the fetch used to run
// twice under development's double effects, and a second view of the same bill
// fetched the whole 355 KB again. The promise is kept per key, so a view that
// mounts while the request is in flight waits on it, and a view that mounts
// later reads the answer.
const REQUESTS = new Map<string, Promise<{ html: string; value?: Value }>>()

function fetchContent(key: string, item: string, bill: string, version?: string) {
  let request = REQUESTS.get(key)
  if (!request) {
    request = fetch(contentUrl(item, bill, version))
      .then((r) => r.json() as Promise<{ html?: string; value?: Value; error?: string }>)
      .then((r) => ({ html: r.html ?? `<p>${r.error ?? "Nothing to open."}</p>`, value: r.html ? r.value : undefined }))
      .catch(() => {
        REQUESTS.delete(key)
        return { html: "<p>The bill could not be opened.</p>" }
      })
    REQUESTS.set(key, request)
  }
  return request
}

function useContent(item: string, bill: string, version?: string) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const key = `${item}:${bill}:${version ?? ""}`
  // The page's HTML asks for the bill's text before any script runs
  // (typeset-perf, 2026-09-13): fetched from the effect alone, the request
  // waited for 7 MB of development JavaScript to load and hydrate, then queued
  // behind the page's other API calls, and arrived 5.5 s after navigation. The
  // effect's fetch below picks up the preloaded response.
  if (bill && !REQUESTS.has(key)) preload(contentUrl(item, bill, version), { as: "fetch", crossOrigin: "anonymous" })
  React.useEffect(() => {
    if (!bill) return
    let live = true
    void fetchContent(key, item, bill, version).then((r) => live && setLoaded({ key, html: r.html, value: r.value }))
    return () => {
      live = false
    }
  }, [key, item, bill, version])
  return loaded && loaded.key === key ? loaded : null
}

// The toolbar is drawn here, above the row, rather than by the fixed-toolbar
// plugin inside the scrolling container (Brendan, 2026-09-13): the actions
// aside opens beside the page and under the toolbar, as the outline does in
// the Git view, and a toolbar inside the scroller could not sit above both.
// The kit is BillKit, not the template's EditorKit (typeset-perf,
// 2026-09-13): no fixed-toolbar plugin, no drag and drop (a draggable, gutter,
// handle and tooltip around every block, 30,000 DOM nodes on a bill), and
// none of the kits a bill does not use.
// The table-of-contents plugin rides along for the outline rail.
const BILL_KIT = [...BillKit, ...TocKit]

// A bill is thousands of top-level blocks (H.R. 6644: 3,023), and two editor
// defaults made every keystroke pay for all of them (typeset-perf,
// 2026-09-13; docs/typeset-perf.md). Slate re-maps every block in the edited
// chunk, and Plate's default chunk is 1,000 blocks; at 20 it re-maps a few
// dozen. Plate's navigation feedback subscribes every element to the editor
// on each change to flash a jump target, which a bill never uses. Chunks off
// screen skip layout; the intrinsic size keeps the scrollbar honest until
// each one has been drawn once.
const BILL_CHUNK_SIZE = 20


/** A bill's page in the same editor the template draws, so nothing but the words differ. */
function Document({ html, value, contentKey, outline }: { html: string; value?: Value; contentKey: string; outline: boolean }) {
  // Kits added on demand rebuild the editor from the reader's live value and
  // selection, not from the HTML again (lib/typeset/lazy-kits.tsx).
  const { plugins: extra, preload: preloadKit, enable: addKit } = useLazyKitState()
  // Parsed once per bill and version and kept (typeset-perf, 2026-09-13), so a
  // return to this view skips the parse.
  const seed = React.useRef<string | Value>(billValue(contentKey, value ?? html))
  const restore = React.useRef<TRange | null>(null)
  const editor = usePlateEditor(
    {
      plugins: [...BILL_KIT, ...extra],
      value: seed.current,
      chunking: { chunkSize: BILL_CHUNK_SIZE },
      navigationFeedback: false,
    },
    [extra]
  )
  const enable = React.useCallback(
    async (name: LazyKit) => {
      seed.current = editor.children as Value
      restore.current = editor.selection
      await addKit(name)
    },
    [editor, addKit]
  )
  React.useEffect(() => {
    const at = restore.current
    if (!at) return
    restore.current = null
    try {
      editor.tf.select(at)
      editor.tf.focus()
    } catch {}
  }, [editor])
  const kits = React.useMemo(() => ({ preload: preloadKit, enable }), [preloadKit, enable])
  return (
    <LazyKitsProvider value={kits}>
      <Plate editor={editor}>
        <div className="flex h-full min-h-0 flex-col">
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>
          <div className="flex min-h-0 flex-1">
            <EditorContainer className="relative">
              {outline && <PotionOutline />}
              <Editor variant="demo" renderChunk={renderProgressiveChunk} />
            </EditorContainer>
            <TypesetActionsAside />
          </div>
        </div>
      </Plate>
    </LazyKitsProvider>
  )
}

export function TypesetEditor({
  item,
  bill,
  version,
  surface = "plate",
  snapshot,
}: {
  item: string
  bill: string
  version?: string
  surface?: TypesetSurface
  /** The page as the server drew it, shown until the editor has the text (Brendan, 2026-09-13). */
  snapshot?: React.ReactNode
}) {
  const loaded = useContent(item, bill, version)
  const contentKey = `${item}:${bill}:${version ?? ""}`
  return (
    <div data-slot="typeset-editor" className="h-full w-full">
      {!bill ? (
        <PlateEditor />
      ) : loaded === null ? (
        (snapshot ?? <BillSkeleton />)
      ) : (
        <React.Fragment key={contentKey}>
          <Document html={loaded.html} value={loaded.value} contentKey={contentKey} outline={surface === "potion"} />
        </React.Fragment>
      )}
      <Toaster />
    </div>
  )
}
