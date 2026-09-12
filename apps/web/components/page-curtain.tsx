"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

// A page curtain (Brendan, 2026-09-12, after motion.dev's <PageCurtain>: "a
// slanted clip-wipe page transition that carries the incoming page name across
// the screen"). Motion's is a Motion+ component, so this is ours: a coloured
// sheet with a tilted leading edge sweeps in over the page, the name of the
// page it is bringing rides across on it, the route changes under cover, and
// the sheet sweeps on out the other side. Two sheets, in fact (Brendan,
// 2026-09-12: "the second curtain… needs to be red"): the one that leads is
// the flag's blue going forward and its red coming back, and the other colour
// trails a beat behind it, so what is seen drawing back is always the second
// colour, never the page still painting underneath.
//
// The host lives in the root layout, so the sheet survives the navigation it
// covers. A link asks for a curtain with `runCurtain`; the page it lands on
// calls `useCurtainArrival` when it mounts, which is the cue to draw back.

export type CurtainDirection = "forward" | "back"

type Curtain = { id: number; direction: CurtainDirection; title: string; color: string; trail: string }
type State = { curtain: Curtain | null; phase: "cover" | "hold" | "reveal" }

const COLORS: Record<CurtainDirection, string> = { forward: "#0a3161", back: "#b31942" }
/** How far the second sheet trails the first, in seconds. */
const TRAIL = 0.18
const EASE = [0.4, 0, 0.2, 1] as const
const SWEEP = 0.6
/** The tilt of the leading edge, as motion.dev's default. */
const ANGLE = 9

let state: State = { curtain: null, phase: "cover" }
const listeners = new Set<() => void>()
const set = (next: State) => {
  state = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

let arrive: (() => void) | null = null
let covered: (() => void) | null = null
let seq = 0

/** The page a curtain lands on calls this; it releases the sheet to draw back. */
export function useCurtainArrival() {
  const pathname = usePathname()
  React.useLayoutEffect(() => {
    arrive?.()
    arrive = null
  }, [pathname])
}

/**
 * Sweep a curtain over the page, run `navigate` under it, and sweep it away
 * once the destination has mounted (or after three seconds, so a slow route
 * never leaves the page under a sheet). Resolves when the sheet is gone.
 */
export async function runCurtain({ direction, title, navigate }: { direction: CurtainDirection; title: string; navigate: () => void }) {
  if (typeof window === "undefined") return navigate()
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return navigate()
  const id = ++seq
  const curtain: Curtain = { id, direction, title, color: COLORS[direction], trail: COLORS[direction === "forward" ? "back" : "forward"] }
  const coveredPromise = new Promise<void>((resolve) => (covered = resolve))
  set({ curtain, phase: "cover" })
  await coveredPromise
  const arrived = new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 3000)
    arrive = () => {
      window.clearTimeout(timer)
      resolve()
    }
  })
  navigate()
  set({ curtain, phase: "hold" })
  await arrived
  // A beat, so the new page has painted under the sheets before they lift.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise((r) => window.setTimeout(r, 200))
  set({ curtain, phase: "reveal" })
}

/**
 * The sheet is wider than the viewport and skewed by ANGLE, so both of its
 * edges are tilted; it travels across on a transform. Off to one side, over
 * the page, off to the other. Transforms, not clip-path: a polygon that
 * changes shape mid-flight does not always animate, and a tilted sheet
 * sliding is the simpler truth of the thing anyway.
 */
const OFF = "140vw"

export function PageCurtainHost() {
  const snap = React.useSyncExternalStore(subscribe, () => state, () => state)
  const reduced = useReducedMotion()
  // The route changing under the sheet is the cue to draw it back, wherever it
  // lands (2026-09-12: every header link runs a curtain now, so no page opts in).
  useCurtainArrival()
  const { curtain, phase } = snap
  if (reduced) return null

  // Forward sweeps right to left; back sweeps left to right.
  const forward = curtain?.direction === "forward"
  const from = forward ? OFF : `-${OFF}`
  const to = forward ? `-${OFF}` : OFF
  const revealing = phase === "reveal"
  const sheet = "absolute top-[-20%] left-[-20vw] h-[140%] w-[140vw]"
  // The name rides a little slower than the sheet, so it reads.
  const ride = forward ? ["24vw", "0vw", "-24vw"] : ["-24vw", "0vw", "24vw"]

  return (
    <AnimatePresence>
      {curtain && (
        <div key={curtain.id} aria-hidden className="pointer-events-auto fixed inset-0 z-[100] overflow-hidden">
          {/* The second sheet, behind the first and a beat behind it. */}
          <motion.div
            className={sheet}
            style={{ background: curtain.trail, skewX: -ANGLE }}
            initial={{ x: from }}
            animate={{ x: revealing ? to : "0vw" }}
            transition={{ duration: SWEEP, ease: EASE, delay: TRAIL }}
            onAnimationComplete={() => {
              if (state.curtain?.id === curtain.id && state.phase === "reveal") set({ curtain: null, phase: "cover" })
            }}
          />
          {/* The first sheet, carrying the name. */}
          <motion.div
            className={sheet}
            style={{ background: curtain.color, skewX: -ANGLE }}
            initial={{ x: from }}
            animate={{ x: revealing ? to : "0vw" }}
            transition={{ duration: SWEEP, ease: EASE }}
            onAnimationComplete={() => {
              if (state.curtain?.id === curtain.id && state.phase === "cover") covered?.()
            }}
          >
            {/* Un-skewed, so the words stand upright on the tilted sheet. */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `skewX(${ANGLE}deg)` }}>
              <motion.span
                className="px-6 text-center font-semibold tracking-tight text-balance text-white"
                style={{ fontSize: "clamp(2.5rem, 9vw, 9rem)", lineHeight: 1 }}
                initial={{ x: ride[0], opacity: 0 }}
                animate={revealing ? { x: ride[2], opacity: 0 } : { x: ride[1], opacity: 1 }}
                transition={{ duration: SWEEP, ease: EASE }}
              >
                {curtain.title}
              </motion.span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
