"use client"

import * as React from "react"
import { CheckIcon, MenuIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Picker, PickerContent, PickerGroup, PickerItem, PickerSeparator, PickerShortcut, PickerTrigger } from "@/components/create/picker"

// The panel's header: which variant you are in, and the tool's menu. Ported
// from livingston-v3's MainMenu. Undo and Redo walk the browser's own history
// — every change the rail makes is a URL — and the shortcuts are bound here:
// R shuffles, ⇧R resets, D flips the theme, O opens a preset, S saves one.

export type Mode = "state" | "design"

export function MainMenu({
  mode,
  setMode,
  onShuffle,
  onReset,
  onOpenPreset,
  onSavePreset,
}: {
  mode: Mode
  setMode: (mode: Mode) => void
  onShuffle: () => void
  onReset: () => void
  onOpenPreset: () => void
  onSavePreset: () => void
}) {
  const { setTheme, resolvedTheme } = useTheme()
  // The platform is an external fact: read once on the client, "not a Mac"
  // in the prerendered HTML.
  const isMac = React.useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false
  )
  const toggleTheme = React.useCallback(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"), [resolvedTheme, setTheme])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if ((target instanceof HTMLElement && target.isContentEditable) || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      const key = e.key.toLowerCase()
      if (key === "r") {
        e.preventDefault()
        if (e.shiftKey) onReset()
        else onShuffle()
      } else if (key === "d") {
        e.preventDefault()
        toggleTheme()
      } else if (key === "o") {
        e.preventDefault()
        onOpenPreset()
      } else if (key === "s") {
        e.preventDefault()
        onSavePreset()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [onShuffle, onReset, onOpenPreset, onSavePreset, toggleTheme])

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
          <PickerItem onClick={onOpenPreset}>
            Open Preset... <PickerShortcut>O</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={onSavePreset}>
            Save Preset... <PickerShortcut>S</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={onShuffle}>
            Shuffle <PickerShortcut>R</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={toggleTheme}>
            Light/Dark <PickerShortcut>D</PickerShortcut>
          </PickerItem>
        </PickerGroup>
        <PickerSeparator />
        <PickerGroup>
          <PickerItem onClick={() => window.history.back()}>
            Undo <PickerShortcut>{isMac ? "⌘[" : "Alt+←"}</PickerShortcut>
          </PickerItem>
          <PickerItem onClick={() => window.history.forward()}>
            Redo <PickerShortcut>{isMac ? "⌘]" : "Alt+→"}</PickerShortcut>
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
