"use client"

import * as React from "react"
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react"

import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-reader.css"

// The XML view (window 1, 2026-09-14): a bill printing drawn from its USLM in
// a Tiptap reader, beside the Plate editor on the same routes. The page
// arrives with the document already drawn as HTML by the server (the same
// markup, from the same schema tables); the reader fetches the ProseMirror
// JSON and takes over without the page moving. Read-only: editing, forks and
// amendments are later windows'.

export type XmlMeta = {
  documentId: number | null
  version: string | null
  date: string | null
  work: string | null
  expression: string | null
  fidelity: "native-xml" | "structured-html" | "plain-text" | "pdf"
  dialect: string
  sourceUrl: string | null
}

type Loaded = XmlMeta & { json: JSONContent; timings?: Record<string, number>; bytes?: Record<string, number> }

/** The line over the document: which printing, and where its structure came from when that is not the printing's own XML. */
export function XmlSourceLine({ meta }: { meta: XmlMeta | null }) {
  if (!meta) return <div aria-hidden className="h-10 shrink-0 border-b border-b-border" />
  const printing = [meta.version, meta.date?.slice(0, 10)].filter(Boolean).join(" · ")
  const note = meta.fidelity === "plain-text" ? "Read from the stored plain text: this printing has no XML yet, so its levels are inferred from the numbering." : null
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-b-border px-4 text-xs text-muted-foreground">
      {printing && <span className="truncate font-medium text-foreground">{printing}</span>}
      {note && <span className={cn("truncate", meta.fidelity === "plain-text" && "text-amber-700 dark:text-amber-400")}>{note}</span>}
      {meta.work && (
        <code className="ml-auto hidden truncate font-mono text-[11px] md:block">
          {meta.work}
          {meta.expression ? `@${meta.expression}` : ""}
        </code>
      )}
    </div>
  )
}

export function TypesetXmlReader({ billId, version, snapshot, meta: initialMeta }: { billId: number; version?: string; snapshot?: string | null; meta?: XmlMeta | null }) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    let live = true
    setLoaded(null)
    setMounted(false)
    const params = new URLSearchParams({ bill: String(billId) })
    if (version) params.set("version", version)
    fetch(`/api/typeset/xml?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: Loaded) => live && setLoaded(body))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [billId, version])

  const editor = useEditor(
    {
      extensions: XML_EXTENSIONS,
      editable: false,
      immediatelyRender: false,
      content: loaded?.json ?? null,
      enableInputRules: false,
      enablePasteRules: false,
      onCreate: () => setMounted(true),
    },
    [loaded]
  )

  const meta = loaded ?? initialMeta ?? null
  const showEditor = Boolean(loaded && editor && mounted)
  const dialect = meta?.dialect ?? undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <XmlSourceLine meta={meta} />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {!showEditor && snapshot && <div className="uslm-doc" data-dialect={dialect} data-typeset-snapshot dangerouslySetInnerHTML={{ __html: snapshot }} />}
        {!showEditor && !snapshot && <p className="p-8 text-sm text-muted-foreground">{failed ? "The XML of this printing could not be read." : "Reading the printing…"}</p>}
        <div className={cn("uslm-doc", !showEditor && "hidden")} data-dialect={dialect}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
