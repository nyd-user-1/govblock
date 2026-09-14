"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { GitForkIcon } from "lucide-react"

import { forkAddress } from "@/lib/policy/forks"
import { Button } from "@govblock/ui/components/ny4/button"

// The fork action on the XML reader (window 5, 2026-09-14): over whichever
// unit the pointer rests on, a section, a subsection, a paragraph, a button
// forks that unit into My Files from the Expression the reader is showing,
// then opens it in the Fork view. It wraps the reader rather than living in
// it, reading the levels the reader already draws with their addresses as
// element ids.

type Target = { id: string; label: string; top: number }

export function ForkAction({ expression, billId, children }: { expression: string | null; billId?: number | null; children: React.ReactNode }) {
  const router = useRouter()
  const wrap = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const [target, setTarget] = React.useState<Target | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const onMove = (e: React.MouseEvent) => {
    if (busy || button.current?.contains(e.target as Node)) return
    const level = (e.target as HTMLElement).closest<HTMLElement>(".uslm-level[id]")
    if (!level || !wrap.current?.contains(level)) return setTarget(null)
    if (target?.id === level.id) return
    const num = level.querySelector<HTMLElement>(':scope > [data-uslm="num"]')?.textContent?.trim() ?? ""
    setFailed(false)
    setTarget({ id: level.id, label: num, top: level.getBoundingClientRect().top - wrap.current.getBoundingClientRect().top })
  }

  const fork = async () => {
    if (!target) return
    setBusy(true)
    const made = (expression ? await forkAddress(`${target.id}@${expression}`, { bill_id: billId ?? null }) : null) ?? (await forkAddress(target.id, { bill_id: billId ?? null }))
    setBusy(false)
    if (made) router.push(`/workspace/typeset/fork/${made.id}`)
    else setFailed(true)
  }

  return (
    <div ref={wrap} className="relative h-full min-h-0" onMouseMove={onMove} onMouseLeave={() => !busy && setTarget(null)} onScrollCapture={() => !busy && setTarget(null)}>
      {children}
      {target && (
        <div className="absolute right-4 z-10 flex items-center gap-2" style={{ top: Math.max(44, target.top + 4) }}>
          {failed && <span className="rounded bg-background px-1.5 text-xs text-destructive">This unit is not in the XML store.</span>}
          <Button ref={button} variant="outline" size="sm" disabled={busy} className="h-7 gap-1.5 bg-background px-2 text-xs shadow-sm" onClick={() => void fork()}>
            <GitForkIcon className="size-3.5" /> Fork {target.label}
          </Button>
        </div>
      )}
    </div>
  )
}
