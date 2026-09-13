"use client"

/* eslint-disable react-hooks/refs -- `useDrag` returns its ref object for the
 * caller to attach with `ref={d.ref}`, which is ordinary React: the ref is
 * PASSED during render, never read. The rule cannot tell the difference between
 * handing a ref to JSX and dereferencing one, and `d.moved.current` is read
 * inside an event handler. Contorting correct code around the heuristic would
 * make this worse, not safer. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Component,
  Copy,
  Crosshair,
  FileCode,
  FoldVertical,
  GripVertical,
  MessageSquare,
  Settings as Cog,
  SquareDashedMousePointer,
  UnfoldVertical,
} from "lucide-react"

/**
 * Four tools on one dock.
 *
 * INSPECTOR (the crosshair) is react-trace's, borrowed whole: click it and the
 * cursor becomes a crosshair, a blue rule crosses the viewport at the pointer,
 * and whatever is under it is boxed and named. Click to pin, Escape to leave.
 * The one thing it adds is the file and line on the label.
 *
 * CLASSIFIER (the dashed pointer) opens the panel: ARM it, or hold the key
 * Settings names (none by default), and hover to read one element, or SCAN
 * PAGE to colour every element on the page by the
 * layer of the file it comes from — design system, shared, page-local, or
 * unresolved — and filter the page down to one of them.
 *
 * COMMENTS (the bubble) keeps notes against pinned elements — the file and
 * line, the owner chain, and the words — and copies the lot as one brief for
 * whoever fixes them. Kept in localStorage, so a hot reload does not eat them.
 *
 * SETTINGS (the gear): which held key reads an element, which corner the dock
 * sits in, whether a long ⌘C toggles the inspector, and the arm latch.
 *
 * Each icon turns its tool on and off, and the dock wears react-trace's blue
 * ring while a mode is running (Brendan, 2026-09-13) — before this nothing on
 * screen said whether the thing was on.
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

/** Which held key reads the element under the pointer. 44b was ⌥ alone; ⌘ was
 *  added here because it is the key that gets reached for — and that is the
 *  trouble with it (Brendan, 2026-09-13: ⌘ held for anything else raised the
 *  chip). Off unless Settings says otherwise; ARM and the crosshair still work. */
type Hold = "off" | "alt" | "meta" | "both"
const HOLDS: { value: Hold; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "alt", label: "⌥" },
  { value: "meta", label: "⌘" },
  { value: "both", label: "⌥ or ⌘" },
]
const HOLD_NAME: Record<Hold, string> = { off: "", alt: "⌥", meta: "⌘", both: "⌥ or ⌘" }
const heldBy = (hold: Hold) => (e: MouseEvent | KeyboardEvent) =>
  hold === "both" ? e.altKey || e.metaKey : hold === "alt" ? e.altKey : hold === "meta" ? e.metaKey : false

/** Wrappers that own an element without being where it is written. */
const FRAMEWORK = /^(LinkComponent|Link|Image|Head|Script|Suspense|Fragment|Router|.*Provider|.*Boundary)$/

type Layer = "system" | "shared" | "page" | "unknown"
type Verdict = "extract" | "local" | "watch" | "unique"

const LAYERS: Layer[] = ["system", "shared", "page", "unknown"]

/**
 * One icon per layer, and the icon is the argument (Brendan, 2026-09-12 — the
 * design system gets lucide's `Component`, the rest are mine to justify). They
 * read as one scale: how far along the extraction path a piece of markup has
 * got, WITHIN THIS PROJECT.
 *
 *   Component  — an extracted component, part of this project's design system.
 *                Lucide's own name for the thing, and the only one Brendan
 *                specified.
 *   Boxes      — more than one box: extracted and reused, but living in the
 *                app rather than the design system. Plural is the point.
 *   FileCode   — not a component at all. Markup written into the file that
 *                uses it, which is what page-local means.
 *   CircleHelp — we could not resolve it. Says "unknown" rather than dressing
 *                a miss up as a finding.
 *
 * ⚠ A PUBLISHED REGISTRY HAS NO BEARING ON ANY OF THIS (Brendan, 2026-09-12).
 * The tool predates that project and audits one codebase at a time; publishing
 * is a stage most projects never reach, and letting it decide what counts as a
 * component would gate the early work this exists to help with. If a module
 * ever lists the extracted components as registry-ready, that is a separate
 * surface with its own affordance — not a fifth layer, and not a demotion of
 * anything here.
 */
const LAYER: Record<
  Layer,
  { color: string; label: string; note: string; Icon: typeof Component; iconColor?: string }
> = {
  system: { color: "#7c3aed", label: "Design system", note: "packages/ui/src", Icon: Component },
  shared: { color: "#2f9e5e", label: "Shared", note: "apps/web/components", Icon: Boxes },
  // Brendan's own, picked in devtools against the running page (2026-09-12):
  // between Tailwind's yellow-400 and yellow-500, where the ported #b0975f was
  // a duller, browner thing that three different adjectives from me failed to
  // describe. The chip and the page wash stay orange — a yellow chip on a
  // yellow row is what sent him to orange in the first place.
  page: { color: "#e07a1f", label: "Page", note: "apps/web/app", Icon: FileCode, iconColor: "#f0b800" },
  unknown: { color: "#d92d20", label: "Unresolved", note: "no owning component", Icon: CircleHelp },
}

/** What an icon is drawn in, which is not always what the layer is drawn in. */
const inkOf = (l: Layer) => LAYER[l].iconColor ?? LAYER[l].color

/** Max wash boxes drawn at once — beyond this the browser, not the tool, is
 *  the bottleneck. The panel says when it bites. */
const WASH_CAP = 1500

const VERDICT: Record<Verdict, string> = {
  extract: "repeats across files — extract",
  local: "repeats in one file — probably a map()",
  watch: "one repeat — watch",
  unique: "no verbatim twin",
}

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left"
const CORNERS: { value: Corner; label: string }[] = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
]

/** The gear's settings, kept in this browser. */
type Prefs = { corner: Corner; hold: Hold; minimized: boolean }
const PREFS: Prefs = { corner: "bottom-right", hold: "off", minimized: false }
const PREFS_KEY = "devinspector:prefs"

/** A note against an element, kept in this browser: what the tool could say
 *  about the element when the note was made, and the words. The element itself
 *  is not kept — a reload makes a new one. */
type Comment = { id: string; path: string; where: string | null; chain: string; desc: string; gist: string; text: string }
const COMMENTS_KEY = "devinspector:comments"

/** The comments as one brief, the file first — that is the point of the tool. */
const briefOf = (cs: Comment[]) =>
  cs.map((c) => `${c.where ?? "unresolved"}  <${c.chain || "—"}>  ${c.desc}  on ${c.path}\n  ${c.text}`).join("\n\n")

type Info = {
  file: string | null
  line: number | null
  layer: Layer
  /** Resolved by searching every file rather than one — treat as a guess. */
  loose?: boolean
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

/** Deep enough to walk past the framework wrappers to something of ours. */
const lookupChain = (el: Element) => ownerChain(fiberOf(el), 8)
const keyOf = (el: Element) => `${lookupChain(el).join(",")}|${el.getAttribute("class") ?? ""}`

// ── dev-server lookups ──────────────────────────────────────────────────────

const one = new Map<string, Info | null>()

async function lookup(chain: string[], className: string): Promise<Info | null> {
  const k = `${chain.join(",")}|${className}`
  if (one.has(k)) return one.get(k) ?? null
  try {
    const qs = new URLSearchParams()
    if (chain.length) qs.set("chain", chain.join(","))
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
  /** Inspect mode: react-trace's, to the pixel — a crosshair cursor, a blue
   *  rule across the viewport at the pointer, and the element under it boxed
   *  and named. No modifier held; the crosshair on the dock turns it on. */
  const [inspecting, setInspecting] = useState(false)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  /** Up here rather than inside Tree: the key handler has to know which rows
   *  are drawn to step to the next one. */
  const [expanded, setExpanded] = useState<Set<Element>>(new Set())
  /** Bumped on scroll and resize so the boxes re-measure; the rects are read
   *  during render, so a re-render is the whole update. */
  const [, setTick] = useState(0)
  /** Which of the dock's popovers is up. */
  const [tool, setTool] = useState<"comments" | "settings" | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(PREFS)
  const [comments, setComments] = useState<Comment[]>([])
  /** The dock waits for the saved prefs, or a dock you sent to the edge would
   *  open on every reload and then jump shut (Brendan, 2026-09-13). */
  const [ready, setReady] = useState(false)
  const lastEl = useRef<Element | null>(null)
  /** The inspector on or off: the long press, the dock's crosshair and the gear's switch all pull this one handle. */
  const toggleInspect = useCallback(() => {
    setInspecting((v) => !v)
    setFrozen(null)
    setHover(null)
    lastEl.current = null
  }, [])
  /** The key handler is mounted once; without this it would close over the
   *  selection as it stood then, and walking would always start from null. */
  const frozenRef = useRef<Node | null>(null)
  frozenRef.current = frozen
  const armed = alt || latched || inspecting
  const HELD = useMemo(() => heldBy(prefs.hold), [prefs.hold])

  // Read once the browser is there, so the first render matches the server's.
  useEffect(() => {
    if (!IS_DEV) return
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null")
      if (p) setPrefs({ ...PREFS, ...p })
      const c = JSON.parse(localStorage.getItem(COMMENTS_KEY) ?? "[]")
      if (Array.isArray(c)) setComments(c)
    } catch {}
    setReady(true)
  }, [])
  const savePrefs = (next: Prefs) => {
    setPrefs(next)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {}
  }
  const saveComments = (next: Comment[]) => {
    setComments(next)
    try {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(next))
    } catch {}
  }

  const read = useCallback(async (el: Element): Promise<Node> => {
    const chain = ownerChain(fiberOf(el))
    const n: Node = { el, chain, desc: describe(el), gist: gistOf(el), info: null }
    setHover(n)
    const info = await lookup(lookupChain(el), el.getAttribute("class") ?? "")
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
      const byKey = new Map<string, { chain: string; class: string }>()
      const keyed: { el: Element; k: string }[] = []
      for (const el of els) {
        const k = keyOf(el)
        keyed.push({ el, k })
        if (!byKey.has(k)) {
          byKey.set(k, { chain: k.slice(0, k.indexOf("|")), class: k.slice(k.indexOf("|") + 1) })
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
      // Keys typed into the dock's own fields are text, not commands — an
      // arrow in the comment box must not walk the tree.
      if ((e.target as HTMLElement | null)?.closest?.("[data-devinspector] :is(input, textarea, select)")) {
        if (e.key === "Escape") setTool(null)
        return
      }
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
        setInspecting(false)
        setTool(null)
        // Including the full-page layer wash, which had no way out but the
        // panel (Brendan, 2026-09-12).
        setFilter(new Set())
      }
      const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
      if ((HELD(e) || latched || inspecting) && ARROWS.includes(e.key)) {
        // Walk from whatever is pinned, or from the last thing hovered.
        const cur = frozenRef.current?.el ?? lastEl.current
        if (!cur) return
        e.preventDefault()
        /**
         * The tree's axes, not a flat list of rows (Brendan, 2026-09-12): down
         * goes INTO a thing — card, to the link, to the span, to the text —
         * and left and right step its siblings. Walking the drawn rows instead
         * meant ⌥↓ on a card just cycled the other six cards, which is sideways
         * motion wearing a down arrow.
         */
        const sibs = cur.parentElement ? kidsOf(cur.parentElement) : []
        const at = sibs.indexOf(cur)
        const next =
          e.key === "ArrowUp"
            ? cur.parentElement
            : e.key === "ArrowDown"
              ? (kidsOf(cur)[0] ?? null)
              : e.key === "ArrowLeft"
                ? (sibs[at - 1] ?? null)
                : (sibs[at + 1] ?? null)
        if (next && next !== document.documentElement) {
          lastEl.current = next
          // A pinned selection MOVES (Brendan, 2026-09-12). Before this the
          // walk only ever updated `hover`, and the pin drawn on top of it
          // meant nothing on screen changed at all.
          void read(next).then((n) => {
            if (frozenRef.current) setFrozen(n)
          })
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
  }, [latched, inspecting, read, HELD])

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
      if (inspecting) setMouse({ x: e.clientX, y: e.clientY })
      // In inspect mode the hover keeps moving after a pin — you are meant to
      // go on looking. In classifier mode the pin freezes it so the chip can
      // be reached with the pointer.
      if (!(held || latched || inspecting) || (frozen && !inspecting)) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || el === lastEl.current || el.closest("[data-devinspector]")) return
      lastEl.current = el
      void read(el)
    },
    [alt, latched, inspecting, frozen, read, HELD]
  )

  const onClick = useCallback(
    async (e: MouseEvent) => {
      if (!(HELD(e) || latched || inspecting)) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || el.closest("[data-devinspector]")) return
      e.preventDefault()
      e.stopPropagation()
      const n = await read(el)
      setFrozen(n)
      if (!inspecting) setOpen(true)
    },
    [latched, inspecting, read, HELD]
  )

  /**
   * Long-press ⌘C, their ⌘X (core/dist/index.js:942 — 600ms, releasing early
   * cancels). One deliberate difference: they preventDefault the keydown,
   * which kills native Cut for as long as the tool is mounted. ⌘C is Copy, and
   * a page you cannot copy from is a worse tool than no shortcut, so the
   * default stands — a quick ⌘C still copies, and a held one toggles this.
   * Always live (Brendan, 2026-09-13): the shortcut and the gear's switch are
   * two handles on the same state, the inspector itself — one is never a
   * setting that disables the other.
   */
  useEffect(() => {
    if (!IS_DEV) return
    let timer: number | null = null
    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }
    const down = (e: KeyboardEvent) => {
      const mod = navigator.platform.startsWith("Mac") ? e.metaKey : e.ctrlKey
      if (e.key !== "c" || !mod || e.repeat || timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        // A toggle, the same as the dock's crosshair (Brendan, 2026-09-13):
        // the press that opens it closes it.
        toggleInspect()
      }, 600)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "Meta" || e.key === "Control") cancel()
    }
    document.addEventListener("keydown", down)
    document.addEventListener("keyup", up)
    return () => {
      document.removeEventListener("keydown", down)
      document.removeEventListener("keyup", up)
      cancel()
    }
  }, [toggleInspect])

  // Everything above the selection opens, so the row it lands on is drawn —
  // without re-rooting, which is what used to throw the ancestors off the top.
  useEffect(() => {
    if (!frozen) return
    setExpanded((prev) => {
      const n = new Set(prev)
      for (let a = frozen.el.parentElement; a; a = a.parentElement) n.add(a)
      return n
    })
  }, [frozen])

  /**
   * A stylesheet, not `body.style.cursor` (Brendan, 2026-09-12: hovering a link
   * turned the crosshair into a hand). Every element on the page carries its
   * own cursor rule and a style on <body> loses to all of them; `*` with
   * !important is the only thing that wins.
   *
   * And it stays up after a selection. react-trace drops the crosshair and the
   * rules the moment you pin something, which leaves inspect mode running with
   * nothing on screen saying so — you hover, nothing happens, and it reads as
   * broken.
   */
  useEffect(() => {
    if (!inspecting) return
    const tag = document.createElement("style")
    tag.setAttribute("data-devinspector", "")
    // Everything on the PAGE, and nothing of ours (Brendan, 2026-09-12: the
    // crosshair was running over the panel and the dock too).
    tag.textContent = [
      "*, *::before, *::after { cursor: crosshair !important }",
      "[data-devinspector], [data-devinspector] * { cursor: default !important }",
      "[data-devinspector] button, [data-devinspector] [role=switch], [data-devinspector] select { cursor: pointer !important }",
      "[data-devinspector] textarea { cursor: text !important }",
      "[data-devinspector] [data-grip] { cursor: grab !important }",
    ].join("\n")
    document.head.append(tag)
    return () => tag.remove()
  }, [inspecting])

  useEffect(() => {
    if (!inspecting) return
    const update = () => setTick((t) => t + 1)
    window.addEventListener("scroll", update, { passive: true, capture: true })
    window.addEventListener("resize", update, { passive: true })
    return () => {
      window.removeEventListener("scroll", update, { capture: true })
      window.removeEventListener("resize", update)
    }
  }, [inspecting])

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

      {/* Two visual languages, never at once: react-trace's blue while the
          crosshair is on, ours — the layer colour — while a modifier is. */}
      {inspecting && <TraceOverlay hovered={hover} pinned={frozen} mouse={mouse} />}

      {!inspecting && (frozen ?? (armed ? hover : null)) && (
        <Chip node={(frozen ?? hover)!} frozen={!!frozen} onRelease={() => setFrozen(null)} />
      )}

      {/* The dock stays while the panel is open (Brendan, 2026-09-12) — the
          crosshair has to stay reachable with the module up. */}
      {ready && <Dock
        inspecting={inspecting}
        onInspect={toggleInspect}
        open={open}
        onOpen={() => setOpen((v) => !v)}
        latched={latched}
        setLatched={setLatched}
        tool={tool}
        setTool={setTool}
        pinned={frozen}
        comments={comments}
        setComments={saveComments}
        prefs={prefs}
        setPrefs={savePrefs}
      />}

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
          selected={frozen}
          onSelect={(el) => {
            void read(el).then(setFrozen)
          }}
          expanded={expanded}
          setExpanded={setExpanded}
          hold={prefs.hold}
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

// ── inspect mode, in react-trace's colours ──────────────────────────────────

/**
 * @react-trace/core's Overlay, matched to its own numbers
 * (core/dist/index.js:1248–1345): a 1px rule across the viewport at the
 * pointer, a dashed box on what is under it, a solid one once it is picked,
 * and the breadcrumb on a chip 24px above. The rules disappear the moment
 * something is selected — there is nothing left to aim at.
 */
const BLUE = "#3b82f6"
const BLUE_RULE = "rgba(59,130,246,0.5)"

function TraceOverlay({
  hovered,
  pinned,
  mouse,
}: {
  hovered: Node | null
  pinned: Node | null
  mouse: { x: number; y: number } | null
}) {
  // The pin is what the chip describes; the hover is drawn behind it so you
  // can see what the next click would take (Brendan, 2026-09-12).
  const node = pinned ?? hovered
  const selected = !!pinned
  const ghost = pinned && hovered && hovered.el !== pinned.el ? hovered.el.getBoundingClientRect() : null
  const r = node?.el.getBoundingClientRect() ?? null
  const [copied, setCopied] = useState(false)
  const text = node ? [node.chain.join(" › ") || node.desc, where(node.info)].filter(Boolean).join(" ") : ""
  const chipLayer = LAYER[node?.info?.layer ?? "unknown"]

  return (
    <div
      data-devinspector
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483645 }}
    >
      {mouse && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: mouse.x,
              width: 1,
              height: "100dvh",
              background: BLUE_RULE,
            }}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              top: mouse.y,
              height: 1,
              width: "100dvw",
              background: BLUE_RULE,
            }}
          />
        </>
      )}

      {ghost && (
        <div
          style={{
            position: "fixed",
            top: ghost.top,
            left: ghost.left,
            width: ghost.width,
            height: ghost.height,
            background: "rgba(59,130,246,0.07)",
            border: "2px dashed rgba(59,130,246,0.7)",
            borderRadius: 2,
            boxSizing: "border-box",
          }}
        />
      )}

      {r && (
        <>
          <div
            style={{
              position: "fixed",
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
              background: selected ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.07)",
              border: selected ? `2px solid ${BLUE}` : "2px dashed rgba(59,130,246,0.7)",
              borderRadius: 2,
              boxSizing: "border-box",
            }}
          />
          {/* Their breadcrumb is the component chain; ours carries the file
              and line too, which is the whole reason this exists — so it is a
              button, and the click copies it. Live only once the element is
              pinned: while you are still hovering, a clickable label sitting
              over the page would eat the click meant to pin it. */}
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              void navigator.clipboard.writeText(text)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1200)
            }}
            style={{
              position: "fixed",
              top: Math.max(0, r.top - 24),
              left: r.left,
              display: "flex",
              alignItems: "center",
              gap: 5,
              border: 0,
              // The chip is the layer's colour now (Brendan, 2026-09-12), so
              // what a thing IS reads off the label without a legend.
              background: selected ? chipLayer.color : `${chipLayer.color}d9`,
              color: "#fff",
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              lineHeight: "18px",
              pointerEvents: selected ? "auto" : "none",
              cursor: selected ? "pointer" : "default",
            }}
          >
            <chipLayer.Icon className="size-3 shrink-0" aria-hidden />
            {text}
            {/* Shown in both states, live in one. Hiding it while hovering
                read as a missing feature (Brendan, 2026-09-12); dimmed, it
                says "pin this and I am yours" instead. */}
            {copied ? (
              <Check className="size-3 shrink-0" aria-hidden />
            ) : (
              <Copy className="size-3 shrink-0" style={{ opacity: selected ? 1 : 0.55 }} aria-hidden />
            )}
          </button>
        </>
      )}
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
    if ((e.target as HTMLElement).closest("button:not([data-drag]), [data-nodrag]")) return
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
    /** Back to the fallback — for when the fallback itself changes. */
    reset: () => setPos(null),
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
 * Theirs sits 32 from the edge. Ours sits 36 further in on the vertical, so the
 * two stack in the corner and can be told apart at a glance while both are
 * mounted.
 */
const DOCK = { bg: "#18181b", shadow: "0 4px 16px rgba(0,0,0,0.5)", h: 32, quiet: "#71717a", loud: "#fafafa" }
const DOCK_INSET = 32 + 36

/** Their tooltip, to its own numbers (ui-components/dist/index.js:56–71 for
 *  the popup, :13–30 for the keycap), and their 300ms delay. */
function Tip({ label, shortcut, children }: { label: string; shortcut?: string; children: React.ReactNode }) {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(true), 300)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setShown(false)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div style={{ position: "relative", display: "flex" }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {shown && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#09090b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            padding: "5px 8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            color: "#d4d4d8",
            pointerEvents: "none",
            zIndex: 9999999,
          }}
        >
          {label}
          {shortcut && (
            <kbd
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 20,
                minWidth: 20,
                padding: "0 4px",
                borderRadius: 4,
                background: "#27272a",
                border: "1px solid #52525b",
                fontFamily: "system-ui, sans-serif",
                fontSize: 11,
                fontWeight: 500,
                color: "#a1a1aa",
              }}
            >
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  )
}

function DockButton({
  label,
  shortcut,
  on,
  badge,
  onClick,
  children,
  width = DOCK.h,
}: {
  label: string
  shortcut?: string
  on?: boolean
  /** A count in the corner, the way their Comments button wears one. */
  badge?: number
  onClick: () => void
  children: React.ReactNode
  width?: number
}) {
  return (
    <Tip label={label} shortcut={shortcut}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={on}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = DOCK.loud
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = on ? BLUE : DOCK.quiet
        }}
        style={{
          position: "relative",
          display: "flex",
          height: DOCK.h,
          width,
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          background: "transparent",
          color: on ? BLUE : DOCK.quiet,
          cursor: "pointer",
          transition: "color 150ms",
        }}
      >
        {children}
        {badge ? (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              borderRadius: 7,
              background: BLUE,
              color: "#fff",
              font: "600 9px/14px system-ui, sans-serif",
              textAlign: "center",
            }}
          >
            {badge}
          </span>
        ) : null}
      </button>
    </Tip>
  )
}

function Dock({
  inspecting,
  onInspect,
  open,
  onOpen,
  latched,
  setLatched,
  tool,
  setTool,
  pinned,
  comments,
  setComments,
  prefs,
  setPrefs,
}: {
  inspecting: boolean
  onInspect: () => void
  open: boolean
  onOpen: () => void
  latched: boolean
  setLatched: (v: boolean) => void
  tool: "comments" | "settings" | null
  setTool: (t: "comments" | "settings" | null) => void
  pinned: Node | null
  comments: Comment[]
  setComments: (c: Comment[]) => void
  prefs: Prefs
  setPrefs: (p: Prefs) => void
}) {
  // Whether the dock sits at the edge is remembered with the rest of the
  // prefs, the way react-trace remembers its own (Brendan, 2026-09-13: a
  // closed dock reopening on every reload).
  const minimized = prefs.minimized
  const right = prefs.corner.endsWith("right")
  const top = prefs.corner.startsWith("top")
  // Toward the edge closes, away from it opens — the rails' idiom.
  const Chevron = minimized === right ? ChevronLeft : ChevronRight
  // The grip is the handle; useDrag already ignores a press that lands on a
  // button, so the icons stay clickable while the bar itself drags.
  const fallback: React.CSSProperties = {}
  fallback[top ? "top" : "bottom"] = DOCK_INSET
  fallback[right ? "right" : "left"] = minimized ? 0 : 32
  const d = useDrag<HTMLDivElement>(fallback)
  const toggle = (
    <DockButton
      label={minimized ? "Show the dock" : "Send the dock to the edge"}
      width={16}
      onClick={() => {
        setPrefs({ ...prefs, minimized: !minimized })
        setTool(null)
      }}
    >
      <Chevron className="size-4" aria-hidden />
    </DockButton>
  )
  // A mode: the page under the pointer behaves differently while one is on.
  // The popovers are not modes — their icons go blue, the bar does not.
  const active = inspecting || latched || open

  return (
    <div
      data-devinspector
      ref={d.ref}
      {...d.handlers}
      style={{
        position: "fixed",
        ...d.style,
        display: "flex",
        alignItems: "center",
        overflow: "visible",
        background: DOCK.bg,
        borderRadius: minimized ? (right ? "10px 0 0 10px" : "0 10px 10px 0") : 10,
        boxShadow: DOCK.shadow,
        // Their ring, to the number (core/dist/index.js:1708): 2px of blue
        // while a mode runs, 2px of nothing otherwise so the bar never jumps.
        outline: active ? `2px solid ${BLUE}` : "2px solid transparent",
        transition: "right 0.3s ease, left 0.3s ease, border-radius 0.3s ease",
        userSelect: "none",
        touchAction: "none",
        height: DOCK.h,
        boxSizing: "border-box",
        zIndex: 2147483647,
      }}
    >
      {!right && toggle}
      {!minimized && (
        <>
          <div
            aria-hidden
            data-grip
            style={{
              display: "flex",
              height: DOCK.h,
              width: 14,
              alignItems: "center",
              justifyContent: "center",
              color: "#3f3f46",
              cursor: "grab",
            }}
          >
            <GripVertical className="size-3.5" />
          </div>
          <DockButton
            label="Inspector"
            shortcut={inspecting ? "Esc, or long-press ⌘C" : "Long-press ⌘C"}
            on={inspecting}
            onClick={onInspect}
          >
            <Crosshair className="size-4" aria-hidden />
          </DockButton>
          <DockButton label="Classifier" on={open} onClick={onOpen}>
            <SquareDashedMousePointer className="size-4" aria-hidden />
          </DockButton>
          <DockButton
            label="Comments"
            on={tool === "comments"}
            badge={comments.length}
            onClick={() => setTool(tool === "comments" ? null : "comments")}
          >
            <MessageSquare className="size-4" aria-hidden />
          </DockButton>
          <DockButton label="Settings" on={tool === "settings"} onClick={() => setTool(tool === "settings" ? null : "settings")}>
            <Cog className="size-4" aria-hidden />
          </DockButton>
        </>
      )}
      {right && toggle}
      {tool === "comments" && (
        <CommentsPop top={top} right={right} pinned={pinned} comments={comments} setComments={setComments} hold={prefs.hold} onClose={() => setTool(null)} />
      )}
      {tool === "settings" && (
        <PrefsPop
          top={top}
          right={right}
          prefs={prefs}
          setPrefs={(p) => {
            setPrefs(p)
            // A dragged bar goes back to its corner, or the new corner would
            // never show.
            d.reset()
          }}
          inspecting={inspecting}
          onInspect={onInspect}
          latched={latched}
          setLatched={setLatched}
          onClose={() => setTool(null)}
        />
      )}
    </div>
  )
}

// ── the dock's popovers ─────────────────────────────────────────────────────

/** Off the dock, on the side away from the edge it sits on. Their popup is
 *  320 wide (core/dist/index.js:1550); the surface is the panel's, since it is
 *  ours and not theirs. */
function Pop({
  top,
  right,
  title,
  actions,
  onClose,
  children,
}: {
  top: boolean
  right: boolean
  title: string
  actions?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  const at: React.CSSProperties = {}
  at[top ? "top" : "bottom"] = "calc(100% + 8px)"
  at[right ? "right" : "left"] = 0
  return (
    <div
      data-nodrag
      role="dialog"
      aria-label={title}
      style={{
        position: "absolute",
        ...at,
        width: 320,
        maxHeight: "min(60vh, 480px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
        font: "13px/1.6 var(--font-sans, ui-sans-serif), sans-serif",
        textAlign: "left",
        userSelect: "text",
        cursor: "default",
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 14, fontWeight: 500 }}>
          {title}
        </span>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
        </button>
      </div>
      <div style={{ overflowY: "auto", padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  )
}

/** A note goes on whatever is pinned; the list is every note so far, on any
 *  page, and the copy in the header is all of them as one brief. */
function CommentsPop({
  top,
  right,
  pinned,
  comments,
  setComments,
  hold,
  onClose,
}: {
  top: boolean
  right: boolean
  pinned: Node | null
  comments: Comment[]
  setComments: (c: Comment[]) => void
  hold: Hold
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const [copied, setCopied] = useState(false)
  const words = text.trim()
  const here = window.location.pathname

  const add = () => {
    if (!pinned || !words) return
    setComments([
      ...comments,
      {
        id: crypto.randomUUID(),
        path: here,
        where: where(pinned.info),
        chain: pinned.chain.join(" ▸ "),
        desc: pinned.desc,
        gist: pinned.gist,
        text: words,
      },
    ])
    setText("")
  }
  const copyAll = () => {
    void navigator.clipboard.writeText(briefOf(comments))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Pop
      top={top}
      right={right}
      title={comments.length ? `Comments · ${comments.length}` : "Comments"}
      onClose={onClose}
      actions={
        comments.length > 0 && (
          <>
            <button type="button" onClick={copyAll} title="Copy all as one brief" style={bare}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
            <button type="button" onClick={() => setComments([])} style={{ ...bare, fontSize: 11 }}>
              clear
            </button>
          </>
        )
      }
    >
      <div>
        {pinned ? (
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, margin: 0, wordBreak: "break-all" }}>
            {where(pinned.info) ?? (pinned.chain.join(" ▸ ") || pinned.desc)}
          </p>
        ) : (
          <p style={{ ...note, margin: 0 }}>
            Pin an element first — the crosshair, {hold === "off" ? "or ARM and click" : `or ${HOLD_NAME[hold]}-click`} — and the note goes on it.
          </p>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!pinned}
          placeholder="Add comment"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              add()
            }
          }}
          style={{
            marginTop: 6,
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "inherit",
            font: "inherit",
            fontSize: 12.5,
            padding: "5px 8px",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            type="button"
            onClick={add}
            disabled={!pinned || !words}
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              opacity: !pinned || !words ? 0.5 : 1,
            }}
          >
            ADD
          </button>
        </div>
      </div>
      {comments.length > 0 && (
        <div>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "5px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all", color: "var(--muted-foreground)" }}>
                  {c.where ?? (c.chain || c.desc)}
                  {c.path !== here ? ` · ${c.path}` : ""}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, whiteSpace: "pre-wrap" }}>{c.text}</p>
              </div>
              <button
                type="button"
                aria-label="Remove comment"
                onClick={() => setComments(comments.filter((x) => x.id !== c.id))}
                style={{ ...bare, fontSize: 13, lineHeight: 1, paddingTop: 3 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Pop>
  )
}

/** Their Core settings (the corner) and our two switches. */
function PrefsPop({
  top,
  right,
  prefs,
  setPrefs,
  inspecting,
  onInspect,
  latched,
  setLatched,
  onClose,
}: {
  top: boolean
  right: boolean
  prefs: Prefs
  setPrefs: (p: Prefs) => void
  inspecting: boolean
  onInspect: () => void
  latched: boolean
  setLatched: (v: boolean) => void
  onClose: () => void
}) {
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5 }
  return (
    <Pop top={top} right={right} title="Settings" onClose={onClose}>
      <label style={row}>
        <span>Hold to read the element under the pointer</span>
        <select
          value={prefs.hold}
          onChange={(e) => setPrefs({ ...prefs, hold: e.target.value as Hold })}
          style={{
            font: "inherit",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "inherit",
            padding: "3px 6px",
            cursor: "pointer",
          }}
        >
          {HOLDS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </label>
      <label style={row}>
        <span>Corner</span>
        <select
          value={prefs.corner}
          onChange={(e) => setPrefs({ ...prefs, corner: e.target.value as Corner })}
          style={{
            font: "inherit",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "inherit",
            padding: "3px 6px",
            cursor: "pointer",
          }}
        >
          {CORNERS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div style={row}>
        <span>Inspector (long-press ⌘C)</span>
        <Switch on={inspecting} onChange={(v) => { if (v !== inspecting) onInspect() }} label="Inspector (long-press ⌘C)" />
      </div>
      <div style={row}>
        <span>Keep armed (⌥⇧I)</span>
        <Switch on={latched} onChange={setLatched} label="Keep the inspector armed (⌥⇧I)" />
      </div>
    </Pop>
  )
}

// ── the tree ────────────────────────────────────────────────────────────────

/** Elements that are ours, or that carry nothing worth a row. */
const kidsOf = (el: Element) =>
  Array.from(el.children).filter((c) => !c.closest("[data-devinspector]"))

/** Every descendant that could be opened. Capped: a page's body has thousands,
 *  and a tree that long is not read, it is scrolled past. */
function descendants(el: Element, cap = 400): Element[] {
  const out: Element[] = []
  const walk = (n: Element) => {
    for (const c of kidsOf(n)) {
      if (out.length >= cap) return
      if (kidsOf(c).length) out.push(c)
      walk(c)
    }
  }
  walk(el)
  return out
}

function TreeRow({
  el,
  depth,
  expanded,
  toggle,
  onSelect,
  selectedEl,
}: {
  el: Element
  depth: number
  expanded: Set<Element>
  toggle: (el: Element) => void
  onSelect: (el: Element) => void
  selectedEl: Element | null
}) {
  const [info, setInfo] = useState<Info | null>(null)
  const [hovered, setHovered] = useState(false)
  const row = useRef<HTMLDivElement | null>(null)
  const chain = useMemo(() => ownerChain(fiberOf(el)), [el])
  const kids = kidsOf(el)
  const open = expanded.has(el)
  const isSelected = el === selectedEl

  useEffect(() => {
    let live = true
    void lookup(lookupChain(el), el.getAttribute("class") ?? "").then((i) => {
      if (live) setInfo(i)
    })
    return () => {
      live = false
    }
  }, [el, chain])

  // Walking with the keyboard has to keep the row it lands on in sight, and
  // "nearest" is the one that does not yank the whole list around to do it.
  useEffect(() => {
    if (isSelected) row.current?.scrollIntoView({ block: "nearest" })
  }, [isSelected])

  const layer = info?.layer ?? "unknown"
  const { Icon } = LAYER[layer]
  const color = inkOf(layer)

  return (
    <>
      <div
        ref={row}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 4 + depth * 12,
          paddingRight: 4,
          borderRadius: 3,
          background: isSelected ? "var(--accent)" : hovered ? "var(--muted)" : "transparent",
          minWidth: 0,
        }}
      >
        <button
          type="button"
          onClick={() => kids.length && toggle(el)}
          aria-label={open ? "Collapse" : "Expand"}
          style={{
            ...bare,
            width: 12,
            display: "flex",
            alignItems: "center",
            visibility: kids.length ? "visible" : "hidden",
          }}
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
        <button
          type="button"
          onClick={() => onSelect(el)}
          title={info?.file ? `${info.file}:${info.line}` : "unresolved"}
          style={{
            ...bare,
            display: "flex",
            minWidth: 0,
            gap: 6,
            alignItems: "baseline",
            color: "inherit",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11.5,
          }}
        >
          <span style={{ fontWeight: isSelected ? 600 : 400 }}>
            {chain[0] ?? el.tagName.toLowerCase()}
          </span>
          <span
            style={{
              color: "var(--muted-foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {info?.line ? `:${info.line}` : ""}
          </span>
        </button>
      </div>
      {open &&
        kids.map((c, i) => (
          <TreeRow
            key={i}
            el={c}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            onSelect={onSelect}
            selectedEl={selectedEl}
          />
        ))}
    </>
  )
}

/**
 * The page's tree, rooted at <body> and STAYING there (Brendan, 2026-09-12).
 * It used to re-root on whatever you selected, which shot the ancestors off
 * the top of the list and collapsed the branch you were reading. Selecting a
 * row now only highlights it; the shape of the tree is yours to set.
 */
function Tree({
  selectedEl,
  expanded,
  setExpanded,
  onSelect,
}: {
  selectedEl: Element | null
  expanded: Set<Element>
  setExpanded: React.Dispatch<React.SetStateAction<Set<Element>>>
  onSelect: (el: Element) => void
}) {
  const [allOpen, setAllOpen] = useState(false)
  const root = typeof document === "undefined" ? null : document.body

  const toggle = (el: Element) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(el)) n.delete(el)
      else n.add(el)
      return n
    })

  // One button, two states, because they are one decision (Brendan,
  // 2026-09-12). Collapsing leaves the root open — devtools' sense of it.
  const toggleAll = () => {
    if (!root) return
    setExpanded((prev) => {
      const n = new Set(prev)
      if (allOpen) for (const d of descendants(root)) n.delete(d)
      else for (const d of descendants(root)) n.add(d)
      return n.add(root)
    })
    setAllOpen((v) => !v)
  }

  if (!root) return null

  return (
    <div>
      <Head>
        <span>Tree</span>
        <button
          type="button"
          onClick={toggleAll}
          title={allOpen ? "Collapse children" : "Expand recursively"}
          style={bare}
        >
          {allOpen ? <FoldVertical className="size-4" /> : <UnfoldVertical className="size-4" />}
        </button>
      </Head>
      <div style={{ maxHeight: 260, overflowY: "auto", margin: "0 -7px" }}>
        <TreeRow
          el={root}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          onSelect={onSelect}
          selectedEl={selectedEl}
        />
      </div>
      <p style={note}>⌥↑ / ⌥↓ walks the rows. A row moves the highlight.</p>
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
  selected,
  onSelect,
  expanded,
  setExpanded,
  hold,
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
  selected: Node | null
  onSelect: (el: Element) => void
  expanded: Set<Element>
  setExpanded: React.Dispatch<React.SetStateAction<Set<Element>>>
  hold: Hold
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
        data-grip
        className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4"
        style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
      >
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em" }}>
          Inspector
        </span>
        {/* Bordered, and the switch beside it labelled — the word SCAN next to
            a bare toggle read as that toggle's label, so the scan looked
            broken while what was really being flipped was the latch
            (Brendan, 2026-09-12). */}
        <button
          type="button"
          onClick={() => void scanPage()}
          title="Resolve every element on the page"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {scanning ? "SCANNING…" : scan ? "RESCAN" : "SCAN"}
        </button>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--muted-foreground)",
            marginLeft: 4,
          }}
        >
          ARM
        </span>
        <Switch on={latched} onChange={setLatched} label="Keep the inspector armed (⌥⇧I)" />
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
                {/* The icon dims when a filter is on elsewhere, which says
                    "not this one" but never says "this one" outright. */}
                {(() => {
                  const { Icon } = LAYER[l]
                  return (
                    <Icon
                      className="size-4 shrink-0"
                      style={{ color: inkOf(l), opacity: on || !filter.size ? 1 : 0.35 }}
                      aria-hidden
                    />
                  )
                })()}
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
          {!scan && !scanning && <p style={note}>Click a layer, or SCAN, to count and highlight.</p>}
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
            <p style={note}>
              {hold === "off" ? "Turn ARM on and hover, or use the crosshair." : `Hold ${HOLD_NAME[hold]} and hover.`} ⌥↑ / ⌥↓ walks up and down the tree.
            </p>
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
                    {/* The icon alone — the row above already names the layer,
                        and the word was saying it a second time. */}
                    <Cell label="Layer">
                      {(() => {
                        const { Icon, label } = LAYER[hover.info!.layer]
                        return (
                          <Icon
                            className="size-5"
                            style={{ color: inkOf(hover.info!.layer) }}
                            aria-label={label}
                          />
                        )
                      })()}
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

        <Tree
          selectedEl={selected?.el ?? null}
          expanded={expanded}
          setExpanded={setExpanded}
          onSelect={onSelect}
        />
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

/** A real on/off, not a pill that says which it is (Brendan, 2026-09-12). */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: 28,
        height: 16,
        flexShrink: 0,
        padding: 0,
        borderRadius: 999,
        border: `1px solid ${on ? LAYER.system.color : "var(--border)"}`,
        background: on ? LAYER.system.color : "transparent",
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 1,
          left: on ? 13 : 1,
          width: 12,
          height: 12,
          borderRadius: 999,
          background: on ? "#fff" : "var(--muted-foreground)",
          transition: "left 150ms",
        }}
      />
    </button>
  )
}

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
