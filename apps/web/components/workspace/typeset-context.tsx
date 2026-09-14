"use client"

import * as React from "react"
import { EditorContent, Extension, useEditor, type Editor, type JSONContent } from "@tiptap/react"
import type { Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { ArrowUpRightIcon } from "lucide-react"

import type { Citation, Instruction } from "@/lib/typeset/amend"
import { billContext, billRedline, forkContext, forkRedline, OUTCOME_WORDS, unitPos, type Marker, type TabRedline } from "@/lib/typeset/in-context"
import type { BillInstruction, Outcome } from "@/lib/typeset/instruct"
import type { Resolution } from "@/lib/typeset/resolve"
import { workHref } from "@/lib/xml/library"
import { Redline, redlineKey } from "@/components/workspace/typeset-redline"
import { XML_EXTENSIONS } from "@/components/workspace/typeset-xml-extensions"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-reader.css"
import "./typeset-fork.css"
import "./typeset-cite.css"

// The in-context view (window 6b, 2026-09-14), a mode of the Fork view: the
// fork on the left with an `@` marker on each amendment instruction, and on
// the right a tab per statute it affects, drawn from that statute's dated
// Expression with the redline in place. A bill's instructions are carried out
// on each cited Work (lib/typeset/instruct.ts); a statute fork is grafted back
// into its section. The pure half is lib/typeset/in-context.ts. Markers and
// redlines are decorations; neither document is written to.

const fmtDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })

// --------------------------------------------------------------- markers ---

export const markersKey = new PluginKey<{ set: DecorationSet; markers: Marker[] }>("contextMarkers")

/** The `@` markers over the fork's editor; a click opens the marker's tab rather than placing the cursor. */
export const ContextMarkers = Extension.create<{ onOpen: ((marker: Marker) => void) | null }>({
  name: "contextMarkers",
  addOptions: () => ({ onOpen: null }),
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: markersKey,
        state: {
          init: () => ({ set: DecorationSet.empty, markers: [] as Marker[] }),
          apply: (tr, value) => {
            const markers = tr.getMeta(markersKey) as Marker[] | undefined
            if (!markers) return { markers: value.markers, set: value.set.map(tr.mapping, tr.doc) }
            const size = tr.doc.content.size
            const widgets = markers.flatMap((m, i) =>
              m.at <= size
                ? [
                    Decoration.widget(
                      m.at,
                      () => {
                        const el = document.createElement("span")
                        el.className = "at-marker"
                        el.textContent = "@"
                        el.title = m.title
                        el.contentEditable = "false"
                        el.dataset.marker = String(i)
                        return el
                      },
                      { side: 1, key: `m:${m.at}:${m.unit}:${m.title}`, ignoreSelection: true }
                    ),
                  ]
                : []
            )
            return { markers, set: DecorationSet.create(tr.doc, widgets) }
          },
        },
        props: {
          decorations: (state) => markersKey.getState(state)?.set,
          handleDOMEvents: {
            mousedown: (view, event) => {
              const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-marker]")
              const marker = el ? markersKey.getState(view.state)?.markers[Number(el.dataset.marker)] : undefined
              if (!marker) return false
              event.preventDefault()
              options.onOpen?.(marker)
              return true
            },
          },
        },
      }),
    ]
  },
})

/** Dispatches into an editor whose view may not be mounted yet, trying again for a few seconds. */
function whenMounted(editor: Editor, act: () => void): () => void {
  let timer = 0
  let tries = 0
  const attempt = () => {
    if (editor.isDestroyed) return
    try {
      act()
    } catch {
      if (tries++ < 20) timer = window.setTimeout(attempt, 250)
    }
  }
  attempt()
  return () => window.clearTimeout(timer)
}

// ------------------------------------------------------------------ tabs ---

export type Focus = { work: string; unit: string; n: number }

type TabSource =
  /** A bill's instructions to one Work, carried out on the Work's text as of the bill's date. */
  | { kind: "bill"; instructions: BillInstruction[] }
  /** A statute fork, grafted into the section it was forked from. */
  | { kind: "statute"; fork: PmNode; forkWork: string; instructions: Instruction[] }

type Loaded = { json: JSONContent } | { failed: string }

function StatuteTab({ work, address, date, source, focus, hidden }: { work: string; address: string; date: string; source: TabSource; focus: Focus | null; hidden: boolean }) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [red, setRed] = React.useState<TabRedline | null>(null)
  const [ready, setReady] = React.useState(false)
  const scroller = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let live = true
    setLoaded(null)
    fetch(`/api/typeset/work?address=${encodeURIComponent(address)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { json?: JSONContent; error?: string; detail?: string } | null
        if (!live) return
        setLoaded(r.ok && body?.json ? { json: body.json } : { failed: [body?.error, body?.detail].filter(Boolean).join(". ") || `The text did not load (${r.status}).` })
      })
      .catch(() => live && setLoaded({ failed: "The text did not load." }))
    return () => {
      live = false
    }
  }, [address])

  const json = loaded && "json" in loaded ? loaded.json : null
  const editor = useEditor(
    { extensions: [...XML_EXTENSIONS, Redline], editable: false, immediatelyRender: false, content: json, enableInputRules: false, enablePasteRules: false, onCreate: () => setReady(true) },
    [json]
  )

  // The redline, again whenever the fork's instructions change.
  React.useEffect(() => {
    if (!editor || !ready || !json || !editor.state.doc.childCount) return
    const statute = editor.state.doc
    let next: TabRedline | null
    try {
      next = source.kind === "bill" ? billRedline(statute, work, source.instructions) : forkRedline(statute, source.fork, source.forkWork)
    } catch {
      next = null
    }
    setRed(next)
    return whenMounted(editor, () => editor.view.dispatch(editor.state.tr.setMeta(redlineKey, next?.specs ?? []).setMeta("addToHistory", false)))
  }, [editor, ready, json, source, work])

  const reveal = React.useCallback(
    (unit: string) => {
      if (!editor || editor.isDestroyed) return
      const found = unitPos(editor.state.doc, unit)
      if (!found) return
      const el = editor.view.nodeDOM(found.pos) as HTMLElement | null
      if (!el?.scrollIntoView) return
      el.scrollIntoView({ block: "start", behavior: "smooth" })
      el.classList.add("context-focus")
      window.setTimeout(() => el.classList.remove("context-focus"), 1600)
    },
    [editor]
  )

  // Each click reveals once; a redline redrawn after an edit does not scroll again.
  const revealed = React.useRef(0)
  React.useEffect(() => {
    if (!focus || focus.work !== work || hidden || !ready || !red || revealed.current === focus.n) return
    revealed.current = focus.n
    reveal(focus.unit)
  }, [focus, work, hidden, ready, red, reveal])

  if (hidden) return null
  if (loaded && "failed" in loaded) return <p className="p-6 text-sm text-muted-foreground">{loaded.failed}</p>

  const outcomes = source.kind === "bill" ? (red?.outcomes ?? []) : []
  const carried = source.kind === "bill" && red && !red.specs.length && outcomes.length > 0 && outcomes.every((o) => o.status === "already-made")
  const lost = source.kind === "statute" && ready && !red

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      {!json && (
        <div className="flex flex-col gap-2 p-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
          ))}
        </div>
      )}
      {carried && <p className="mx-6 mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">The stored text, dated {fmtDay(date)}, already carries these amendments.</p>}
      {lost && <p className="mx-6 mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{source.forkWork} is no longer in the text dated {fmtDay(date)}.</p>}
      <div className={cn("uslm-doc amend-redline", !json && "hidden")}>
        <EditorContent editor={editor} />
      </div>
      {source.kind === "bill" && outcomes.length > 0 && (
        <ol className="flex flex-col border-t text-sm">
          {outcomes.map((o, i) => (
            <OutcomeRow key={i} outcome={o} onReveal={() => reveal([work, ...o.instruction.portion].join("/"))} />
          ))}
        </ol>
      )}
      {source.kind === "statute" && source.instructions.length > 0 && (
        <ol className="flex flex-col gap-3 border-t p-4 text-sm leading-relaxed">
          {source.instructions.map((ins, i) => (
            <li key={i}>
              <button type="button" className="text-left whitespace-pre-wrap hover:underline" onClick={() => reveal(ins.unit ?? source.forkWork)}>
                {ins.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const TONE: Record<Outcome["status"], string> = {
  applied: "text-[#1a7f37]",
  "already-made": "text-muted-foreground",
  "not-found": "text-amber-600",
  refused: "text-destructive",
  unread: "text-amber-600",
  "other-work": "text-muted-foreground",
}

function OutcomeRow({ outcome, onReveal }: { outcome: Outcome; onReveal: () => void }) {
  const words = outcome.instruction.text.replace(/\s+/g, " ").trim()
  return (
    <li className="border-b last:border-b-0">
      <button type="button" onClick={onReveal} className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left hover:bg-muted/50">
        <span className={cn("w-24 shrink-0 text-xs font-medium", TONE[outcome.status])}>{OUTCOME_WORDS[outcome.status]}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2">{words}</span>
          {outcome.detail && outcome.status !== "applied" && <span className="mt-0.5 block text-xs text-muted-foreground">{outcome.detail}</span>}
        </span>
      </button>
    </li>
  )
}

// ------------------------------------------------------------------ pane ---

type Tab = { work: string; label: string; address: string | null; date: string | null; missing: string | null }

/** The right half of the in-context view, and the markers it lays over the fork's editor. */
export function TypesetContextPane({
  editor,
  forkWork,
  base,
  cite,
  focus,
  onFocus,
}: {
  editor: Editor | null
  forkWork: string
  base: { address: string; date: string; label: string | null; json: JSONContent }
  cite: Citation
  focus: Focus | null
  onFocus: (focus: Focus) => void
}) {
  const isBill = cite.kind === "bill"
  const [doc, setDoc] = React.useState<PmNode | null>(null)
  const [resolutions, setResolutions] = React.useState<Record<string, Resolution>>({})
  const [active, setActive] = React.useState<string | null>(null)
  const [visited, setVisited] = React.useState<Set<string>>(() => new Set())
  const at = base.date.slice(0, 10)

  // The fork's document, read again on a pause after an edit.
  React.useEffect(() => {
    if (!editor) return
    setDoc(editor.state.doc)
    let timer = 0
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => !editor.isDestroyed && setDoc(editor.state.doc), 400)
    }
    editor.on("update", onUpdate)
    return () => {
      editor.off("update", onUpdate)
      window.clearTimeout(timer)
    }
  }, [editor])

  const context = React.useMemo(() => {
    if (!doc || !editor) return null
    try {
      if (isBill) {
        const c = billContext(doc, { jurisdiction: cite.jurisdiction, work: cite.work })
        return { markers: c.markers, works: c.works, bill: c.instructions, engine: [] as Instruction[] }
      }
      const c = forkContext(editor.schema.nodeFromJSON(base.json), doc, cite, forkWork)
      return { markers: c.markers, works: c.instructions.length ? [cite.work] : [], bill: [] as BillInstruction[], engine: c.instructions }
    } catch {
      return { markers: [] as Marker[], works: [] as string[], bill: [] as BillInstruction[], engine: [] as Instruction[] }
    }
  }, [doc, editor, isBill, cite, base.json, forkWork])

  // Markers on while the pane is open, off when it closes.
  React.useEffect(() => {
    if (!editor || !context) return
    const markers = context.markers
    const stop = whenMounted(editor, () => editor.view.dispatch(editor.state.tr.setMeta(markersKey, markers).setMeta("addToHistory", false)))
    return () => {
      stop()
      if (!editor.isDestroyed) whenMounted(editor, () => editor.view.dispatch(editor.state.tr.setMeta(markersKey, []).setMeta("addToHistory", false)))
    }
  }, [editor, context])

  // Each cited Work's text as of the bill's date, from the index; a statute fork's tab is the section it came from.
  const worksKey = context?.works.join(" ") ?? ""
  React.useEffect(() => {
    if (!isBill || !worksKey) return
    const wanted = worksKey.split(" ").filter((w) => !resolutions[w])
    if (!wanted.length) return
    let live = true
    fetch("/api/typeset/cite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ works: wanted, at, citing: base.address }) })
      .then((r) => (r.ok ? (r.json() as Promise<{ resolutions: Record<string, Resolution> }>) : { resolutions: {} }))
      .catch(() => ({ resolutions: {} as Record<string, Resolution> }))
      .then((body) => live && setResolutions((prev) => ({ ...prev, ...body.resolutions })))
    return () => {
      live = false
    }
    // Resolutions already held are not asked for again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBill, worksKey, at, base.address])

  const tabs: Tab[] = React.useMemo(() => {
    if (!context) return []
    if (!isBill) {
      const [sectionWork, expression] = base.address.split("@")
      return context.works.length ? [{ work: cite.work, label: base.label ?? cite.work, address: `${sectionWork}@${expression}`, date: base.date, missing: null }] : []
    }
    return context.works.map((work) => {
      const r = resolutions[work]
      if (!r) return { work, label: work, address: null, date: null, missing: null }
      if (!r.found || !r.expression) return { work, label: r.label ?? work, address: null, date: null, missing: r.advisories[0]?.text ?? "Not in the corpus yet." }
      return { work, label: r.label ?? work, address: `${work}@${r.expression}`, date: r.date, missing: null }
    })
  }, [context, isBill, resolutions, base.address, base.label, base.date, cite.work])

  const current = tabs.find((t) => t.work === active) ?? tabs[0] ?? null
  React.useEffect(() => {
    if (focus && tabs.some((t) => t.work === focus.work)) setActive(focus.work)
  }, [focus, tabs])
  React.useEffect(() => {
    if (current && !visited.has(current.work)) setVisited((prev) => new Set(prev).add(current.work))
  }, [current, visited])

  const sources = React.useMemo(() => {
    const out = new Map<string, TabSource>()
    if (!context) return out
    if (isBill) for (const w of context.works) out.set(w, { kind: "bill", instructions: context.bill.filter((i) => i.work === w) })
    else if (doc) out.set(cite.work, { kind: "statute", fork: doc, forkWork, instructions: context.engine })
    return out
  }, [context, isBill, doc, cite.work, forkWork])

  if (!context) return <Skeleton className="m-6 h-40 rounded-xl" />
  if (!tabs.length) return <p className="p-6 text-sm text-muted-foreground">{isBill ? "No amendment instructions in this text." : "No changes from the base."}</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3">
        <Tabs value={current?.work ?? null} onValueChange={(v) => v && onFocus({ work: String(v), unit: String(v), n: Date.now() })} className="min-w-0 flex-1 overflow-x-auto">
          <TabsList variant="line" className="h-10">
            {tabs.map((t) => (
              <TabsTrigger key={t.work} value={t.work} className="flex-none px-2 text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {current?.date && (
          <a href={workHref(current.work, at)} className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground">
            {fmtDay(current.date)}
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        )}
      </div>
      {current?.missing && <p className="p-6 text-sm text-muted-foreground">{current.missing}</p>}
      {current && !current.missing && !current.address && <Skeleton className="m-6 h-40 rounded-xl" />}
      {tabs.map((t) =>
        t.address && t.date && visited.has(t.work) && sources.get(t.work) ? (
          <StatuteTab key={t.address} work={t.work} address={t.address} date={t.date} source={sources.get(t.work)!} focus={focus} hidden={t.work !== current?.work} />
        ) : null
      )}
    </div>
  )
}
