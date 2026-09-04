"use client"

import * as React from "react"
import { EllipsisIcon } from "lucide-react"

import { fileAction, useDocPref } from "@/lib/policy/doc-prefs"
import { Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// GitHub's "More file actions" menu, put to a bill (Brendan, 2026-09-03).
// The bill's views (the tab pills went that evening — "we have duplicates of
// it"), raw text to download, jump to a line, copy the path or the permalink,
// ask an agent about it, and the view options the pane reads through the
// shared preferences. There is no Delete: a bill is the legislature's file.
//
// Download and Jump to line need the text and the editor, which live in the
// pane, so they are asked for by event and the pane answers.

export type BillView = "text" | "changes" | "history" | "record" | "typeset"

export function FileActions({ path, state, billId, view, onOpen }: { path: string; state: string; billId: number; /** Which of the bill's views is showing. */ view: BillView; onOpen: (view: BillView) => void }) {
  const [fold, setFold] = useDocPref("fold", true)
  const [wrap, setWrap] = useDocPref("wrap", true)
  const [center, setCenter] = useDocPref("center", false)
  const [, setMode] = useDocPref<"read" | "code">("mode", "read")

  const copy = (text: string) => void navigator.clipboard?.writeText(text)
  const permalink = () => {
    const url = new URL(window.location.href)
    return url.toString()
  }

  // GitHub's shortcuts, the ones that make sense for a read-only file.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target
      if ((t instanceof HTMLElement && t.isContentEditable) || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        fileAction("download")
      } else if (e.metaKey && e.shiftKey && e.key === ">") {
        e.preventDefault()
        copy(path)
      } else if (e.metaKey && e.shiftKey && e.key === "<") {
        e.preventDefault()
        copy(permalink())
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault()
        setMode("code")
        fileAction("jump")
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [path, setMode])

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-7" aria-label="More file actions">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="bottom">More file actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-64 rounded-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">Open</DropdownMenuLabel>
          {(
            [
              ["text", "Text"],
              ["changes", "Changes"],
              ["history", "History"],
              ["record", "Record"],
              ["typeset", "Typeset"],
            ] as [BillView, string][]
          ).map(([value, label]) => (
            <DropdownMenuCheckboxItem key={value} checked={view === value} onCheckedChange={() => onOpen(value)}>
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">Raw text</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => fileAction("download")}>
            Download <DropdownMenuShortcut>⌘⇧S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setMode("code")
            fileAction("jump")
          }}
        >
          Jump to line <DropdownMenuShortcut>L</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => copy(path)}>
            Copy path <DropdownMenuShortcut>⌘⇧&gt;</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy(permalink())}>
            Copy permalink <DropdownMenuShortcut>⌘⇧&lt;</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">Agents</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`/agents?state=${state}&bill=${billId}`} target="_blank" rel="noreferrer">
              Ask about this bill
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">View options</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={fold} onCheckedChange={(v) => setFold(!!v)}>
            Show code folding buttons
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={wrap} onCheckedChange={(v) => setWrap(!!v)}>
            Wrap lines
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={center} onCheckedChange={(v) => setCenter(!!v)}>
            Center content
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
