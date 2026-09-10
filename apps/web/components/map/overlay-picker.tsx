"use client"

import { CheckIcon, ChevronsUpDown, LockIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { accessTo } from "@/lib/map/access"
import {
  OVERLAYS,
  stateOverlays,
  type Overlay,
  type OverlayId,
} from "@/lib/map/overlays"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"

// The overlays, picked from the shell's header opposite the breadcrumb, on
// the footer's mode switcher (Brendan, 2026-09-09). Any number at once: the
// fills stack over the districts, the boundaries draw over the fills.
//
// A hundred and two state chambers will not fit in a menu, and all but two
// of them are locked to any one reader anyway, so the third group is the
// jurisdiction in scope — its own chambers, under its own name. Any other
// state switched on from the rail keeps a row below, so a reader is never
// left with a line they cannot put out. What is locked is drawn locked.

export function OverlayPicker({
  active,
  onToggle,
  signedIn,
  home,
}: {
  active: Set<OverlayId>
  onToggle: (id: OverlayId) => void
  signedIn: boolean
  /** The jurisdiction in scope: whose chambers the menu offers. */
  home: string
}) {
  const on = OVERLAYS.filter((o) => active.has(o.id))
  const label =
    on.length === 0
      ? "No overlay"
      : on.length <= 2
        ? on.map((o) => o.label).join(" · ")
        : `${on.length} overlays`

  const mine = stateOverlays(home)
  const elsewhere = OVERLAYS.filter(
    (o) => o.state && o.state !== home && active.has(o.id)
  )

  const Item = ({ overlay: o, label }: { overlay: Overlay; label: string }) => {
    const access = accessTo(o.id, { signedIn, home })
    // A line already drawn can always be put out, whatever the gate says of
    // switching it on — the scope can change under a reader who is mid-look.
    const shown = active.has(o.id)
    return (
      <DropdownMenuCheckboxItem
        checked={shown}
        disabled={!access.open && !shown}
        onCheckedChange={() => onToggle(o.id)}
        onSelect={(e) => e.preventDefault()}
        className="whitespace-nowrap"
        title={access.open ? undefined : access.why}
      >
        {o.color && (
          <span
            className="mr-1 inline-block h-0.5 w-3 rounded-full"
            style={{ background: o.color }}
          />
        )}
        {label}
        {access.open || shown ? (
          shown && <CheckIcon className="ml-auto size-4" />
        ) : (
          <span className="ml-auto flex items-center gap-1 pl-4 text-muted-foreground">
            <LockIcon className="size-3" />
            {access.reason}
          </span>
        )}
      </DropdownMenuCheckboxItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
          aria-label="Overlays on the map"
        >
          {label}
          <ChevronsUpDown className="size-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-max min-w-52 rounded-lg"
      >
        {(["Congress", "Boundaries"] as const).map((group, i) => (
          <div key={group}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group}
            </DropdownMenuLabel>
            {OVERLAYS.filter((o) => o.group === group).map((o) => (
              <Item key={o.id} overlay={o} label={o.label} />
            ))}
          </div>
        ))}
        {mine.length > 0 && (
          <div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {stateName(home)}
            </DropdownMenuLabel>
            {mine.map((o) => (
              <Item key={o.id} overlay={o} label={o.chamber!} />
            ))}
          </div>
        )}
        {elsewhere.length > 0 && (
          <div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Also on
            </DropdownMenuLabel>
            {elsewhere.map((o) => (
              <Item
                key={o.id}
                overlay={o}
                label={`${stateName(o.state!)} ${o.chamber}`}
              />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
