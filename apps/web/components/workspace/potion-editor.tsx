"use client"

import * as React from "react"

import { Plate, usePlateEditor } from "platejs/react"
import { MoreHorizontalIcon } from "lucide-react"

import { PotionKit } from "@/components/plate/editor/potion-kit"
import { Editor, EditorContainer } from "@/components/plate/ui/editor"
import { ExportToolbarButton } from "@/components/plate/ui/export-toolbar-button"
import { ImportToolbarButton } from "@/components/plate/ui/import-toolbar-button"
import { Toolbar } from "@/components/plate/ui/toolbar"
import { PotionOutline } from "@/components/workspace/potion-outline"
import { Button } from "@govblock/ui/components/ny4/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { Switch } from "@govblock/ui/components/ny4/switch"
import { cn } from "@govblock/ui/lib/utils"

// Potion's page chrome (Brendan, 2026-09-10, from potion.platejs.org/editor).
// The bar above the document carries the document's name on the left and, on
// the right, what a reader does to the page rather than to a block: bring a
// file in, take one out, and the menu of how the page is set.
//
// Everything here does something. Potion's own bar also offers Collaborate,
// Publish to web, Move to Trash and who edited last; those want a document
// store behind them, and until there is one they would be four buttons that
// lie. They are left out rather than drawn dead.

type Face = "default" | "serif" | "mono"

const FACES: { value: Face; label: string; className: string }[] = [
  { value: "default", label: "Default", className: "" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
]

/** Every word in the document, counted the way a word processor counts. */
function words(nodes: unknown): number {
  const text: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== "object") return
    const record = node as { text?: unknown; children?: unknown }
    if (typeof record.text === "string") text.push(record.text)
    if (record.children) walk(record.children)
  }
  walk(nodes)
  return text.join(" ").trim().split(/\s+/).filter(Boolean).length
}

function PageMenu({
  face,
  setFace,
  small,
  setSmall,
  wide,
  setWide,
  locked,
  setLocked,
  outline,
  setOutline,
  count,
  onUndo,
}: {
  face: Face
  setFace: (face: Face) => void
  small: boolean
  setSmall: (on: boolean) => void
  wide: boolean
  setWide: (on: boolean) => void
  locked: boolean
  setLocked: (on: boolean) => void
  outline: boolean
  setOutline: (on: boolean) => void
  count: number
  onUndo: () => void
}) {
  const toggles: [string, boolean, (on: boolean) => void][] = [
    ["Small text", small, setSmall],
    ["Full width", wide, setWide],
    ["Lock page", locked, setLocked],
    ["Table of contents", outline, setOutline],
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 cursor-pointer" aria-label="How the page is set">
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-0">
        <div className="flex items-stretch gap-1 p-2">
          {FACES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFace(option.value)}
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-accent",
                face === option.value && "text-brand"
              )}
            >
              <span className={cn("text-2xl leading-none", option.className)}>Ag</span>
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          {toggles.map(([label, on, set]) => (
            <label
              key={label}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm whitespace-nowrap hover:bg-accent"
            >
              {label}
              <Switch checked={on} onCheckedChange={set} />
            </label>
          ))}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuItem className="whitespace-nowrap" onClick={onUndo}>
            Undo
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Word count: {count.toLocaleString()}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The same bill with the chrome taken away, and its shape beside it. */
export function PotionDocument({ html, name }: { html: string; name: string }) {
  const editor = usePlateEditor({ plugins: PotionKit, value: html })
  const [face, setFace] = React.useState<Face>("default")
  const [small, setSmall] = React.useState(false)
  const [wide, setWide] = React.useState(false)
  const [locked, setLocked] = React.useState(false)
  const [outline, setOutline] = React.useState(true)
  const [count, setCount] = React.useState(() => words(editor.children))
  const faceClass = FACES.find((f) => f.value === face)?.className ?? ""

  return (
    <Plate editor={editor} onValueChange={({ value }) => setCount(words(value))}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-1 px-4 py-2">
          <span className="truncate text-sm">{name}</span>
          <div className="ml-auto flex items-center gap-0.5">
            {/* Both are Radix toolbar buttons and throw outside a root. */}
            <Toolbar className="gap-0.5">
              <ImportToolbarButton />
              <ExportToolbarButton />
            </Toolbar>
            <PageMenu
              face={face}
              setFace={setFace}
              small={small}
              setSmall={setSmall}
              wide={wide}
              setWide={setWide}
              locked={locked}
              setLocked={setLocked}
              outline={outline}
              setOutline={setOutline}
              count={count}
              onUndo={() => editor.undo()}
            />
          </div>
        </div>
        <EditorContainer className="relative">
          {outline && <PotionOutline />}
          <Editor
            variant={wide ? "fullWidth" : "default"}
            readOnly={locked}
            className={cn(faceClass, small && "text-sm")}
          />
        </EditorContainer>
      </div>
    </Plate>
  )
}
