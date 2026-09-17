"use client"

import * as React from "react"

// Coach marks: a hole cut around one element at a time, one line beside it,
// Next and Skip. The step names an element by a data-tour value; a step
// whose element is not on the page is passed over.

export type TourStep = { target: string; text: string; pad?: number; before?: () => void }

export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = React.useState(0)
  const [box, setBox] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const step = steps[i]

  React.useEffect(() => {
    if (!step) return
    step.before?.()
    let tries = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (!el) {
        if (tries++ < 10) return void setTimeout(find, 150)
        return void setI((k) => k + 1)
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      setTimeout(() => {
        const r = el.getBoundingClientRect()
        const pad = step.pad ?? 10
        setBox({ left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 })
      }, 300)
    }
    find()
  }, [step])

  React.useEffect(() => {
    if (i >= steps.length) onDone()
  }, [i, steps.length, onDone])

  if (!step || !box) return null
  const below = box.top + box.height + 12
  const top = below + 180 < window.innerHeight ? below : Math.max(12, box.top - 190)
  const left = Math.min(window.innerWidth - 340, Math.max(12, box.left))
  return (
    <>
      <div className="pointer-events-none fixed z-[90] rounded-xl transition-all duration-300" style={{ ...box, boxShadow: "0 0 0 9999px rgba(23,23,23,.55)" }} />
      <div className="fixed z-[92] w-80 rounded-xl bg-background p-4 text-sm leading-snug shadow-2xl" style={{ top, left }}>
        <div className="mb-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
          {i + 1} of {steps.length}
        </div>
        {step.text}
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={onDone} className="rounded-lg border px-3 py-1.5 text-xs">
            Skip
          </button>
          <button type="button" onClick={() => setI(i + 1)} className="rounded-lg bg-foreground px-3 py-1.5 text-xs text-background">
            {i === steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  )
}
