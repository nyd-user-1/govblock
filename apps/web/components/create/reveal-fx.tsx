"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"

// The reveal every shell in sports and 44b uses, ported as it is: once-ui's
// mask-and-blur. A left-to-right gradient mask sweeps from hidden to shown over
// 700ms while the content settles from a 10px blur and a small rise. The blur
// is only cleared once the mask has finished — clearing it earlier breaks
// sticky headers inside. Mount it with a `key` that names what is on screen
// and the reveal replays whenever that changes.

const EASE = "cubic-bezier(0.25, 0.4, 0.25, 1)"

export function RevealFx({
  children,
  delay = 0,
  translateY = 0,
  className,
}: {
  children: React.ReactNode
  /** Seconds before the sweep starts; sections stagger by it. */
  delay?: number
  /** Pixels the content rises from. */
  translateY?: number
  className?: string
}) {
  const [on, setOn] = React.useState(false)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    const t = window.setTimeout(() => setOn(true), Math.round(delay * 1000))
    return () => window.clearTimeout(t)
  }, [delay])

  return (
    <div
      className={cn(className)}
      onTransitionEnd={(e) => {
        if (on && e.propertyName.endsWith("mask-position")) setDone(true)
      }}
      style={{
        WebkitMaskImage: done ? undefined : "linear-gradient(to right, black 0%, black 25%, transparent 50%)",
        maskImage: done ? undefined : "linear-gradient(to right, black 0%, black 25%, transparent 50%)",
        WebkitMaskSize: "400% 100%",
        maskSize: "400% 100%",
        WebkitMaskPosition: on ? "0 0" : "100% 0",
        maskPosition: on ? "0 0" : "100% 0",
        filter: done ? "none" : on ? "blur(0px)" : "blur(10px)",
        transform: `translateY(${on ? 0 : translateY}px)`,
        transition: [`mask-position 0.7s ${EASE}`, `-webkit-mask-position 0.7s ${EASE}`, `filter 0.7s ${EASE}`, `transform 0.7s ${EASE}`].join(", "),
      }}
    >
      {children}
    </div>
  )
}
