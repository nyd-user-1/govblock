"use client"

import * as React from "react"

import { CONGRESS, DISTRICT, STATE_CODES, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { FlagChip } from "@/components/policy/imagery"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@govblock/ui/components/nova/command"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

// Ported from livingston-v3 components/state-switcher.tsx. The scope control:
// the two-letter code in a monospace badge plus the flag. Choosing a row writes
// the jurisdiction to the URL and to this browser's memory; every legislative
// surface reads it back through useJurisdiction.

function Rows({ codes, current, onSelect }: { codes: string[]; current: string; onSelect: (code: string) => void }) {
  return (
    <>
      {codes.map((code) => {
        const name = stateName(code)
        return (
          <CommandItem key={code} value={code} keywords={[name, code]} data-checked={code === current} onSelect={() => onSelect(code)}>
            <FlagChip state={code} />
            <span className="truncate">{name}</span>
          </CommandItem>
        )
      })}
    </>
  )
}

function StatePicker({ state, onSelect, className }: { state: string; onSelect: (code: string) => void; className?: string }) {
  return (
    <Command className={className} loop>
      <CommandInput placeholder="Search jurisdictions…" autoFocus />
      <CommandList>
        <CommandEmpty>No jurisdiction found.</CommandEmpty>
        <CommandGroup heading="Congress">
          <Rows codes={[CONGRESS]} current={state} onSelect={onSelect} />
        </CommandGroup>
        <CommandGroup heading="States">
          <Rows codes={STATE_CODES} current={state} onSelect={onSelect} />
        </CommandGroup>
        <CommandGroup heading="DC">
          <Rows codes={[DISTRICT]} current={state} onSelect={onSelect} />
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function StateSwitcher({ className }: { className?: string }) {
  const { state, setState, resolved } = useJurisdiction()
  const [open, setOpen] = React.useState(false)
  const select = React.useCallback(
    (code: string) => {
      setState(code)
      setOpen(false)
    },
    [setState]
  )

  // The prerendered HTML is shared by every visitor, so until the scope is
  // actually known the control must not claim one — otherwise a Texas visitor
  // sees "US" flash before their own jurisdiction arrives.
  const shown = resolved ? state : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={resolved ? `Jurisdiction: ${stateName(state)}. Change jurisdiction` : "Change jurisdiction"}
            className={cn("h-[31px] gap-1.5 px-2", className)}
          />
        }
      >
        <FlagChip state={shown} />
        <span className="font-mono text-xs font-medium tracking-tight">{shown || "\u00a0\u00a0"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" aria-label="Jurisdictions">
        <StatePicker state={state} onSelect={select} className="rounded-lg!" />
      </PopoverContent>
    </Popover>
  )
}
