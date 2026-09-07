"use client"

import * as React from "react"

import { STATE_NAMES } from "@/lib/filters"
import { chamberImage, hasSeal } from "@/lib/imagery"
import { cn } from "@govblock/ui/lib/utils"

// login-04's placeholder, kept, with the fifty state seals taking turns in
// its small centre circle (Brendan, 2026-09-07: "leave it and just place the
// logo in that small placeholder"). The placeholder is shadcn's own SVG,
// drawn cover as the block draws it; its inner circle is 113.6 of 1200
// units, centred, so the seal is sized from the panel the same way. Two
// layers cross-fade; the next seal is fetched a beat ahead.

const STATES = Object.keys(STATE_NAMES).filter((code) => !["US", "DC", "PR"].includes(code) && hasSeal(code))
const EVERY = 2600
/** The inner circle's diameter as a share of the placeholder's covered size. */
const CIRCLE = 113.6 / 1200

export function SealCarousel({ className }: { className?: string }) {
  const [index, setIndex] = React.useState(0)
  const [previous, setPrevious] = React.useState<number | null>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState(48)

  React.useEffect(() => {
    // The reader who asked for stillness gets one seal.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => {
      setIndex((i) => {
        setPrevious(i)
        return (i + 1) % STATES.length
      })
    }, EVERY)
    return () => clearInterval(timer)
  }, [])

  React.useEffect(() => {
    // The seal after this one, fetched a beat ahead so the fade never waits.
    const next = new Image()
    next.src = chamberImage(STATES[(index + 1) % STATES.length])
  }, [index])

  React.useEffect(() => {
    // Cover scales the square placeholder by the panel's longer side; the
    // circle scales with it and stays at the centre.
    const el = panel.current
    if (!el) return
    const measure = () => {
      const box = el.getBoundingClientRect()
      setSize(Math.round(Math.max(box.width, box.height) * CIRCLE))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layers = [previous, index].filter((i): i is number => i != null)
  return (
    <div ref={panel} className={cn("relative h-full w-full overflow-hidden", className)} role="img" aria-label={STATE_NAMES[STATES[index]]}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/placeholder.svg" alt="" className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5f5f5] dark:bg-neutral-800" style={{ width: size, height: size }}>
        {layers.map((i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={STATES[i]} src={chamberImage(STATES[i])} alt="" className={cn("absolute inset-0 h-full w-full rounded-full object-contain transition-opacity duration-700 ease-in-out", i === index ? "opacity-100" : "opacity-0")} />
        ))}
      </div>
    </div>
  )
}
