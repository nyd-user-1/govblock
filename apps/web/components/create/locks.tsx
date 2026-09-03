"use client"

import * as React from "react"
import { SquareLock01Icon, SquareUnlock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@govblock/ui/lib/utils"

// A lock per field. Shuffle leaves a locked field where it is and Reset does
// too; a lock is a decision the reader made and the tool must not undo it.
// The same shape as /typeset's locks, keyed by the field's URL key so the
// State and Design variants share one set.

type LocksContextValue = {
  locks: ReadonlySet<string>
  isLocked: (key: string) => boolean
  toggleLock: (key: string) => void
}

const LocksContext = React.createContext<LocksContextValue | null>(null)

export function LocksProvider({ children }: { children: React.ReactNode }) {
  const [locks, setLocks] = React.useState<Set<string>>(() => new Set())
  const isLocked = React.useCallback((key: string) => locks.has(key), [locks])
  const toggleLock = React.useCallback((key: string) => {
    setLocks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const value = React.useMemo(() => ({ locks, isLocked, toggleLock }), [locks, isLocked, toggleLock])
  return <LocksContext.Provider value={value}>{children}</LocksContext.Provider>
}

export function useLocks() {
  const context = React.useContext(LocksContext)
  if (!context) throw new Error("useLocks must be used within LocksProvider")
  return context
}

// Shown on hover, focus, or while locked. Hidden on a phone: there is no
// hover to reveal it and a shuffle there is a deliberate act.
export function LockButton({ param, className }: { param: string; className?: string }) {
  const { isLocked, toggleLock } = useLocks()
  const locked = isLocked(param)
  return (
    <button
      type="button"
      title={locked ? "Unlock" : "Lock"}
      aria-label={locked ? "Unlock" : "Lock"}
      onClick={(event) => {
        event.stopPropagation()
        toggleLock(param)
      }}
      data-locked={locked}
      className={cn(
        "flex size-4 cursor-pointer items-center justify-center rounded opacity-0 ring-foreground/60 transition-opacity outline-none group-focus-within/picker:opacity-100 group-hover/picker:opacity-100 focus:opacity-100 focus-visible:ring-1 data-[locked=true]:opacity-100 max-md:hidden pointer-coarse:hidden",
        className
      )}
    >
      <HugeiconsIcon icon={locked ? SquareLock01Icon : SquareUnlock01Icon} strokeWidth={2} className="size-5 text-foreground" />
    </button>
  )
}
