"use client"

/* eslint-disable react-hooks/refs -- `useDrag` returns its ref object for the
 * caller to attach with `ref={d.ref}`, which is ordinary React: the ref is
 * PASSED during render, never read. The rule cannot tell the difference between
 * handing a ref to JSX and dereferencing one, and `d.moved.current` is read
 * inside an event handler. Contorting correct code around the heuristic would
 * make this worse, not safer. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Copy, SquareDashedMousePointer } from "lucide-react"

/**
 * The inspector — ⌥/⌘-hover to X-ray the page, ⌥/⌘-click to pin an element
 * and copy where it lives. The corner dock opens the panel.
 *
 * Ported from 44b (Brendan, 2026-09-12) to run beside @react-trace/kit until
 * one of them wins. The two differ in what they can answer: react-trace reads
 * the compiled frame out of React's debug stack and prints it, which on this
 * stack is always a chunk offset; this asks /api/dev-locate to search the
 * source forward and comes back with a real `file:line`.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN `react-dev-inspector`. That library (and
 * `click-to-react-component`) reads `fiber._debugSource` — the
 * {fileName, lineNumber, columnNumber} object React's development JSX transform
 * used to stamp on every element. React 19 REMOVED it: measured against
 * react-dom 19.2.4, `_debugSource` occurs zero times and jsxDEV's last two
 * parameters went from `source, self` to `debugStack, debugTask`. Both
 * libraries fail here for the same reason, so neither is the other's fallback.
 * This reads `_debugOwner` for the component chain and asks `/api/dev-locate`
 * for the file — see that route for why mapping the compiled frame back is
 * impossible on this stack.
 *
 * THE COLOURS ARE THE POINT. Elements are tinted by the LAYER of the file they
 * resolve to, and the layer rows filter the page. Most of the DOM being amber
 * or red is the finding, not a bug.
 *
 * Development only — next.config aliases this module to an empty stub
 * otherwise, which is what actually keeps it out of the bundle. A
 * `process.env` guard alone does not: it kills the body while the module still
 * ships. Measured.
 */

const IS_DEV = process.env.NODE_ENV === "development"

/** ⌥ or ⌘ arms it. 44b was ⌥ alone; ⌘ is the one that gets reached for here,
 *  and the cost is that a ⌘-click is swallowed while the tool is armed. */
const HELD = (e: MouseEvent | KeyboardEvent) => e.altKey || e.metaKey

/** Wrappers that own an element without being where it is written. */
const FRAMEWORK = /^(LinkComponent|Link|Image|Head|Script|Suspense|Fragment|Router|.*Provider|.*Boundary)$/

type Layer = "system" | "shared" | "page" | "unknown"
type Verdict = "extract" | "local" | "watch" | "unique"

const LAYERS: Layer[] = ["system", "shared", "page", "unknown"]
const LAYER: Record<Layer, { color: string; label: string; note: string }> = {
  system: { color: "#1c3f75", label: "Design system", note: "packages/ui/src" },
  shared: { color: "#3b6b52", label: "Shared", note: "apps/web/components" },
  page: { color: "#b0975f", label: "Page-local", note: "apps/web/app" },
  unknown: { color: "#c4564a", label: "Unresolved", note: "no owning component" },
}

/** Max wash boxes drawn at once — beyond this the browser, not the tool, is
 *  the bottleneck. The panel says when it bites. */
const WASH_CAP = 1500

const VERDICT: Record<Verdict, string> = {
  extract: "repeats across files — extract",
  local: "repeats in one file — probably a map()",
  watch: "one repeat — watch",
  unique: "no verbatim twin",
}

type Info = {
  file: string | null
  line: number | null
  layer: Layer
  exact: number
  near: number
  files: number
  examples: string[]
  verdict: Verdict
}

type Node = { el: Element; chain: string[]; desc: string; gist: string; info: Info | null }

// ── fiber reading ───────────────────────────────────────────────────────────

type Fiber = { return: Fiber | null; type: unknown; elementType: unknown; _debugOwner?: Fiber | null }

function fiberOf(node: Element): Fiber | null {
  for (const key in node) {
    if (key.startsWith("__reactFiber$")) return (node as unknown as Record<string, Fiber>)[key]
  }
  return null
}

function nameOf(f: Fiber | null | undefined): string | null {
  const t = (f?.type ?? f?.elementType) as { displayName?: string; name?: string } | string | null | undefined
  if (!t || typeof t === "string") return null
  return t.displayName ?? t.name ?? null
}

function ownerChain(fiber: Fiber | null, max = 3): string[] {
  const out: string[] = []
  let f: Fiber | null | undefined = fiber
  while (f && out.length < max) {
    const n = nameOf(f)
    if (n && !out.includes(n)) out.push(n)
    f = f._debugOwner ?? f.return
  }
  return out
}

const ownerOf = (chain: string[]) => chain.find((n) => !FRAMEWORK.test(n)) ?? chain[0] ?? ""

/** Names come from structure; DESCRIPTION comes from the DOM — three sibling
 *  divs in one shell all resolve to that shell and need telling apart. */
function describe(el: Element): string {
  const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")
  return el.tagName.toLowerCase() + (cls ? `.${cls}` : "")
}

function gistOf(el: Element): string {
  const t = (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim() ?? ""
  return t.length > 44 ? t.slice(0, 43) + "…" : t
}

const keyOf = (el: Element) => `${ownerOf(ownerChain(fiberOf(el)))}|${el.getAttribute("class") ?? ""}`

// ── dev-server lookups ──────────────────────────────────────────────────────

const one = new Map<string, Info | null>()

async function lookup(component: string, className: string): Promise<Info | null> {
  const k = `${component}|${className}`
  if (one.has(k)) return one.get(k) ?? null
  try {
    const qs = new URLSearchParams()
    if (component) qs.set("component", component)
    if (className) qs.set("class", className)
    const r = await fetch(`/api/dev-locate?${qs}`)
    const j = r.ok ? ((await r.json()) as Info) : null
    one.set(k, j)
    return j
  } catch {
    one.set(k, null)
    return null
  }
}

const where = (i: Info | null) => (i?.file ? (i.line ? `${i.file}:${i.line}` : i.file) : null)
const line = (n: Node) =>
  [where(n.info), n.chain.length ? `<${n.chain.join(" ▸ ")}>` : null, n.desc].filter(Boolean).join("  ·  ")

// ─────────────────────────────────────────────────────────────────────────────

export function DevInspector() {
  const [alt, setAlt] = useState(false)
  const [latched, setLatched] = useState(false)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<Node | null>(null)
  /** Clicking pins the highlight so the pointer can leave the element and
   *  reach the chip. Nothing tracks the mouse again until you click elsewhere
   *  or hit Escape — a chip that follows the cursor can never be clicked. */
  const [frozen, setFrozen] = useState<Node | null>(null)
  const [filter, setFilter] = useState<Set<Layer>>(new Set())
  const [scan, setScan] = useState<Map<Element, Layer> | null>(null)
  const [scanning, setScanning] = useState(false)
  const lastEl = useRef<Element | null>(null)
  const armed = alt || latched

  const read = useCallback(async (el: Element): Promise<Node> => {
    const chain = ownerChain(fiberOf(el))
    const n: Node = { el, chain, desc: describe(el), gist: gistOf(el), info: null }
    setHover(n)
    const info = await lookup(ownerOf(chain), el.getAttribute("class") ?? "")
    const full = { ...n, info }
    setHover((h) => (h?.el === el ? full : h))
    return full
  }, [])

  /** One request for the page: dedupe by (owner|class), then colour every node. */
  const scanPage = useCallback(async () => {
    setScanning(true)
    try {
      const els = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => !el.closest("[data-devinspector]") && el.getAttribute("class") && el.offsetParent !== null)
        .slice(0, 3000)
      const byKey = new Map<string, { component: string; class: string }>()
      const keyed: { el: Element; k: string }[] = []
      for (const el of els) {
        const k = keyOf(el)
        keyed.push({ el, k })
        if (!byKey.has(k)) {
          byKey.set(k, { component: k.slice(0, k.indexOf("|")), class: k.slice(k.indexOf("|") + 1) })
        }
      }
      const keys = [...byKey.keys()]
      const res = await fetch("/api/dev-locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: keys.map((k) => byKey.get(k)!) }),
      })
      const { results } = (await res.json()) as { results: { layer: Layer }[] }
      const layerByKey = new Map(keys.map((k, i) => [k, results[i]?.layer ?? "unknown"]))
      setScan(new Map(keyed.map(({ el, k }) => [el, layerByKey.get(k) ?? "unknown"])))
    } catch {
      setScan(new Map())
    } finally {
      setScanning(false)
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<Layer, number> = { system: 0, shared: 0, page: 0, unknown: 0 }
    if (scan) for (const l of scan.values()) c[l]++
    return c
  }, [scan])

  // keys — ⌥ or ⌘ arms, ⌥⇧I latches, ⌥↑/↓ walks the tree.
  useEffect(() => {
    if (!IS_DEV) return
    const down = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyI") {
        e.preventDefault()
        setLatched((v) => !v)
        return
      }
      if (HELD(e)) setAlt(true)
      if (e.key === "Escape") {
        setLatched(false)
        setAlt(false)
        setHover(null)
        setFrozen(null)
      }
      if ((HELD(e) || latched) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const cur = lastEl.current
        if (!cur) return
        e.preventDefault()
        const next =
          e.key === "ArrowUp"
            ? cur.parentElement
            : (Array.from(cur.children).find((c) => !c.closest("[data-devinspector]")) ?? null)
        if (next && next !== document.documentElement) {
          lastEl.current = next
          void read(next)
        }
      }
    }
    const up = (e: KeyboardEvent) => {
      if (!HELD(e)) setAlt(false)
    }
    const blur = () => setAlt(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [latched, read])

  const onMove = useCallback(
    (e: MouseEvent) => {
      // The modifier is read off the MOUSE event, not off keydown state
      // (Brendan, 2026-09-12: "the hover doesn't appear to be working").
      // keydown only lands if the window already holds keyboard focus, so
      // after a reload — or with focus in the devtools pane or the URL bar —
      // holding the key and moving armed nothing at all. Every mousemove
      // carries the flags, and they cannot go stale.
      const held = HELD(e)
      if (held !== alt) setAlt(held)
      if (!(held || latched) || frozen) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || el === lastEl.current || el.closest("[data-devinspector]")) return
      lastEl.current = el
      void read(el)
    },
    [alt, latched, frozen, read]
  )

  const onClick = useCallback(
    async (e: MouseEvent) => {
      if (!(HELD(e) || latched)) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || el.closest("[data-devinspector]")) return
      e.preventDefault()
      e.stopPropagation()
      const n = await read(el)
      setFrozen(n)
      setOpen(true)
    },
    [latched, read]
  )

  useEffect(() => {
    if (!IS_DEV) return
    window.addEventListener("mousemove", onMove, true)
    window.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("mousemove", onMove, true)
      window.removeEventListener("click", onClick, true)
    }
  }, [onMove, onClick])

  if (!IS_DEV) return null

  // The wash draws one absolutely-positioned box per match. A page can hold
  // 1,100 page-local nodes on its own, so this is capped — and the cap is
  // REPORTED in the panel rather than silently swallowing the rest.
  const matches = filter.size && scan ? [...scan.entries()].filter(([, l]) => filter.has(l)) : []
  const filtered = matches.slice(0, WASH_CAP)

  return (
    <>
      {/* layer wash — every matching element at once, so nothing paints over
          the thing you were looking at */}
      {filtered.length > 0 && (
        <div
          data-devinspector
          aria-hidden
          style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483640 }}
        >
          {filtered.map(([el, l], i) => {
            const r = el.getBoundingClientRect()
            if (r.width < 2 || r.height < 2) return null
            return (
              <div
                key={i}
                style={{
                  position: "fixed",
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  // The fill comes back HERE and only here. Outlines alone made
                  // a layer sweep unreadable — nested boxes vanish into each
                  // other. The hover box stays unfilled: there the tint washed
                  // the very element it was pointing at.
                  outline: `2px dotted ${LAYER[l].color}`,
                  background: `${LAYER[l].color}22`,
                  borderRadius: 2,
                }}
              />
            )
          })}
        </div>
      )}

      {(frozen ?? (armed ? hover : null)) && (
        <Chip node={(frozen ?? hover)!} frozen={!!frozen} onRelease={() => setFrozen(null)} />
      )}

      {!open && <Dock onOpen={() => setOpen(true)} />}

      {open && (
        <Panel
          onClose={() => setOpen(false)}
          latched={latched}
          setLatched={setLatched}
          counts={counts}
          scan={scan}
          scanning={scanning}
          scanPage={scanPage}
          filter={filter}
          setFilter={setFilter}
          shown={filtered.length}
          total={matches.length}
          hover={frozen ?? hover}
        />
      )}
    </>
  )
}

// ── the hovered chip ────────────────────────────────────────────────────────

/**
 * Sits ABOVE the element with a real gap and flush to its left edge. It used to
 * overlap the top of what it described, hiding the thing you were pointing at.
 * Clamped to the viewport so an element at the top or right edge still gets a
 * readable label. Click it to copy — no floating toast.
 */
function Chip({ node, frozen, onRelease }: { node: Node; frozen: boolean; onRelease: () => void }) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const r = node.el.getBoundingClientRect()
  // The outline is drawn OUTSIDE the box, so the chip aligns to r.left/r.top
  // minus its width to sit flush on the outline rather than on the element.
  // 2px, not 1.5: Chrome FLOORS a fractional outline-width, so 1.5px computed
  // back as 1px and rendered no heavier than before. Measured.
  const OUT = 2
  const above = r.top > 60
  const hue = LAYER[node.info?.layer ?? "unknown"].color

  return (
    <div data-devinspector style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483646 }}>
      {/* Outline only. A translucent fill washes the element's own content —
          you end up reading the highlight instead of the thing highlighted. */}
      <div
        style={{
          position: "fixed",
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          outline: `${OUT}px dotted ${hue}`,
          borderRadius: 2,
        }}
      />
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!frozen) {
            onRelease()
            return
          }
          void navigator.clipboard.writeText(line(node))
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        style={{
          position: "fixed",
          left: Math.max(0, Math.min(r.left - OUT, window.innerWidth - 464)),
          // translateY(-100%) puts the chip's BOTTOM on the outline's top edge,
          // exactly, whether the chip runs to two lines or three — a fixed
          // height constant guessed wrong and left the gap.
          top: above ? r.top - OUT : r.bottom + OUT,
          transform: above ? "translateY(-100%)" : undefined,
          maxWidth: 460,
          textAlign: "left",
          border: 0,
          cursor: frozen ? "pointer" : "default",
          pointerEvents: frozen ? "auto" : "none",
          background: hue,
          color: "#fff",
          padding: "5px 9px",
          paddingRight: frozen ? 26 : 9,
          borderRadius: above ? "2px 2px 0 0" : "0 0 2px 2px",
          font: "11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {node.chain.length ? node.chain.join(" ▸ ") : node.desc}
          <span style={{ opacity: 0.65, fontWeight: 400 }}>
            {"  "}
            {Math.round(r.width)}×{Math.round(r.height)}
          </span>
        </div>
        {node.info?.file && (
          <div style={{ opacity: 0.9 }}>
            {where(node.info)}
            {node.info.verdict !== "unique" ? ` · ${node.info.verdict}` : ""}
          </div>
        )}
        {/* The app's copy idiom: the icon appears on hover in the corner and
            flips to a check. A sentence explaining the click was doing the
            icon's job in three times the space. */}
        {frozen && (
          <span
            style={{
              position: "absolute",
              top: 5,
              right: 6,
              display: "flex",
              opacity: copied || hovered ? 1 : 0,
              transition: "opacity 120ms",
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>
    </div>
  )
}

// ── dragging ────────────────────────────────────────────────────────────────

function useDrag<T extends HTMLElement>(fallback: React.CSSProperties) {
  const ref = useRef<T | null>(null)
  const grab = useRef<{ dx: number; dy: number } | null>(null)
  const moved = useRef(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button:not([data-drag])")) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    moved.current = false
    setPos({ x: r.left, y: r.top })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!grab.current) return
    moved.current = true
    const w = ref.current?.offsetWidth ?? 0
    const h = ref.current?.offsetHeight ?? 0
    setPos({
      x: Math.min(Math.max(0, e.clientX - grab.current.dx), window.innerWidth - w),
      y: Math.min(Math.max(0, e.clientY - grab.current.dy), window.innerHeight - h),
    })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    grab.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  return {
    ref,
    style: pos ? { left: pos.x, top: pos.y } : fallback,
    moved,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  }
}

/**
 * @react-trace/kit's toolbar, to the numbers (Brendan, 2026-09-12), read off
 * core/dist/index.js:1697–1712 rather than guessed from a screenshot: a 32px
 * bar in #18181b with a 10px radius and its 0 4px 16px shadow, floating at
 * right: 32 and sliding flush to right: 0 when minimized, where the radius
 * goes flat on the edge it meets. The same tab RailToggle already wears.
 *
 * Theirs sits at bottom: 32. Ours sits 36 above that, so the two stack in the
 * corner and can be told apart at a glance while both are mounted.
 */
const DOCK = { bg: "#18181b", shadow: "0 4px 16px rgba(0,0,0,0.5)", h: 32, quiet: "#71717a", loud: "#fafafa" }
const DOCK_BOTTOM = 32 + 36

function Dock({ onOpen }: { onOpen: () => void }) {
  const [minimized, setMinimized] = useState(false)
  // Toward the edge closes, away from it opens — the rails' idiom.
  const Chevron = minimized ? ChevronLeft : ChevronRight

  return (
    <div
      data-devinspector
      style={{
        position: "fixed",
        bottom: DOCK_BOTTOM,
        right: minimized ? 0 : 32,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: DOCK.bg,
        borderRadius: minimized ? "10px 0 0 10px" : 10,
        boxShadow: DOCK.shadow,
        transition: "right 0.3s ease, border-radius 0.3s ease",
        userSelect: "none",
        height: DOCK.h,
        boxSizing: "border-box",
        zIndex: 2147483647,
      }}
    >
      {!minimized && (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open the inspector"
          title="Inspector — hold ⌥ or ⌘ to X-ray the page"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = DOCK.loud
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = DOCK.quiet
          }}
          style={{
            display: "flex",
            height: DOCK.h,
            width: DOCK.h,
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: "transparent",
            color: DOCK.quiet,
            cursor: "pointer",
            transition: "color 150ms",
          }}
        >
          <SquareDashedMousePointer className="size-4" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => setMinimized((v) => !v)}
        aria-label={minimized ? "Show the inspector dock" : "Send the inspector dock to the edge"}
        aria-expanded={!minimized}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = DOCK.loud
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = DOCK.quiet
        }}
        style={{
          display: "flex",
          height: DOCK.h,
          width: 16,
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          background: "transparent",
          color: DOCK.quiet,
          cursor: "pointer",
          transition: "color 150ms",
        }}
      >
        <Chevron className="size-4" aria-hidden />
      </button>
    </div>
  )
}

// ── the panel ───────────────────────────────────────────────────────────────

function Panel({
  onClose,
  latched,
  setLatched,
  counts,
  scan,
  scanning,
  scanPage,
  filter,
  setFilter,
  shown,
  total,
  hover,
}: {
  onClose: () => void
  latched: boolean
  setLatched: (v: boolean) => void
  counts: Record<Layer, number>
  scan: Map<Element, Layer> | null
  scanning: boolean
  scanPage: () => Promise<void>
  filter: Set<Layer>
  setFilter: (s: Set<Layer>) => void
  shown: number
  total: number
  hover: Node | null
}) {
  const d = useDrag<HTMLDivElement>({ top: 18, right: 18 })
  // Filtering needs the page scanned. Doing it here rather than in an effect
  // watching `filter`: the scan is a consequence of the click, not of the state.
  const toggle = (l: Layer) => {
    const n = new Set(filter)
    if (n.has(l)) n.delete(l)
    else n.add(l)
    setFilter(n)
    if (n.size && !scan && !scanning) void scanPage()
  }

  return (
    <div
      data-devinspector
      ref={d.ref}
      style={{
        position: "fixed",
        zIndex: 2147483647,
        ...d.style,
        width: 423,
        maxHeight: "calc(100vh - 36px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
        font: '13px/1.6 var(--font-sans, ui-sans-serif), sans-serif',
      }}
    >
      <div
        {...d.handlers}
        className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4"
        style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
      >
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em" }}>
          Inspector
        </span>
        <button type="button" onClick={() => setLatched(!latched)} style={pill(latched)} aria-pressed={latched} title="⌥⇧I">
          {latched ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <Head>
            <span>Layers</span>
            <button
              type="button"
              onClick={() => void scanPage()}
              style={{ ...bare, fontSize: 10, letterSpacing: "0.12em" }}
            >
              {scanning ? "SCANNING…" : scan ? "RESCAN" : "SCAN PAGE"}
            </button>
          </Head>
          {LAYERS.map((l) => {
            const on = filter.has(l)
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggle(l)}
                aria-pressed={on}
                onMouseEnter={(e) => {
                  if (!on) e.currentTarget.style.background = "var(--accent)"
                }}
                onMouseLeave={(e) => {
                  if (!on) e.currentTarget.style.background = "transparent"
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "calc(100% + 14px)",
                  textAlign: "left",
                  padding: "5px 7px",
                  margin: "0 -7px",
                  border: 0,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: on ? "var(--accent)" : "transparent",
                  color: "inherit",
                  font: "inherit",
                }}
              >
                {/* The swatch dims when a filter is on elsewhere, which says
                    "not this one" but never says "this one" outright. */}
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: LAYER[l].color,
                    opacity: on || !filter.size ? 1 : 0.35,
                  }}
                />
                <span style={{ fontSize: 12.5, fontWeight: on ? 600 : 400 }}>{LAYER[l].label}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: LAYER[l].color }} />}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {scan ? counts[l] : "—"}
                </span>
              </button>
            )
          })}
          {!scan && !scanning && <p style={note}>Click a layer, or SCAN PAGE, to count and highlight.</p>}
          {filter.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setFilter(new Set())} style={{ ...bare, fontSize: 11 }}>
                × clear filter
              </button>
              {total > shown && <span style={{ ...note, margin: 0 }}>showing {shown} of {total}</span>}
            </div>
          )}
        </div>

        <div>
          <Head>
            <span>Selection</span>
          </Head>
          {!hover ? (
            <p style={note}>Hold ⌥ or ⌘ and hover. ⌥↑ / ⌥↓ walks up and down the tree.</p>
          ) : (
            <>
              {/* The path is the answer, so it reads at full ink and full size.
                  Everything else was four lines of identical grey; the numbers
                  move into the fact strip — a 10px label over a mono value — so
                  they can be read at a glance instead of parsed. */}
              <p
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12.5,
                  wordBreak: "break-all",
                  margin: 0,
                }}
              >
                {where(hover.info) ?? "unresolved"}
              </p>
              <p style={{ ...note, marginTop: 2 }}>
                &lt;{hover.chain.join(" ▸ ") || "—"}&gt; · {hover.desc}
              </p>

              {hover.info && (
                <>
                  <div className="mt-3 grid grid-cols-3 border-t border-l border-border" style={{ borderRadius: 3 }}>
                    <Cell label="Layer">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: LAYER[hover.info.layer].color,
                          }}
                        />
                        {LAYER[hover.info.layer].label}
                      </span>
                    </Cell>
                    <Cell label="Repeats">
                      {hover.info.exact}
                      <span style={{ opacity: 0.5 }}> · ~{hover.info.near}</span>
                    </Cell>
                    <Cell label="Files">{hover.info.files}</Cell>
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 11,
                      letterSpacing: "0.02em",
                      color: hover.info.verdict === "extract" ? LAYER.page.color : "var(--muted-foreground)",
                      fontWeight: hover.info.verdict === "extract" ? 600 : 400,
                    }}
                  >
                    {VERDICT[hover.info.verdict]}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const note: React.CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: 11,
  margin: "4px 0 0",
  whiteSpace: "pre-wrap",
}

const bare: React.CSSProperties = {
  background: "none",
  border: 0,
  cursor: "pointer",
  color: "var(--muted-foreground)",
  font: "inherit",
  padding: 0,
}

const pill = (on: boolean): React.CSSProperties => ({
  padding: "3px 9px",
  borderRadius: 6,
  fontSize: 11,
  cursor: "pointer",
  border: `1px solid ${on ? LAYER.system.color : "var(--border)"}`,
  background: on ? `${LAYER.system.color}1a` : "transparent",
  color: on ? LAYER.system.color : "inherit",
})

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-r border-b border-border px-3 py-2">
      <p className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase" style={{ margin: 0 }}>
        {label}
      </p>
      <p
        className="mt-1 text-[12.5px] tabular-nums"
        style={{ margin: 0, fontFamily: "ui-monospace, monospace" }}
      >
        {children}
      </p>
    </div>
  )
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--muted-foreground)",
        margin: "0 0 6px",
      }}
    >
      {children}
    </p>
  )
}
