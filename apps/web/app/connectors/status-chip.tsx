import { STATE_LABEL, type ConnectorState } from "@/lib/agents/connectors"
import { cn } from "@/lib/utils"

// The dot and the word for it. Shared by the server-rendered rows and by the
// two Google connectors, whose state only the browser can know — one component
// so the two kinds of truth at least look like the same kind of fact.
//
// The chip is the part that yields: at Popular-card width it and a name cannot
// both have the row, and a name truncated to "Go…" identifies nothing while a
// status truncated to "Not conn…" is still legible as a status.
export function StatusChip({
  state,
  label,
  className,
}: {
  state: ConnectorState | "unknown"
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          state === "connected" && "bg-emerald-500",
          state === "available" && "bg-amber-500",
          state === "unavailable" && "bg-muted-foreground/40",
          state === "unknown" && "animate-pulse bg-muted-foreground/40"
        )}
      />
      <span className="truncate">
        {label ?? (state === "unknown" ? "Checking…" : STATE_LABEL[state])}
      </span>
    </span>
  )
}
