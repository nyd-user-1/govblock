"use client"

import { useMemo } from "react"
import { motion } from "motion/react"

// The wave loader (Brendan, 2026-09-20: "stop giving me plain text loaders …
// use this"): a ball bouncing along fifteen bars that rise to meet it. What a
// panel shows while it waits for something — a run's log, a run's progress —
// in place of a sentence saying it is waiting. His component as given, on this
// repo's motion import; the theme follows the page's instead of a prop.
export function WavePhysicsLoader({ className }: { className?: string }) {
  const numBars = 15
  const barTotalWidth = 12 + 8
  const numFrames = 201
  const B = 4
  const maxBounce = 60
  const baseBarH = 16
  const wavePeakH = 48

  const { bars, ballX, ballY, ballScaleX, ballScaleY, times } = useMemo(() => {
    const barsData = Array.from({ length: numBars }).map(() => ({ heights: [] as string[], opacities: [] as number[] }))
    const bX: string[] = []
    const bY: string[] = []
    const bScaleX: number[] = []
    const bScaleY: number[] = []
    const tArr: number[] = []
    for (let k = 0; k < numFrames; k++) {
      const t = k / (numFrames - 1)
      tArr.push(t)
      const xFrac = t < 0.5 ? t / 0.5 : (1 - t) / 0.5
      const ballIdx = xFrac * (numBars - 1)
      bX.push(`${ballIdx * barTotalWidth}px`)
      let bounceF = (xFrac * B) % 1.0
      if (xFrac === 1 || xFrac === 0) bounceF = 0
      const bounceH = 4 * bounceF * (1 - bounceF)
      const heightFactor = Math.max(0, 1 - bounceH * 2)
      const ballIndent = heightFactor * 20
      bY.push(`-${baseBarH + wavePeakH - ballIndent + bounceH * maxBounce}px`)
      bScaleY.push(1 - heightFactor * 0.3)
      bScaleX.push(1 + heightFactor * 0.25)
      for (let i = 0; i < numBars; i++) {
        const dist = Math.abs(i - ballIdx)
        const wave = dist < 3 ? Math.cos((dist / 3) * (Math.PI / 2)) : 0
        const indent = dist < 1.5 ? Math.cos((dist / 1.5) * (Math.PI / 2)) * heightFactor * 20 : 0
        barsData[i].heights.push(`${Math.max(4, baseBarH + wave * wavePeakH - indent)}px`)
        // The given colours ran zinc-200 to zinc-800 by theme; here one foreground colour, faint at rest and full at the crest, so both themes are right.
        barsData[i].opacities.push(0.15 + wave * 0.85)
      }
    }
    return { bars: barsData, ballX: bX, ballY: bY, ballScaleX: bScaleX, ballScaleY: bScaleY, times: tArr }
  }, [])

  const transition = { duration: 4, repeat: Infinity, times, ease: "linear" as const }
  return (
    <div role="status" aria-label="Loading" className={className}>
      <div className="relative flex h-48 w-[292px] scale-75 items-end justify-start space-x-2">
        {bars.map((bar, i) => (
          <motion.div key={i} className="w-3 origin-bottom rounded-full bg-foreground" style={{ height: "16px", opacity: 0.15 }} animate={{ height: bar.heights, opacity: bar.opacities }} transition={transition} />
        ))}
        <motion.div className="absolute z-10 size-3 rounded-full bg-foreground shadow-sm" style={{ bottom: 0, left: 0, transformOrigin: "bottom center" }} animate={{ x: ballX, y: ballY, scaleX: ballScaleX, scaleY: ballScaleY }} transition={transition} />
      </div>
    </div>
  )
}
