"use client"

import * as React from "react"
import Link from "next/link"
import { EditorContent, Extension, useEditor, type Editor, type JSONContent } from "@tiptap/react"
import { Plugin, type Transaction } from "@tiptap/pm/state"

import { useRouter } from "next/navigation"

import { CiteDecorations, useCitations } from "@/components/workspace/typeset-cite-layer"
import { TypesetForkView, type Carry } from "@/components/workspace/typeset-fork"
import { StaticToolbar } from "@/components/workspace/typeset-toolbar"
import { XmlCommentMarks, XmlComments } from "@/components/workspace/typeset-xml-comments"
import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import { XmlMarkKeys } from "@/components/workspace/typeset-xml-toolbar"
import type { CiteContext } from "@/lib/typeset/cite"
import { forkAddress, forkHref } from "@/lib/policy/forks"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePaneNoteSetter } from "@/lib/typeset/pane-note"
import { versionName } from "@/lib/typeset/versions"
import { openVersionsPanel } from "@/components/workspace/version-code"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-reader.css"

// The XML view (window 1, 2026-09-14): a bill printing drawn from its USLM in
// a Tiptap reader, beside the Plate editor on the same routes. The page
// arrives with the document already drawn as HTML by the server (the same
// markup, from the same schema tables), and the reader mounts on that markup
// (2026-09-15): the schema's parse rules read it back exactly, so a reader who
// only reads never fetches the ProseMirror JSON. The JSON comes when editing
// begins, with the fork (typeset-fork.tsx). Without a first paint the reader
// fetches the JSON as before.
//
// A stored Expression opened by its address (window 4) hands its own
// `jsonUrl` instead of a bill, and a `portion` to open at.
//
// Editable in place (Brendan, 2026-09-15: a Word file opens editable at once).
// With `edit`, the reader takes keystrokes. The first one makes the reader's
// fork of the Expression on screen; the edits go on showing while it is made
// and are carried onto the fork, and the view becomes the Fork view where it
// stands, saving as the reader types. The published text never changes. A
// signed-out reader who types meets the sign-in door and nothing else.

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

/** Editing in place: the stored Expression's address the reader's copy is made from, null when the printing is not stored and cannot be copied. */
export type XmlEdit = { address: string | null; billId?: number | null; title?: string | null }

type Loaded = XmlMeta & { json: JSONContent; timings?: Record<string, number>; bytes?: Record<string, number> }

type Phase = "reading" | "forking" | "editing"

/** Which printing, and where its structure came from when that is not the printing's own XML: in the footer after the size line (Brendan, 2026-09-14), or over the document where no footer takes it. */
export function XmlSourceLine({ meta, inline = false }: { meta: XmlMeta | null; inline?: boolean }) {
  if (!meta) return inline ? <div aria-hidden className="h-10 shrink-0 border-b border-b-border" /> : null
  // The stage spelled out ("Enrolled"), and in the footer a button that opens the Versions panel (Brendan, 2026-09-15); the address lives on each version's row there.
  const printing = [versionName(meta.version), meta.date?.slice(0, 10)].filter(Boolean).join(" · ")
  // A captured page says nothing here (Brendan, 2026-09-14): the card in the body is the whole of it.
  const note = meta.fidelity === "plain-text" && !meta.captured ? "Read from the stored plain text: this printing has no XML yet, so its levels are inferred from the numbering." : null
  const address = meta.work ? `${meta.work}${meta.expression ? `@${meta.expression}` : ""}` : null
  if (!inline)
    return (
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {printing && (
          <button type="button" onClick={openVersionsPanel} className="shrink-0 rounded-md px-1.5 py-0.5 font-medium text-foreground hover:bg-muted">
            {printing}
          </button>
        )}
        {note && (
          <span title={note} className="max-w-72 truncate text-amber-700 dark:text-amber-400">
            {note}
          </span>
        )}
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

/** Decides whether a change may land on the reader, and hands each one that did to `record`. */
const EditGate = Extension.create<{ allow: (tr: Transaction) => boolean; record: (tr: Transaction) => void }>({
  name: "xmlEditGate",
  addOptions: () => ({ allow: () => false, record: () => {} }),
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        filterTransaction: (tr) => !tr.docChanged || options.allow(tr),
        appendTransaction: (trs) => {
          for (const tr of trs) if (tr.docChanged) options.record(tr)
          return null
        },
      }),
    ]
  },
})

/** This browser's copy of a printing, remembered when the first keystroke made it. */
const COPY_KEY = (address: string) => `typeset-copy:${address}`

function rememberedCopy(address: string | null | undefined): number | null {
  if (!address) return null
  try {
    return Number(JSON.parse(localStorage.getItem(COPY_KEY(address)) ?? "null")?.id) || null
  } catch {
    return null
  }
}

export function TypesetXmlReader({
  billId,
  version,
  snapshot,
  meta: initialMeta,
  jsonUrl,
  portion,
  cite,
  edit,
}: {
  billId?: number
  version?: string
  snapshot?: string | null
  meta?: XmlMeta | null
  jsonUrl?: string
  portion?: string | null
  /** Who is citing (window 6): the document's jurisdiction, Work and date, for its citations to be found, resolved and decorated. */
  cite?: (CiteContext & { at?: string | null; citing?: string | null }) | null
  /** Editing in place (2026-09-15): the reader draws its own toolbar and takes keystrokes. */
  edit?: XmlEdit | null
}) {
  const router = useRouter()
  const routerRef = React.useRef(router)
  routerRef.current = router
  const { reader, readerReady } = useJurisdiction()

  // Editing in place: where the view is, the fork once made, and what the reader typed meanwhile.
  const [phase, setPhase] = React.useState<Phase>("reading")
  const phaseRef = React.useRef<Phase>("reading")
  const [forkId, setForkId] = React.useState<number | null>(null)
  const [door, setDoor] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)
  const [copyId, setCopyId] = React.useState<number | null>(null)
  const carry = React.useRef<Carry | null>(null)
  const steps = React.useRef<unknown[]>([])
  const editorRef = React.useRef<Editor | null>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const live = React.useRef({ edit, signedIn: reader.signedIn, readerReady })
  live.current = { edit, signedIn: reader.signedIn, readerReady }
  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }

  React.useEffect(() => setCopyId(rememberedCopy(edit?.address)), [edit?.address])

  // Made once with the editor: the citations layer when a citing context is given, and the gate when the view is editable.
  const extensions = React.useMemo(() => {
    const out = [...XML_EXTENSIONS, XmlCommentMarks]
    if (cite) out.push(CiteDecorations.configure({ onOpen: (href) => routerRef.current.push(href), reading: () => phaseRef.current === "reading" }))
    if (edit)
      out.push(
        XmlMarkKeys,
        EditGate.configure({
          allow: (tr) => {
            const { edit: e, signedIn, readerReady: ready } = live.current
            if (phaseRef.current === "forking") return true
            if (phaseRef.current === "editing" || !ready) return false
            if (!signedIn) {
              setDoor(true)
              return false
            }
            if (!e?.address) {
              setNote("This printing is not in the XML store yet, so it cannot be copied to edit.")
              return false
            }
            begin(tr.before.content.size)
            return true
          },
          record: (tr) => {
            for (const step of tr.steps) steps.current.push(step.toJSON())
          },
        })
      )
    return out
  }, [Boolean(cite), Boolean(edit)]) // eslint-disable-line react-hooks/exhaustive-deps

  // The first keystroke: the fork of the Expression on screen, made while the reader goes on typing.
  const begin = (size: number) => {
    const address = live.current.edit?.address
    if (!address) return
    setPhaseBoth("forking")
    carry.current = {
      steps: steps.current,
      size,
      get selection() {
        const s = editorRef.current?.state.selection
        return s ? { anchor: s.anchor, head: s.head } : null
      },
      // The unit at the top of the reader's window, and how far below the top it sits.
      get scrollId() {
        return topUnit(scroller.current)?.id ?? null
      },
      get scrollOffset() {
        return topUnit(scroller.current)?.offset ?? 0
      },
    }
    void forkAddress(address, { bill_id: live.current.edit?.billId ?? null, title: live.current.edit?.title ?? null }).then((fork) => {
      if (fork) {
        try {
          localStorage.setItem(COPY_KEY(address), JSON.stringify({ id: fork.id, at: Date.now() }))
        } catch {}
        setForkId(fork.id)
        return
      }
      // Not made: the reader's text goes back to the printing's.
      setPhaseBoth("reading")
      steps.current.length = 0
      carry.current = null
      const e = editorRef.current
      const original = loadedRef.current?.json ?? fromHtmlRef.current
      if (e && original) {
        phaseRef.current = "forking"
        e.commands.setContent(original, { emitUpdate: false })
        phaseRef.current = "reading"
        steps.current.length = 0
      }
      setNote("The copy could not be made. The printing is unchanged.")
    })
  }

  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const loadedRef = React.useRef<Loaded | null>(null)
  loadedRef.current = loaded
  // The server's first paint, mounted as it stands; a captured page is not a document.
  const fromHtml = snapshot && !initialMeta?.captured ? snapshot : null
  const fromHtmlRef = React.useRef(fromHtml)
  fromHtmlRef.current = fromHtml
  const [failed, setFailed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
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
    if (fromHtml) return
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
  }, [billId, version, jsonUrl, fromHtml])

  const editor = useEditor(
    {
      extensions,
      editable: Boolean(edit),
      immediatelyRender: false,
      content: fromHtml ?? loaded?.json ?? null,
      enableInputRules: false,
      enablePasteRules: false,
      onCreate: () => {
        // The editor made before the JSON arrives is empty; the snapshot stays until the one holding the document exists.
        if (!fromHtml && !loaded) return
        setClock((c) => ({ ...c, mount: Math.round(performance.now() - started.current) }))
        setMounted(true)
      },
    },
    [loaded, fromHtml]
  )
  editorRef.current = editor

  const meta = loaded ?? initialMeta ?? null
  const showEditor = Boolean((fromHtml || loaded) && editor && mounted)
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

  // The copy has taken over: the reader stops taking keystrokes and leaves.
  const onCarried = React.useCallback(() => {
    phaseRef.current = "editing"
    editorRef.current?.setEditable(false)
    setPhase("editing")
    setCopyId(null)
  }, [])

  const reading = (
    <div className="flex h-full min-h-0 flex-col" data-xml-reader data-json-ms={clock.json} data-mount-ms={clock.mount}>
      {edit && (
        <StaticToolbar
          xml={{ editor: showEditor ? editor : null }}
          end={
            phase === "forking" ? (
              <span className="px-1 text-xs whitespace-nowrap text-muted-foreground">Making a copy…</span>
            ) : copyId ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push(forkHref(copyId))}>
                Your copy · Open
              </Button>
            ) : undefined
          }
        />
      )}
      {note && <p className="shrink-0 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{note}</p>}
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
        {showEditor && phase === "reading" && <XmlComments editor={editor} container={scroller} document={meta?.work && meta.expression ? `${meta.work}@${meta.expression}` : null} billId={billId ?? null} />}
      </div>
    </div>
  )

  const signIn = (
    <Dialog open={door} onOpenChange={setDoor}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to edit.</DialogTitle>
          <DialogDescription>An edit becomes your own copy in My Files, saved as you type. The published text never changes.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDoor(false)}>
            Cancel
          </Button>
          <Button render={<Link href="/sign-in" />} nativeButton={false}>
            Sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (!forkId)
    return (
      <>
        {reading}
        {edit && signIn}
      </>
    )
  // The fork's view is laid out under the reader while it loads, so the reader's place can be found in it; the reader leaves once the edits are carried.
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <TypesetForkView forkId={forkId} carry={carry} onCarried={onCarried} active={phase === "editing"} />
      {phase !== "editing" && <div className="absolute inset-0 z-10 flex flex-col bg-background">{reading}</div>}
    </div>
  )
}

/** The first unit whose top is in view, and its distance from the scroller's top. */
function topUnit(scroller: HTMLElement | null): { id: string; offset: number } | null {
  if (!scroller) return null
  const top = scroller.getBoundingClientRect().top
  for (const el of scroller.querySelectorAll<HTMLElement>(".ProseMirror [id]")) {
    const at = el.getBoundingClientRect().top - top
    if (at >= 0) return { id: el.id, offset: at }
  }
  return null
}
