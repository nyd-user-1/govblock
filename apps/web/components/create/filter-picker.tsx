"use client"

import { cn } from "@govblock/ui/lib/utils"
import { Picker, PickerContent, PickerGroup, PickerLabel, PickerRadioGroup, PickerRadioItem, PickerTrigger } from "@/components/create/picker"

// One picker for every field: the same trigger (label over value) and the same
// menu, so the panel reads as one instrument. Ported from livingston-v3's
// FilterPicker; the menu is sized to the panel it opens from.

export type Option = { value: string; label: string; hint?: string }
const ALL = "__all__"

export function FilterPicker({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
  trailing,
  className,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  /** The "any" row; null hides it (a State is always chosen). */
  allLabel?: string | null
  /** A glyph at the right of the trigger — a colour dot, "Aa", an icon. */
  trailing?: React.ReactNode
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  const shown = current?.label ?? (value || allLabel || "")
  return (
    <div className={cn("group/picker relative", className)}>
      <Picker>
        <PickerTrigger className="w-full">
          <div className="flex min-w-0 flex-1 flex-col justify-start text-left">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium text-foreground">{shown}</div>
          </div>
          {trailing && <span className="ml-auto shrink-0 text-muted-foreground">{trailing}</span>}
        </PickerTrigger>
        <PickerContent side="right" align="start">
          <PickerRadioGroup value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : String(next))}>
            <PickerGroup>
              <PickerLabel>{label}</PickerLabel>
              {allLabel !== null && <PickerRadioItem value={ALL}>{allLabel}</PickerRadioItem>}
              {options.map((o) => (
                <PickerRadioItem key={o.value} value={o.value}>
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{o.hint}</span>}
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
    </div>
  )
}
