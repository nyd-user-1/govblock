"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyRound, Link2, X } from "lucide-react"

import { HEADER_H, ROW_H, type Graph, type Link, type PlacedTable } from "@/lib/erd/model"
import { cn } from "@/lib/utils"

// The ERD on an infinite canvas: drag to pan, pinch or ⌘-wheel to zoom, a
// two-finger scroll pans. Click a table and its links light up; the panel on
// the right lists them so a neighbour is one click away. The × on a table
// takes it off the canvas for this page load only (⌘Z / ⌘⇧Z undo and redo;
// a refresh brings everything back). Every coordinate is computed in
// lib/erd/model.ts, so this component only draws.

type View = { x: number; y: number; k: number }
const MIN_K = 0.04
const MAX_K = 3

const rows = (n: number | null) => (n === null ? "" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString())
const bytes = (n: number | null) => (n === null ? "" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.round(n / 1e3)} kB`)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Edge = Link & { d: string; color: string }

function edgePath(from: PlacedTable, to: PlacedTable, fromColumn: string, toColumn: string) {
  const fi = from.columns.findIndex((c) => c.name === fromColumn)
  const ti = to.columns.findIndex((c) => c.name === toColumn)
  const sy = from.y + (fi < 0 ? HEADER_H / 2 : HEADER_H + (fi + 0.5) * ROW_H)
  const ty = to.y + (ti < 0 ? HEADER_H / 2 : HEADER_H + (ti + 0.5) * ROW_H)
  let sx: number, tx: number, c1: number, c2: number
  if (to.x >= from.x + from.w) {
    sx = from.x + from.w
    tx = to.x
    const dx = Math.max(40, (tx - sx) / 2)
    c1 = sx + dx
    c2 = tx - dx
  } else if (to.x + to.w <= from.x) {
    sx = from.x
    tx = to.x + to.w
    const dx = Math.max(40, (sx - tx) / 2)
    c1 = sx - dx
    c2 = tx + dx
  } else {
    // Stacked in one column: leave and enter on the right.
    sx = from.x + from.w
    tx = to.x + to.w
    c1 = sx + 60
    c2 = tx + 60
  }
  return `M ${sx} ${sy} C ${c1} ${sy}, ${c2} ${ty}, ${tx} ${ty}`
}

const Table = memo(function Table({ t, color, state, linkCols, onSelect, onHide }: { t: PlacedTable; color: string; state: "" | "selected" | "neighbor" | "dim"; linkCols: Map<string, boolean>; onSelect: (key: string) => void; onHide: (key: string) => void }) {
  const pk = new Set(t.pk)
  return (
    <div
      data-table={t.key}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(t.key)
      }}
      className={cn(
        "absolute cursor-pointer select-none rounded-md border bg-card text-card-foreground shadow-sm transition-opacity",
        state === "selected" && "ring-2 ring-primary",
        state === "neighbor" && "ring-2 ring-primary/40",
        state === "dim" && "opacity-30"
      )}
      style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
    >
      <div className="flex items-center gap-1.5 overflow-hidden rounded-t-md border-b px-2 text-[11px]" style={{ height: HEADER_H, boxShadow: `inset 3px 0 0 ${color}` }}>
        {t.schema !== "public" && <span className="shrink-0 text-muted-foreground">{t.schema}.</span>}
        <span className={cn("truncate font-semibold", t.kind !== "table" && "italic")}>{t.name}</span>
        {t.kind !== "table" && <span className="shrink-0 rounded border px-1 text-[9px] leading-[14px] text-muted-foreground">{t.kind === "matview" ? "matview" : "view"}</span>}
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{rows(t.rows)}</span>
        <button
          type="button"
          aria-label={`Hide ${t.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onHide(t.key)
          }}
          className="-mr-1 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
      <ul className="px-1 pt-0.5 text-[10.5px]">
        {t.columns.map((c) => {
          const isPk = pk.has(c.name)
          const link = linkCols.get(c.name)
          return (
            <li key={c.name} className="flex items-center gap-1 overflow-hidden whitespace-nowrap px-1" style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}>
              <span className="flex w-3 shrink-0 items-center justify-center text-muted-foreground">
                {isPk ? <KeyRound className="size-2.5 text-amber-600" /> : link !== undefined ? <Link2 className={cn("size-2.5", link ? "text-sky-600" : "text-sky-600/50")} /> : null}
              </span>
              <span className={cn("truncate", isPk && "font-medium", c.nullable && !isPk && "text-foreground/80")}>{c.name}</span>
              <span className="ml-auto shrink-0 pl-2 text-muted-foreground">{c.type}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
})

const Layer = memo(function Layer({ graph, edges, selected, showInferred, hidden, onSelect, onHide, onHideDomain }: { graph: Graph; edges: Edge[]; selected: string | null; showInferred: boolean; hidden: ReadonlySet<string>; onSelect: (key: string) => void; onHide: (key: string) => void; onHideDomain: (id: string) => void }) {
  const colors = useMemo(() => Object.fromEntries(graph.domains.map((d) => [d.id, d.color])), [graph])
  const neighbors = useMemo(() => {
    const s = new Set<string>()
    if (!selected) return s
    for (const l of graph.links) {
      if (!showInferred && !l.declared) continue
      if (hidden.has(l.from) || hidden.has(l.to)) continue
      if (l.from === selected) s.add(l.to)
      if (l.to === selected) s.add(l.from)
    }
    return s
  }, [graph, selected, showInferred, hidden])
  const linkCols = useMemo(() => {
    const m = new Map<string, Map<string, boolean>>()
    for (const l of graph.links) {
      if (!m.has(l.from)) m.set(l.from, new Map())
      m.get(l.from)!.set(l.fromColumn, l.declared)
    }
    return m
  }, [graph])
  const empty = useMemo(() => new Map<string, boolean>(), [])
  return (
    <>
      {graph.domains.map((d) =>
        graph.tables.every((t) => t.domain !== d.id || hidden.has(t.key)) ? null : (
        <div key={d.id} className="group/domain absolute rounded-2xl border" style={{ left: d.x, top: d.y, width: d.w, height: d.h, background: `${d.color}0b`, borderColor: `${d.color}4d` }}>
          <div className="absolute left-5 top-2 whitespace-nowrap text-[18px] font-semibold" style={{ color: d.color }}>
            {d.label}
            <span className="ml-2 font-normal opacity-60">{d.count}</span>
          </div>
          <button
            type="button"
            aria-label={`Hide ${d.label}`}
            onClick={(e) => {
              e.stopPropagation()
              onHideDomain(d.id)
            }}
            className="absolute right-3 top-2 flex size-6 items-center justify-center rounded-md border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/domain:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
        )
      )}
      <svg className="absolute left-0 top-0 overflow-visible" width={graph.width} height={graph.height} style={{ pointerEvents: "none" }}>
        {edges.map((e) => {
          if (!showInferred && !e.declared) return null
          if (hidden.has(e.from) || hidden.has(e.to)) return null
          const lit = selected && (e.from === selected || e.to === selected)
          const dim = selected && !lit
          return <path key={e.id} d={e.d} fill="none" stroke={lit ? e.color : "currentColor"} strokeWidth={lit ? 2 : 1} strokeOpacity={lit ? 0.95 : dim ? 0.06 : 0.3} strokeDasharray={e.declared ? undefined : "5 4"} />
        })}
      </svg>
      {graph.tables.map((t) =>
        hidden.has(t.key) ? null : (
          <Table key={t.key} t={t} color={colors[t.domain]} state={selected ? (t.key === selected ? "selected" : neighbors.has(t.key) ? "neighbor" : "dim") : ""} linkCols={linkCols.get(t.key) ?? empty} onSelect={onSelect} onHide={onHide} />
        )
      )}
    </>
  )
})

export function ErdCanvas({ graph }: { graph: Graph }) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [showInferred, setShowInferred] = useState(true)
  const [query, setQuery] = useState("")
  // Hidden tables as a history of sets, so undo and redo are a pointer move.
  // State only: a refresh starts from everything shown.
  const [history, setHistory] = useState<{ states: ReadonlySet<string>[]; index: number }>({ states: [new Set()], index: 0 })
  const hidden = history.states[history.index]
  const canUndo = history.index > 0
  const canRedo = history.index < history.states.length - 1
  const hide = useCallback((keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys]
    setHistory((h) => {
      const current = h.states[h.index]
      if (list.every((k) => current.has(k))) return h
      const next = new Set(current)
      for (const k of list) next.add(k)
      return { states: [...h.states.slice(0, h.index + 1), next], index: h.index + 1 }
    })
    setSelected((s) => (s && list.includes(s) ? null : s))
  }, [])
  const hideDomain = useCallback((id: string) => hide(graph.tables.filter((t) => t.domain === id).map((t) => t.key)), [graph, hide])
  const undo = useCallback(() => setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) })), [])
  const redo = useCallback(() => setHistory((h) => ({ ...h, index: Math.min(h.states.length - 1, h.index + 1) })), [])
  const drag = useRef<{ px: number; py: number; view: View; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const byKey = useMemo(() => new Map(graph.tables.map((t) => [t.key, t])), [graph])
  const colors = useMemo(() => Object.fromEntries(graph.domains.map((d) => [d.id, d.color])), [graph])
  const edges = useMemo<Edge[]>(
    () =>
      graph.links.flatMap((l) => {
        const from = byKey.get(l.from)
        const to = byKey.get(l.to)
        return from && to ? [{ ...l, d: edgePath(from, to, l.fromColumn, l.toColumn), color: colors[to.domain] }] : []
      }),
    [graph, byKey, colors]
  )

  const fitTo = useCallback((x: number, y: number, w: number, h: number, maxK = 1) => {
    const el = ref.current
    if (!el) return
    const { width: cw, height: ch } = el.getBoundingClientRect()
    const k = clamp(Math.min(cw / (w + 80), ch / (h + 80)), MIN_K, maxK)
    setView({ x: (cw - w * k) / 2 - x * k, y: (ch - h * k) / 2 - y * k, k })
  }, [])
  const fitAll = useCallback(() => fitTo(0, 0, graph.width, graph.height), [fitTo, graph])
  const goTo = useCallback(
    (key: string) => {
      const t = byKey.get(key)
      const el = ref.current
      if (!t || !el) return
      const { width: cw } = el.getBoundingClientRect()
      const k = Math.max(viewRef.current.k, 0.9)
      setView({ x: cw / 2 - (t.x + t.w / 2) * k, y: 60 - t.y * k, k })
      setSelected(key)
    },
    [byKey]
  )

  useEffect(fitAll, [fitAll])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.01), MIN_K, MAX_K)
        setView({ x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k), k })
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  const zoomBy = (f: number) => {
    const el = ref.current
    if (!el) return
    const { width: cw, height: ch } = el.getBoundingClientRect()
    const v = viewRef.current
    const k = clamp(v.k * f, MIN_K, MAX_K)
    setView({ x: cw / 2 - (cw / 2 - v.x) * (k / v.k), y: ch / 2 - (ch / 2 - v.y) * (k / v.k), k })
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return graph.tables.filter((t) => !hidden.has(t.key) && (t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q)))).slice(0, 12)
  }, [graph, query, hidden])

  const current = selected ? byKey.get(selected) : null
  const related = useMemo(() => {
    if (!selected) return { out: [] as Link[], in: [] as Link[] }
    const shown = (l: Link) => !hidden.has(l.from) && !hidden.has(l.to)
    return { out: graph.links.filter((l) => l.from === selected && shown(l)), in: graph.links.filter((l) => l.to === selected && shown(l)) }
  }, [graph, selected, hidden])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border bg-muted/30">
      <div
        ref={ref}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { px: e.clientX, py: e.clientY, view: viewRef.current, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.px
          const dy = e.clientY - d.py
          if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
            // Capturing from the first press would take the click away from
            // whatever was pressed; capture only once this is a drag.
            d.moved = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          if (d.moved) setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy })
        }}
        onPointerUp={() => {
          dragged.current = drag.current?.moved ?? false
          drag.current = null
        }}
        onClickCapture={(e) => {
          // A drag that ends on a table is not a click on it.
          if (dragged.current) {
            dragged.current = false
            e.stopPropagation()
          }
        }}
        onClick={() => setSelected(null)}
      >
        <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <Layer graph={graph} edges={edges} selected={selected} showInferred={showInferred} hidden={hidden} onSelect={goTo} onHide={hide} onHideDomain={hideDomain} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
        <div className="pointer-events-auto relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                goTo(matches[0].key)
                setQuery("")
              }
            }}
            placeholder="Find a table or column"
            className="h-8 w-64 rounded-md border bg-background px-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {matches.length > 0 && (
            <ul className="absolute left-0 top-9 z-10 w-72 rounded-md border bg-popover p-1 text-sm shadow-md">
              {matches.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => {
                      goTo(t.key)
                      setQuery("")
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: colors[t.domain] }} />
                    <span className="truncate">{t.schema !== "public" ? `${t.schema}.` : ""}{t.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{rows(t.rows)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pointer-events-auto flex h-8 items-center gap-1 rounded-md border bg-background px-1 text-sm shadow-sm">
          <button type="button" onClick={() => zoomBy(1 / 1.4)} className="size-6 rounded hover:bg-accent">−</button>
          <span className="w-12 text-center tabular-nums text-xs text-muted-foreground">{Math.round(view.k * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.4)} className="size-6 rounded hover:bg-accent">+</button>
          <button type="button" onClick={fitAll} className="rounded px-2 text-xs hover:bg-accent">Fit</button>
        </div>
        <div className="pointer-events-auto flex h-8 items-center gap-1 rounded-md border bg-background px-1 text-xs shadow-sm">
          <button type="button" onClick={undo} disabled={!canUndo} title="⌘Z" className="rounded px-2 hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">Undo</button>
          <button type="button" onClick={redo} disabled={!canRedo} title="⌘⇧Z" className="rounded px-2 hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">Redo</button>
        </div>
        <label className="pointer-events-auto flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-xs shadow-sm">
          <input type="checkbox" checked={showInferred} onChange={(e) => setShowInferred(e.target.checked)} />
          inferred links
        </label>
        <div className="pointer-events-auto flex flex-wrap gap-1">
          {graph.domains.map((d) => (
            <div key={d.id} className="flex h-8 items-center rounded-md border bg-background text-xs shadow-sm">
              <button type="button" onClick={() => fitTo(d.x, d.y, d.w, d.h)} className="flex h-full items-center gap-1.5 rounded-l-md pl-2 pr-1.5 hover:bg-accent">
                <span className="size-2 rounded-full" style={{ background: d.color }} />
                {d.label}
                <span className="text-muted-foreground">{d.count}</span>
              </button>
              <button type="button" aria-label={`Hide ${d.label}`} onClick={() => hideDomain(d.id)} className="flex h-full items-center rounded-r-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {current && (
        <aside className="absolute bottom-3 right-3 top-16 w-80 overflow-y-auto rounded-md border bg-background p-3 text-sm shadow-md">
          <div className="flex items-baseline gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[current.domain] }} />
            <h2 className="truncate font-semibold">{current.schema !== "public" ? `${current.schema}.` : ""}{current.name}</h2>
            <button type="button" onClick={() => setSelected(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">close</button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {current.kind}
            {current.rows !== null && ` · ${current.rows.toLocaleString()} rows`}
            {current.bytes !== null && ` · ${bytes(current.bytes)}`}
            {` · ${current.columns.length} columns`}
            {current.pk.length > 0 && ` · key ${current.pk.join(", ")}`}
          </p>
          {related.out.length > 0 && (
            <section className="mt-3">
              <h3 className="text-xs font-medium text-muted-foreground">Points to</h3>
              <ul className="mt-1 flex flex-col gap-0.5">
                {related.out.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => goTo(l.to)} className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-accent">
                      <span className="text-muted-foreground">{l.fromColumn}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={cn("truncate", !l.declared && "italic")}>{l.to.replace(/^public\./, "")}.{l.toColumn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {related.in.length > 0 && (
            <section className="mt-3">
              <h3 className="text-xs font-medium text-muted-foreground">Pointed at by</h3>
              <ul className="mt-1 flex flex-col gap-0.5">
                {related.in.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => goTo(l.from)} className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-accent">
                      <span className={cn("truncate", !l.declared && "italic")}>{l.from.replace(/^public\./, "")}</span>
                      <span className="text-muted-foreground">.{l.fromColumn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Italic links are inferred from the column name; the database declares no foreign key for them.</p>
        </aside>
      )}
    </div>
  )
}
