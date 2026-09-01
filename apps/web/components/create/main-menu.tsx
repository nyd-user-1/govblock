"use client"

import { CheckIcon, MenuIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Picker, PickerContent, PickerGroup, PickerItem, PickerSeparator, PickerShortcut, PickerTrigger } from "@/components/create/picker"

// The panel's header: which panel you are in, and the tool's menu. Ported from
// livingston-v3's MainMenu; Undo/Redo/Navigate are not wired yet.
export function MainMenu({
  mode,
  setMode,
  onShuffle,
  onReset,
  onOpenPreset,
}: {
  mode: "state" | "design"
  setMode: (mode: "state" | "design") => void
  onShuffle: () => void
  onReset: () => void
  onOpenPreset: () => void
}) {
  const { setTheme, resolvedTheme } = useTheme()
  return (
    <Picker>
      <PickerTrigger className="flex items-center justify-between gap-2 rounded-lg px-1.75 ring-1 ring-foreground/10 focus-visible:ring-1">
        <span className="font-medium">{mode === "design" ? "Design" : "State"}</span>
        <MenuIcon className="size-5" />
      </PickerTrigger>
      <PickerContent side="right" align="start" alignOffset={-8}>
        <PickerGroup>
          <PickerItem onClick={() => setMode("state")}>
            State
            {mode === "state" && <CheckIcon className="ml-auto size-4" />}
          </PickerItem>
          <PickerItem onClick={() => setMode("design")}>
            Design
            {mode === "design" && <CheckIcon className="ml-auto size-4" />}
          </PickerItem>
        </PickerGroup>
        <PickerSeparator />
        <PickerGroup>
          <PickerItem disabled>
            Navigate... <PickerShortcut>⌘P</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={onOpenPreset}>
            Open Preset... <PickerShortcut>O</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={onShuffle}>
            Shuffle <PickerShortcut>R</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            Light/Dark <PickerShortcut>D</PickerShortcut>
          </PickerItem>
        </PickerGroup>
        <PickerSeparator />
        <PickerGroup>
          <PickerItem disabled>
            Undo <PickerShortcut>⌘Z</PickerShortcut>
          </PickerItem>
          <PickerItem disabled>
            Redo <PickerShortcut>⇧⌘Z</PickerShortcut>
          </PickerItem>
          <PickerSeparator />
          <PickerItem onClick={onReset}>
            Reset <PickerShortcut>⇧R</PickerShortcut>
          </PickerItem>
        </PickerGroup>
      </PickerContent>
    </Picker>
  )
}
