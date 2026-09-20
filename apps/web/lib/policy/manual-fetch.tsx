"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

// A page that reads the policy API only when asked (Brendan, 2026-09-14). The
// night's access log showed his open /home and /workspace/blocks tabs asking
// six policy routes about thirty-five times a minute between them, each
// answer a session aggregate over Sponsors, History and Roll Call, while the
// pipeline was writing to the same cluster. Under this provider `useSnapshot`
// makes no request until the page's refresh button has been pressed; each
// press is a generation, and every hook on the page fetches again on it.
// Without the provider the hook behaves as it always has.

type ManualFetch = { generation: number; refresh: () => void }

const Context = React.createContext<ManualFetch | null>(null)

export function ManualFetchProvider({ children }: { children: React.ReactNode }) {
  const [generation, setGeneration] = React.useState(0)
  const refresh = React.useCallback(() => setGeneration((g) => g + 1), [])
  const value = React.useMemo(() => ({ generation, refresh }), [generation, refresh])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** null outside a manual page: fetch as usual. */
export function useManualFetch() {
  return React.useContext(Context)
}

/** The page's one call to the API, as a small icon; spins once per press. */
export function RefreshButton({ className, variant = "outline", what = "the numbers" }: { className?: string; variant?: "outline" | "ghost"; /** What the press reads, for the label: "the numbers", "the rail's lists". */ what?: string }) {
  const manual = useManualFetch()
  const [spinning, setSpinning] = React.useState(false)
  if (!manual) return null
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("size-7 cursor-pointer", className)}
      aria-label={manual.generation ? `Refresh ${what}` : `Load ${what}`}
      title={manual.generation ? "Refresh" : "Load"}
      onClick={() => {
        setSpinning(true)
        manual.refresh()
        window.setTimeout(() => setSpinning(false), 900)
      }}
    >
      <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
    </Button>
  )
}
