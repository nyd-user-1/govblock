"use client"

import { cn } from "@govblock/ui/lib/utils"
import { LockButton } from "@/components/create/locks"
import { Picker, PickerContent, PickerGroup, PickerLabel, PickerRadioGroup, PickerRadioItem, PickerTrigger } from "@/components/create/picker"

// One picker for every field, in both variants: the same trigger (label over
// value, the glyph at the right, the lock beside it) and the same menu, so the
// panel reads as one instrument. Ported from livingston-v3's FilterPicker.
//
// The glyph sits at the right edge and the vertical middle — where
// ui.shadcn.com/create puts it — not centred under the value, which is where a
// port of 2026-09-02 had left it. The lock appears on hover to the glyph's
// left, as on /typeset.

export type Option = { value: string; label: string; hint?: string; sub?: string }
const ALL = "__all__"

export function FilterPicker({
  label,
  param,
  value,
  display,
  options,
  onChange,
  allLabel = "All",
  trailing,
  loading,
  isMobile,
  anchorRef,
  className,
}: {
  label: string
  /** The URL key: what the lock is keyed on. No lock without one. */
  param?: string
  value: string
  /** What the trigger prints when the options do not carry the value's label. */
  display?: string
  options: Option[]
  onChange: (value: string) => void
  /** The "any" row; null hides it (a State is always chosen). */
  allLabel?: string | null
  /** A glyph at the right of the trigger — a colour dot, "Aa", an icon. */
  trailing?: React.ReactNode
  loading?: boolean
  isMobile?: boolean
  anchorRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  const shown = display ?? current?.label ?? (value ? value : loading ? "…" : (allLabel ?? ""))
  const reserve = trailing && param ? "pr-14" : trailing || param ? "pr-8" : ""
  return (
    <div className={cn("group/picker relative", className)}>
      <Picker>
        <PickerTrigger className="w-full">
          <div className={cn("flex min-w-0 flex-1 flex-col justify-start text-left", reserve)}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium text-foreground">{shown}</div>
          </div>
          {trailing && (
            <span className="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground select-none md:right-2.5">
              {trailing}
            </span>
          )}
        </PickerTrigger>
        <PickerContent anchor={isMobile ? anchorRef : undefined} side={isMobile ? "top" : "right"} align={isMobile ? "center" : "start"}>
          <PickerRadioGroup value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : String(next))}>
            <PickerGroup>
              <PickerLabel>{label}</PickerLabel>
              {allLabel !== null && (
                <PickerRadioItem value={ALL} closeOnClick>
                  {allLabel}
                </PickerRadioItem>
              )}
              {options.map((o) => (
                <PickerRadioItem key={o.value} value={o.value} closeOnClick>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.sub && <span className="truncate text-xs font-normal text-neutral-400!">{o.sub}</span>}
                  </span>
                  {o.hint && <span className="ml-auto shrink-0 pl-3 text-xs font-normal text-neutral-400! tabular-nums">{o.hint}</span>}
                </PickerRadioItem>
              ))}
              {!options.length && <PickerRadioItem value="__none__" disabled>{loading ? "Loading…" : "Nothing here"}</PickerRadioItem>}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      {param && <LockButton param={param} className={cn("absolute top-1/2 -translate-y-1/2", trailing ? "right-9 md:right-8" : "right-4 md:right-2.5")} />}
    </div>
  )
}
