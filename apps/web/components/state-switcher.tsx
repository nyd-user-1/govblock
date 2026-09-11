"use client"

import * as React from "react"

import { useAccount } from "@/lib/auth/use-account"
import { CONGRESS, DISTRICT, flagUrl, STATE_CODES, stateName } from "@/lib/filters"
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

// Active (Brendan, 2026-09-11): what the reader is entitled to — Congress,
// and once they have signed in, their home state beside it. Everyone else
// sees Congress alone at the top.
function StatePicker({ state, active, onSelect, className }: { state: string; active: string[]; onSelect: (code: string) => void; className?: string }) {
  return (
    <Command className={className} loop>
      <CommandInput placeholder="Search jurisdictions…" autoFocus />
      <CommandList>
        <CommandEmpty>No jurisdiction found.</CommandEmpty>
        <CommandGroup heading="Active">
          <Rows codes={active} current={state} onSelect={onSelect} />
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

/** Two flags as the connector icons stack: the home state in front, the American flag behind, each ringed in the page's ground. */
function FlagStack({ home }: { home: string }) {
  const flag = (code: string, className: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flagUrl(code)} alt="" width={22} height={22} className={cn("size-[22px] rounded-full object-cover ring-2 ring-background", className)} />
  )
  return (
    <span className="flex items-center" aria-hidden>
      {flag(CONGRESS, "")}
      {flag(home, "-ml-2")}
    </span>
  )
}

export function StateSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { state, setState, resolved } = useJurisdiction()
  const { account, signedIn } = useAccount()
  // The home state is the profile's (onboarding, 2026-09-11); a reader signed in before there was one keeps the header's flag as it.
  const home = account?.home ?? (signedIn && state !== CONGRESS ? state : null)
  const active = home ? [CONGRESS, home] : [CONGRESS]
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
        {/* An empty code renders /flags/.png, a 404 on every cold load. */}
        {!resolved ? <span className="size-4 shrink-0" aria-hidden /> : home ? <FlagStack home={home} /> : <FlagChip state={state} />}
        {/* Compact is the flag alone (Brendan, 2026-09-06: the switcher leads the nav, no code). The label still names the jurisdiction for a screen reader. */}
        {!compact && <span className="font-mono text-xs font-medium tracking-tight">{shown || "\u00a0\u00a0"}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" aria-label="Jurisdictions">
        <StatePicker state={state} active={active} onSelect={select} className="rounded-lg!" />
      </PopoverContent>
    </Popover>
  )
}
