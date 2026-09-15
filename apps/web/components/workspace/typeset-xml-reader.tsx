"use client"

import * as React from "react"
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react"

import { useRouter } from "next/navigation"

import { CiteDecorations, useCitations } from "@/components/workspace/typeset-cite-layer"
import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import type { CiteContext } from "@/lib/typeset/cite"
import { usePaneNoteSetter } from "@/lib/typeset/pane-note"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-reader.css"

// The XML view (window 1, 2026-09-14): a bill printing drawn from its USLM in
// a Tiptap reader, beside the Plate editor on the same routes. The page
// arrives with the document already drawn as HTML by the server (the same
// markup, from the same schema tables); the reader fetches the ProseMirror
// JSON and takes over without the page moving. Read-only: editing, forks and
// amendments are later windows'.
//
// A stored Expression opened by its address (window 4) hands its own
// `jsonUrl` instead of a bill, and a `portion` to open at.

export type XmlMeta = {
  documentId: number | null
  version: string | null
  date: string | null
  work: string | null
  expression: string | null
  fidelity: "native-xml" | "structured-html" | "plain-text" | "pdf"
  dialect: string
  sourceUrl: string | null
  /** The stored text is a web page captured in place of the printing. */
  captured?: boolean
}

type Loaded = XmlMeta & { json: JSONContent; timings?: Record<string, number>; bytes?: Record<string, number> }

/** Which printing, and where its structure came from when that is not the printing's own XML: in the footer after the size line (Brendan, 2026-09-14), or over the document where no footer takes it. */
export function XmlSourceLine({ meta, inline = false }: { meta: XmlMeta | null; inline?: boolean }) {
  if (!meta) return inline ? <div aria-hidden className="h-10 shrink-0 border-b border-b-border" /> : null
  const printing = [meta.version, meta.date?.slice(0, 10)].filter(Boolean).join(" · ")
  // A captured page says nothing here (Brendan, 2026-09-14): the card in the body is the whole of it.
  const note = meta.fidelity === "plain-text" && !meta.captured ? "Read from the stored plain text: this printing has no XML yet, so its levels are inferred from the numbering." : null
  const address = meta.work ? `${meta.work}${meta.expression ? `@${meta.expression}` : ""}` : null
  if (!inline)
    return (
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {printing && <span className="shrink-0 font-medium text-foreground">{printing}</span>}
        {note && (
          <span title={note} className="max-w-72 truncate text-amber-700 dark:text-amber-400">
            {note}
          </span>
        )}
        {address && <code className="max-w-96 truncate font-mono text-[11px]">{address}</code>}
      </span>
    )
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-b-border px-4 text-xs text-muted-foreground">
      {printing && <span className="truncate font-medium text-foreground">{printing}</span>}
      {note && <span className={cn("truncate", meta.fidelity === "plain-text" && "text-amber-700 dark:text-amber-400")}>{note}</span>}
      {address && <code className="ml-auto hidden truncate font-mono text-[11px] md:block">{address}</code>}
    </div>
  )
}

export function TypesetXmlReader({
  billId,
  version,
  snapshot,
  meta: initialMeta,
  jsonUrl,
  portion,
  cite,
}: {
  billId?: number
  version?: string
  snapshot?: string | null
  meta?: XmlMeta | null
  jsonUrl?: string
  portion?: string | null
  /** Who is citing (window 6): the document's jurisdiction, Work and date, for its citations to be found, resolved and decorated. */
  cite?: (CiteContext & { at?: string | null; citing?: string | null }) | null
}) {
  const router = useRouter()
  const routerRef = React.useRef(router)
  routerRef.current = router
  // Made once with the editor: the citations layer when a citing context is given.
  const extensions = React.useMemo(() => (cite ? [...XML_EXTENSIONS, CiteDecorations.configure({ onOpen: (href) => routerRef.current.push(href) })] : XML_EXTENSIONS), [Boolean(cite)]) // eslint-disable-line react-hooks/exhaustive-deps
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const scroller = React.useRef<HTMLDivElement>(null)
  // Read in devtools on the reader's root: milliseconds from the component's first render to the JSON parsed and to the editor mounted.
  const started = React.useRef(0)
  const [clock, setClock] = React.useState<{ json?: number; mount?: number }>({})

  React.useEffect(() => {
    let live = true
    setLoaded(null)
    setMounted(false)
    setFailed(false)
    started.current = performance.now()
    setClock({})
    const params = new URLSearchParams({ bill: String(billId ?? "") })
    if (version) params.set("version", version)
    fetch(jsonUrl ?? `/api/typeset/xml?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: Loaded) => {
        if (!live) return
        setClock({ json: Math.round(performance.now() - started.current) })
        setLoaded(body)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [billId, version, jsonUrl])

  const editor = useEditor(
    {
      extensions,
      editable: false,
      immediatelyRender: false,
      content: loaded?.json ?? null,
      enableInputRules: false,
      enablePasteRules: false,
      onCreate: () => {
        // The editor made before the JSON arrives is empty; the snapshot stays until the one holding the document exists.
        if (!loaded) return
        setClock((c) => ({ ...c, mount: Math.round(performance.now() - started.current) }))
        setMounted(true)
      },
    },
    [loaded]
  )

  const meta = loaded ?? initialMeta ?? null
  const showEditor = Boolean(loaded && editor && mounted)
  useCitations(showEditor ? editor : null, cite ?? null)
  const dialect = meta?.dialect ?? undefined

  // The printing's line goes to the footer where there is one.
  const setMeta = usePaneNoteSetter("meta")
  React.useEffect(() => {
    if (!setMeta) return
    setMeta(meta ? <XmlSourceLine meta={meta} /> : null)
    return () => setMeta(null)
  }, [setMeta, meta])

  // Open at the portion the address named, on the snapshot and again once the editor has replaced it.
  React.useEffect(() => {
    if (!portion) return
    const target = [...(scroller.current?.querySelectorAll<HTMLElement>(`[id="${CSS.escape(portion)}"]`) ?? [])].find((el) => el.offsetParent !== null)
    target?.scrollIntoView({ block: "start" })
  }, [portion, showEditor, snapshot])

  return (
    <div className="flex h-full min-h-0 flex-col" data-xml-reader data-json-ms={clock.json} data-mount-ms={clock.mount}>
      {!setMeta && <XmlSourceLine meta={meta} inline />}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* A legislature's web page stored in place of the printing (Brendan, 2026-09-14): the card, and nothing else. */}
        {meta?.captured && (
          <div className="flex h-full items-center justify-center p-8">
            <img src="/captured-page.png" alt="404" className="w-full max-w-md rounded-lg" />
          </div>
        )}
        {!meta?.captured && !showEditor && snapshot && <div className="uslm-doc" data-dialect={dialect} data-typeset-snapshot dangerouslySetInnerHTML={{ __html: snapshot }} />}
        {!meta?.captured && !showEditor && !snapshot && <p className="p-8 text-sm text-muted-foreground">{failed ? "The XML of this printing could not be read." : "Loading…"}</p>}
        <div className={cn("uslm-doc", (!showEditor || meta?.captured) && "hidden")} data-dialect={dialect}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
