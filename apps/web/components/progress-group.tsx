import { cn } from "@govblock/ui/lib/utils"

// The progress group (Brendan, 2026-09-20, from a context-window meter): parts
// of one whole against a limit — how full on the left, the amount over the
// limit on the right, one bar cut into the parts, then each part with its dot
// and its figure. /routes draws the build's output against Amplify's cap.

export type ProgressPart = { label: string; value: number }

// Told apart by hue in both themes; past the last the colours come round again.
const COLORS = ["bg-slate-400", "bg-violet-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-sky-400", "bg-orange-400", "bg-teal-400", "bg-fuchsia-400", "bg-lime-500", "bg-indigo-400", "bg-yellow-500", "bg-cyan-500", "bg-pink-400", "bg-stone-400"]

export function ProgressGroup({ parts, limit, format, className }: { parts: ProgressPart[]; /** What the parts are measured against. */ limit: number; format: (value: number) => string; className?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  const over = total > limit
  return (
    <div className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex items-baseline justify-between text-muted-foreground">
        <span className={cn(over && "font-medium text-destructive")}>{Math.round((total / limit) * 100)}% Full</span>
        <span className="tabular-nums">
          {format(total)} / {format(limit)}
        </span>
      </div>
      <div role="img" aria-label={`${format(total)} of ${format(limit)}`} className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((p, i) => (
          <span key={p.label} title={`${p.label}: ${format(p.value)}`} className={COLORS[i % COLORS.length]} style={{ width: `${(p.value / Math.max(limit, total)) * 100}%` }} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", COLORS[i % COLORS.length])} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="text-muted-foreground tabular-nums">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
