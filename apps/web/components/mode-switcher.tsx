"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { CheckIcon } from "lucide-react"

import { THEMES } from "@/lib/themes"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

// The header's appearance button (Brendan, 2026-09-07): the same half-shaded
// circle, now opening a small menu of the four appearances — two lights, two
// darks — and System, which follows the machine between the two originals.
// The D key still flips between the two sides of whichever pair you are in.
//
// A page may hand in its own `groups` — /unite swaps the second pair for its
// Red state and Blue state. Each group is a run of items; a separator falls
// between groups.

export type AppearanceItem = {
  key: string
  label: string
  checked: boolean
  onSelect: () => void
}

export function ModeSwitcher({
  variant = "ghost",
  className,
  groups,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"]
  className?: string
  groups?: AppearanceItem[][]
}) {
  const { setTheme, theme } = useTheme()
  const current = theme ?? "system"
  const menu = groups ?? [
    THEMES.map((t) => ({
      key: t.value,
      label: t.label,
      checked: current === t.value,
      onSelect: () => setTheme(t.value),
    })),
    [{ key: "system", label: "System", checked: current === "system", onSelect: () => setTheme("system") }],
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className={cn("group/toggle extend-touch-target size-8", className)} aria-label="Appearance">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 3l0 18" />
            <path d="M12 9l4.65 -4.65" />
            <path d="M12 14.3l7.37 -7.37" />
            <path d="M12 19.6l8.85 -8.85" />
          </svg>
          <span className="sr-only">Appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-max min-w-44 rounded-lg">
        {menu.map((group, i) => (
          <React.Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map((item) => (
              <DropdownMenuItem key={item.key} className="whitespace-nowrap" onClick={item.onSelect}>
                {item.label}
                {item.checked && <CheckIcon className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
