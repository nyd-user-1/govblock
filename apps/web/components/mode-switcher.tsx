"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { THEMES, type ThemeGroup } from "@/lib/themes"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

// The header's appearance button (Brendan, 2026-09-07): the same half-shaded
// circle, opening a small menu of the appearances in lib/themes.ts — Light
// Mode and Dark Mode, then their shades Slate and Charcoal — and System,
// which follows the machine between the two modes. The D key still flips
// between the two sides of whichever pair you are in.
//
// A page may hand in its own `groups`. Each group is a run of items; a
// separator falls between groups.

export type AppearanceItem = {
  key: string
  label: string
  checked: boolean
  onSelect: () => void
  /** The mark before the label; without one, the key decides (light, dark, system). */
  icon?: React.ReactNode
}

/** The half-shaded circle the button wears, in whatever colour it is given: a page's Red state and Blue state items wear it in their own colours (Brendan, 2026-09-11). */
export function AppearanceGlyph({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 3l0 18" />
      <path d="M12 9l4.65 -4.65" />
      <path d="M12 14.3l7.37 -7.37" />
      <path d="M12 19.6l8.85 -8.85" />
    </svg>
  )
}

/** A shade's mark: a circle of the page colour it changes to. */
function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="size-4 shrink-0 rounded-full border border-foreground/25" style={{ background: color }} />
}

// The menu's marks (Brendan, 2026-09-11): the sun and the moon for the two
// modes — in colour once chosen, the amber sun and the navy moon with its
// cream face that 44b's shell wears — a circle of the changed colour for
// each shade, a monitor for System, whichever page hands the items in.
function iconFor(key: string, checked: boolean) {
  switch (key) {
    case "light":
      return checked ? <SunIcon style={{ color: "#e0a13c", fill: "#e0a13c" }} /> : <SunIcon />
    case "dark":
      return checked ? <MoonIcon style={{ color: "#033882", fill: "#fdf0c9" }} /> : <MoonIcon />
    case "light-2":
      return <Swatch color="oklch(0.955 0 0)" />
    case "dark-2":
      return <Swatch color="oklch(0.2 0 0)" />
    case "system":
      return <MonitorIcon />
    default:
      return null
  }
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
    ...(["mode", "shade"] as ThemeGroup[]).map((group) =>
      THEMES.filter((t) => t.group === group).map((t) => ({
        key: t.value,
        label: t.label,
        checked: current === t.value,
        onSelect: () => setTheme(t.value),
      }))
    ),
    [{ key: "system", label: "System", checked: current === "system", onSelect: () => setTheme("system") }],
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className={cn("group/toggle extend-touch-target size-8", className)} aria-label="Appearance">
          <AppearanceGlyph className="size-4.5" />
          <span className="sr-only">Appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-max min-w-44 rounded-lg">
        {menu.map((group, i) => (
          <React.Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map((item) => (
              <DropdownMenuItem key={item.key} className="whitespace-nowrap" onClick={item.onSelect}>
                {item.icon ?? iconFor(item.key, item.checked)}
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
