"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { lowerChamber } from "@/lib/filters"
import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

// The chamber pills the Party card's footer uses, shared: House (or Assembly)
// and Senate, one or none pressed. Brendan, 2026-09-01.
export function ChamberPills({ value, onChange }: { value: string; onChange: (chamber: string) => void }) {
  const { state } = useJurisdiction()
  const chambers = [lowerChamber(state), "Senate"]
  return (
    <ToggleGroup value={value ? [value] : []} onValueChange={(next) => onChange(String(next?.[0] ?? ""))} variant="outline" spacing={1}>
      {chambers.map((name) => (
        <ToggleGroupItem key={name} value={name}>
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
