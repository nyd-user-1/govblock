"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import type { LawNode } from "@/app/api/laws/route"
import type { CodeViewHandle } from "@/components/policy/code-view"
import { writeUrlParams } from "@/lib/policy/url-state"
import { FONTS, SIZES, SPACINGS, useReaderSettings, type ReaderSettings } from "@/lib/reader-settings"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// The law, read straight through (Brendan, 2026-09-19, after esv.org's
// Matthew 10 → 11 → 12): past a law's last section the next law follows, and
// the one before it above, through the whole code, fetched and drawn off
// screen before the reader gets there. The address follows the law in view
// (`?law=` by replaceState, no reload), and so do the document's title, the
// sticky label over the text and the rail's outline.
//
// The document is a window of blocks. In the reading view a block is one page
// of the laws API (up to 200 nodes, 700 KB); in the code view it is one whole
// law in its own editor, which draws only the lines in view. The window keeps
// a few blocks either side of the reader and lets the far ones go; adding or
// dropping above holds the text still by scrolling the difference, by hand,
// because Safari does no scroll anchoring. Previous laws load only once the
// reader scrolls up, so a page opens on the law it was asked for.

const CodeView = dynamic(() => import("@/components/policy/code-view").then((m) => m.CodeView), { ssr: false })

export type OrderEntry = { id: string; name: string; cite: string; heading: string | null }
type TextNode = LawNode & { text: string | null }
type Block = { key: string; law: string; nodes: TextNode[]; atStart: boolean; atEnd: boolean }
type Entry = { location_id: string; sequence_no: number; label: string; doc_type: string }

const LEAF = new Set(["SECTION", "RULE", "JOINT_RULE", "PREAMBLE"])
const WINDOW = { reading: 8, code: 3 }
const END = 2147483647

const unescape = (t: string | null | undefined) => (t ? t.replace(/\\n/g, "\n") : "")
const label = (n: { doc_type: string; doc_level_id?: string | null; title?: string | null; location_id: string }) => {
  const kind = n.doc_type.charAt(0) + n.doc_type.slice(1).toLowerCase().replace("_", " ")
  const id = LEAF.has(n.doc_type) ? `§ ${n.doc_level_id ?? n.location_id}` : `${kind} ${n.doc_level_id ?? n.location_id}`
  return n.title ? `${id} — ${n.title}` : id
}
export const sectionId = (law: string, location: string) => `sec-${law}-${location}`.replace(/[^A-Za-z0-9_.:-]/g, "_")

async function textPage(state: string, law: string, dir: { after: number } | { before: number }) {
  const q = "after" in dir ? `after=${dir.after}` : `before=${dir.before}`
  const r = await fetch(`/api/laws?state=${state}&law=${encodeURIComponent(law)}&text=1&${q}`)
  if (!r.ok) throw new Error(`laws ${r.status}`)
  const j = (await r.json()) as { nodes: TextNode[]; next?: number | null; prev?: number | null }
  return { nodes: j.nodes ?? [], more: ("after" in dir ? j.next : j.prev) ?? null }
}

async function wholeLaw(state: string, law: string) {
  const nodes: TextNode[] = []
  for (let after = -1; ; ) {
    const p = await textPage(state, law, { after })
    nodes.push(...p.nodes)
    if (p.more == null || !p.nodes.length) return nodes
    after = p.more
  }
}

type Reader = {
  state: string
  order: OrderEntry[]
  entryOf: (law: string) => OrderEntry | undefined
  blocks: Block[]
  view: ReaderSettings["view"]
  current: string
  outline: Entry[] | null
  loadNext: () => void
  loadPrev: () => void
  open: (law: string, location: string, sequence: number) => void
  setCurrent: (law: string) => void
  docRef: React.RefObject<HTMLDivElement | null>
  pending: React.RefObject<{ law: string; location: string } | null>
  gotos: React.RefObject<Map<string, (location: string) => boolean>>
}

const ReaderContext = React.createContext<Reader | null>(null)
function useReader() {
  const r = React.useContext(ReaderContext)
  if (!r) throw new Error("LawReader is missing")
  return r
}

/** One code, read straight through, starting at `start` (and at `doc` in it, where given). */
export function LawReader({ state, order, start, doc, place, children }: { state: string; order: OrderEntry[]; start: string; doc: string | null; /** "Alaska Laws": the document title's tail. */ place: string; children: React.ReactNode }) {
  const { view } = useReaderSettings()
  const index = React.useMemo(() => new Map(order.map((e, i) => [e.id, i])), [order])
  const entryOf = React.useCallback((law: string) => order[index.get(law) ?? -1], [order, index])
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [current, setCurrentState] = React.useState(start)
  const [trees, setTrees] = React.useState<Map<string, Entry[]>>(new Map())
  const busy = React.useRef(false)
  const docRef = React.useRef<HTMLDivElement | null>(null)
  const pending = React.useRef<{ law: string; location: string } | null>(doc ? { law: start, location: doc } : null)
  const gotos = React.useRef(new Map<string, (location: string) => boolean>())
  const hold = React.useRef<{ key: string; top: number } | null>(null)
  const blocksRef = React.useRef(blocks)
  blocksRef.current = blocks
  const viewRef = React.useRef(view)
  viewRef.current = view
  const serial = React.useRef(0)
  const currentRef = React.useRef(start)

  const keyOf = () => `b${++serial.current}`

  // The outline of a law: its tree, without text.
  const tree = React.useCallback(
    async (law: string) => {
      const known = trees.get(law)
      if (known) return known
      const r = await fetch(`/api/laws?state=${state}&law=${encodeURIComponent(law)}`)
      const j = r.ok ? ((await r.json()) as { nodes: LawNode[] }) : { nodes: [] }
      const entries = (j.nodes ?? []).filter((n) => n.depth > 0 || LEAF.has(n.doc_type)).map((n) => ({ location_id: n.location_id, sequence_no: n.sequence_no, label: label(n), doc_type: n.doc_type }))
      setTrees((m) => new Map(m).set(law, entries))
      return entries
    },
    [state, trees]
  )

  // Holds the text still across a change above the reader: the block at `key` stays where it is on screen.
  const holdAt = (key: string | undefined) => {
    const el = key ? docRef.current?.querySelector<HTMLElement>(`[data-block="${key}"]`) : null
    hold.current = el && key ? { key, top: el.getBoundingClientRect().top } : null
  }
  React.useLayoutEffect(() => {
    const h = hold.current
    if (!h) return
    hold.current = null
    const el = docRef.current?.querySelector<HTMLElement>(`[data-block="${h.key}"]`)
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - h.top)
  }, [blocks])

  /** Starts the window over at a law, from after a sequence (-1: its start). */
  const anchor = React.useCallback(
    async (law: string, after = -1) => {
      busy.current = true
      try {
        if (viewRef.current === "code") {
          const nodes = await wholeLaw(state, law)
          setBlocks([{ key: keyOf(), law, nodes, atStart: true, atEnd: true }])
        } else {
          const p = await textPage(state, law, { after })
          setBlocks([{ key: keyOf(), law, nodes: p.nodes, atStart: after < 0, atEnd: p.more == null }])
        }
        currentRef.current = law
        setCurrentState(law)
      } finally {
        busy.current = false
      }
    },
    [state]
  )

  const loadNext = React.useCallback(async () => {
    const last = blocksRef.current.at(-1)
    if (busy.current || !last) return
    const i = index.get(last.law) ?? -1
    const code = viewRef.current === "code"
    if ((code || last.atEnd) && i >= order.length - 1) return
    busy.current = true
    try {
      let next: Block
      if (code) next = { key: keyOf(), law: order[i + 1]!.id, nodes: await wholeLaw(state, order[i + 1]!.id), atStart: true, atEnd: true }
      else if (!last.atEnd) {
        const p = await textPage(state, last.law, { after: last.nodes.at(-1)?.sequence_no ?? -1 })
        next = { key: keyOf(), law: last.law, nodes: p.nodes, atStart: false, atEnd: p.more == null || !p.nodes.length }
      } else {
        const p = await textPage(state, order[i + 1]!.id, { after: -1 })
        next = { key: keyOf(), law: order[i + 1]!.id, nodes: p.nodes, atStart: true, atEnd: p.more == null }
      }
      const limit = WINDOW[code ? "code" : "reading"]
      const list = [...blocksRef.current, next]
      if (list.length > limit) holdAt(list[list.length - limit]?.key)
      setBlocks(list.slice(-limit))
    } catch {
      // A page that did not come is asked for again when the reader comes near it.
    } finally {
      busy.current = false
    }
  }, [index, order, state])

  const loadPrev = React.useCallback(async () => {
    const first = blocksRef.current[0]
    if (busy.current || !first) return
    const i = index.get(first.law) ?? -1
    const code = viewRef.current === "code"
    if ((code || first.atStart) && i <= 0) return
    busy.current = true
    try {
      let prev: Block | null
      if (code) prev = { key: keyOf(), law: order[i - 1]!.id, nodes: await wholeLaw(state, order[i - 1]!.id), atStart: true, atEnd: true }
      else if (!first.atStart) {
        const p = await textPage(state, first.law, { before: first.nodes[0]?.sequence_no ?? 0 })
        prev = p.nodes.length ? { key: keyOf(), law: first.law, nodes: p.nodes, atStart: p.more == null, atEnd: false } : null
        if (!prev) {
          setBlocks((b) => b.map((x, k) => (k === 0 ? { ...x, atStart: true } : x)))
          return
        }
      } else {
        const p = await textPage(state, order[i - 1]!.id, { before: END })
        prev = { key: keyOf(), law: order[i - 1]!.id, nodes: p.nodes, atStart: p.more == null, atEnd: true }
      }
      holdAt(first.key)
      const limit = WINDOW[code ? "code" : "reading"]
      setBlocks([prev, ...blocksRef.current].slice(0, limit))
    } catch {
    } finally {
      busy.current = false
    }
  }, [index, order, state])

  const open = React.useCallback(
    (law: string, location: string, sequence: number) => {
      writeUrlParams({ law, doc: location }, { history: "replace" })
      const el = document.getElementById(sectionId(law, location))
      if (viewRef.current === "reading" && el) return el.scrollIntoView({ block: "start" })
      if (viewRef.current === "code" && gotos.current.get(law)?.(location)) return
      pending.current = { law, location }
      void anchor(law, viewRef.current === "code" ? -1 : Math.max(-1, sequence - 1))
    },
    [anchor]
  )

  const setCurrent = React.useCallback(
    (law: string) => {
      if (currentRef.current === law) return
      currentRef.current = law
      setCurrentState(law)
      writeUrlParams({ law, doc: null }, { history: "replace" })
      const e = entryOf(law)
      // The site's own suffix (" - govblock") stays on the end.
      const suffix = / - [^—]+$/.exec(document.title)?.[0] ?? ""
      if (e) document.title = `${e.name} — ${place}${suffix}`
    },
    [entryOf, place]
  )

  // Opening: the law asked for, at the section asked for, in the view the reader keeps.
  const started = React.useRef<string | null>(null)
  React.useEffect(() => {
    const at = started.current ? current : start
    if (started.current === view) return
    started.current = view
    void (async () => {
      const target = pending.current?.law === at ? pending.current.location : null
      if (target && view === "reading") {
        const entries = await tree(at)
        const seq = entries.find((e) => e.location_id === target)?.sequence_no
        return anchor(at, seq === undefined ? -1 : seq - 1)
      }
      return anchor(at, -1)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  React.useEffect(() => {
    void tree(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const value = React.useMemo<Reader>(
    () => ({ state, order, entryOf, blocks, view, current, outline: trees.get(current) ?? null, loadNext, loadPrev, open, setCurrent, docRef, pending, gotos }),
    [state, order, entryOf, blocks, view, current, trees, loadNext, loadPrev, open, setCurrent]
  )
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>
}

// ---------------------------------------------------------------------------
// The text

function Sentinel({ onNear, enabled = true }: { onNear: () => void; enabled?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const near = React.useRef(onNear)
  near.current = onNear
  React.useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && near.current(), { rootMargin: "1600px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return <div ref={ref} aria-hidden className="h-px" />
}

function LawStart({ entry }: { entry: OrderEntry }) {
  const number = entry.cite.replace(/^(Chapter|Title) /, "")
  return (
    <header className="mt-16 mb-6 first:mt-0" style={{ fontFamily: "inherit" }}>
      {entry.heading && <p className="text-[0.8em] text-muted-foreground">{entry.heading}</p>}
      <div className="flex items-baseline gap-4">
        <span className="text-[3.2em] leading-none font-light tabular-nums">{number}</span>
        <span className="text-[1.25em] leading-tight font-semibold">{entry.name}</span>
      </div>
    </header>
  )
}

function Section({ law, node, s }: { law: string; node: TextNode; s: ReaderSettings }) {
  const lines = unescape(node.text).split(/\n+/).map((l) => l.trim()).filter(Boolean)
  // The source's own heading line ("Sec. 28.11.010. Abandonment unlawful.") repeats the number and the title set above it.
  const first = lines[0] ?? ""
  if (first.length < 240 && ((node.doc_level_id && first.includes(node.doc_level_id)) || (node.title && first.includes(node.title)))) lines.shift()
  return (
    <section id={sectionId(law, node.location_id)} className="mt-[1.1em] scroll-mt-[calc(var(--header-height)+3.5rem)]">
      {(s.numbers || (s.headings && node.title) || node.repealed) && (
        <p>
          {s.numbers && <span className="mr-2 text-[0.72em] font-semibold tabular-nums text-muted-foreground">{node.doc_level_id ?? node.location_id}</span>}
          {s.headings && node.title && <span className="font-semibold">{node.title}</span>}
          {node.repealed && <em className="text-muted-foreground"> — Repealed</em>}
        </p>
      )}
      {lines.map((line, i) => (
        <p key={i} className="mt-[0.45em]">
          {line}
        </p>
      ))}
    </section>
  )
}

function ReadingBlock({ block, s }: { block: Block; s: ReaderSettings }) {
  return (
    <div data-block={block.key}>
      {block.nodes.map((n) =>
        n.depth === 0 && !LEAF.has(n.doc_type) ? null : LEAF.has(n.doc_type) ? (
          <Section key={n.location_id} law={block.law} node={n} s={s} />
        ) : s.headings ? (
          <h3 key={n.location_id} id={sectionId(block.law, n.location_id)} className="mt-[1.8em] scroll-mt-[calc(var(--header-height)+3.5rem)] text-[0.95em] italic">
            {label(n)}
          </h3>
        ) : null
      )}
    </div>
  )
}

function CodeBlock({ block }: { block: Block }) {
  const { gotos, pending } = useReader()
  const code = React.useRef<CodeViewHandle | null>(null)
  const { text, lines } = React.useMemo(() => {
    let text = ""
    let line = 0
    const lines = new Map<string, number>()
    for (const n of block.nodes) {
      const body = unescape(n.text).replace(/\s+$/, "").replace(/\n[ \t]*(?:\n[ \t]*)+/g, "\n")
      if (n.title || LEAF.has(n.doc_type)) lines.set(n.location_id, line)
      const chunk = (body || label(n)) + "\n"
      text += chunk
      line += chunk.split("\n").length - 1
    }
    return { text, lines }
  }, [block.nodes])
  const goto = React.useCallback(
    (location: string) => {
      const at = lines.get(location)
      if (at === undefined || !code.current) return false
      code.current.goto(at)
      return true
    },
    [lines]
  )
  React.useEffect(() => {
    gotos.current.set(block.law, goto)
    const p = pending.current
    if (p?.law === block.law) {
      pending.current = null
      window.setTimeout(() => goto(p.location), 80)
    }
    return () => void gotos.current.delete(block.law)
  }, [block.law, goto, gotos, pending])
  return (
    <div data-block={block.key}>
      <CodeView ref={code} grow text={text} wrap fold />
    </div>
  )
}

/** The text, in the center column. */
export function LawDocument() {
  const r = useReader()
  const s = useReaderSettings()
  const scrolledUp = React.useRef(false)

  // Scrolling up is what lets the laws before this one in; a page opens on the law it was asked for.
  React.useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      // Scrolling up near the top of what is drawn asks for what comes before
      // it; a trigger that is already in view never fires again, so the scroll
      // itself asks.
      if (window.scrollY < last) {
        scrolledUp.current = true
        const top = r.docRef.current?.querySelector("[data-block]")?.getBoundingClientRect().top
        if (top !== undefined && top > -1600) r.loadPrev()
      }
      last = window.scrollY
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        for (const el of r.docRef.current?.querySelectorAll<HTMLElement>("[data-law]") ?? []) {
          const b = el.getBoundingClientRect()
          if (b.top <= line && b.bottom > line) return r.setCurrent(el.dataset.law!)
        }
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [r])

  // A section asked for by the address or the outline, once its block is drawn.
  React.useEffect(() => {
    const p = r.pending.current
    if (!p || r.view !== "reading") return
    const el = document.getElementById(sectionId(p.law, p.location))
    if (el) {
      r.pending.current = null
      el.scrollIntoView({ block: "start" })
    }
  }, [r.blocks, r.view, r.pending])

  // Sepia is the light theme with paper under it, while the reader is open.
  React.useEffect(() => {
    const root = document.documentElement
    if (s.theme === "sepia") root.dataset.readerTheme = "sepia"
    else delete root.dataset.readerTheme
    return () => void delete root.dataset.readerTheme
  }, [s.theme])

  // Consecutive blocks of one law are one law on the page.
  const runs: { law: string; blocks: Block[] }[] = []
  for (const b of r.blocks) {
    const run = runs.at(-1)
    if (run && run.law === b.law) run.blocks.push(b)
    else runs.push({ law: b.law, blocks: [b] })
  }
  const here = r.entryOf(r.current)

  return (
    <div
      data-not-typeset="true"
      ref={r.docRef}
      style={{ fontFamily: r.view === "reading" ? FONTS[s.font] : undefined, fontSize: SIZES[s.size], lineHeight: SPACINGS[s.spacing], textAlign: s.justify ? "justify" : undefined, hyphens: s.justify ? "auto" : undefined }}
    >
      <style>{`html[data-reader-theme="sepia"]:not(.dark){--background:#f4ecd8;--foreground:#33291b;--card:#f1e6cf;--muted:#e9dcc2;--accent:#e9dcc2;--muted-foreground:#6b5a42;--border:#dccdae}`}</style>
      {here && (
        <div className="sticky top-(--header-height) z-10 -mx-2 mb-2 border-b bg-background/95 px-2 py-2 font-sans text-sm backdrop-blur" style={{ lineHeight: 1.4 }}>
          <span className="font-medium">{here.cite}</span>
          <span className="text-muted-foreground"> · {here.name}</span>
        </div>
      )}
      <Sentinel onNear={() => scrolledUp.current && r.loadPrev()} />
      {r.blocks.length === 0 ? (
        <div aria-hidden className="flex flex-col gap-2 py-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
          ))}
        </div>
      ) : (
        runs.map((run) => {
          const entry = r.entryOf(run.law)
          return (
            <div key={run.blocks[0]!.key} data-law={run.law}>
              {entry && run.blocks[0]!.atStart && <LawStart entry={entry} />}
              {run.blocks.map((b) => (r.view === "code" ? <CodeBlock key={b.key} block={b} /> : <ReadingBlock key={b.key} block={b} s={s} />))}
            </div>
          )
        })
      )}
      <Sentinel onNear={r.loadNext} enabled={r.blocks.length > 0} />
      <div className="h-[40vh]" aria-hidden />
    </div>
  )
}

/** The outline of the law in view, in the right rail, drawn in the contents block's type. */
export function LawDocOutline() {
  const r = useReader()
  const [filter, setFilter] = React.useState("")
  const entries = r.outline ?? []
  const shown = filter.trim() ? entries.filter((e) => e.label.toLowerCase().includes(filter.trim().toLowerCase())) : entries
  const here = r.entryOf(r.current)
  return (
    <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
      <p className="h-6 truncate text-xs font-medium text-muted-foreground">
        Outline{here ? ` · ${here.cite}` : ""} · {entries.length}
      </p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter sections…"
        aria-label="Filter the outline"
        className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="-mx-2 max-h-[55svh] overflow-y-auto">
        {r.outline === null
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="mx-2 my-1.5 h-3.5" style={{ width: `${60 + ((i * 29) % 35)}%` }} />)
          : shown.map((e) => (
              <button
                key={e.location_id}
                type="button"
                onClick={() => r.open(r.current, e.location_id, e.sequence_no)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[0.8rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  !LEAF.has(e.doc_type) && "font-medium text-foreground"
                )}
              >
                <span className={cn("truncate", LEAF.has(e.doc_type) && "pl-2")}>{e.label}</span>
              </button>
            ))}
      </div>
    </div>
  )
}
