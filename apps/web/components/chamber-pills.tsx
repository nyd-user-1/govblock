"use client"

import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

// The chamber pills a card's footer uses, shared: House (or Assembly) and
// Senate, one or none pressed (Brendan, 2026-09-01). The chambers are handed
// in (2026-09-12: the card foot names them from the jurisdiction), so the
// pills travel with no hook behind them.
export function ChamberPills({ value, onChange, chambers }: { value: string; onChange: (chamber: string) => void; chambers: string[] }) {
  return (
    <ToggleGroup value={value ? [value] : []} onValueChange={(next) => onChange(String(next?.[0] ?? ""))} variant="outline" spacing={1}>
      {chambers.map((name) => (
        // The pressed pill is the lit one — filled, in the foreground — and
        // the other sits dim, so the pair reads as a choice made rather than
        // two switched on (Brendan, 2026-09-07).
        <ToggleGroupItem
          key={name}
          value={name}
          className="text-muted-foreground hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
