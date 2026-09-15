"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"

import { cn } from "@govblock/ui/lib/utils"

// The toolbar over a selection in the Tiptap reader and the Fork editor
// (2026-09-15), where Plate's floating toolbar stood. It reads the browser's
// selection rather than the editor's, so it works on a read-only reader too,
// and it is drawn inside the reader's scrolling container so it scrolls with
// the words.

export type SelectionAt = {
  /** The selection in the document. */
  from: number
  to: number
  text: string
  /** Where to draw, in the container's scrolled coordinates. */
  top: number
  left: number
  bottom: number
}

/** The editor's selection as the browser holds it, while it is inside the editor and not empty. */
export function useSelectionAt(editor: Editor | null, container: React.RefObject<HTMLElement | null>) {
  const [at, setAt] = React.useState<SelectionAt | null>(null)
  React.useEffect(() => {
    if (!editor) return
    const read = () => {
      const selection = window.getSelection()
      const root = container.current
      if (!selection || selection.isCollapsed || !selection.rangeCount || !root || editor.isDestroyed) return setAt(null)
      const range = selection.getRangeAt(0)
      if (!editor.view.dom.contains(range.commonAncestorContainer)) return setAt(null)
      try {
        const from = editor.view.posAtDOM(range.startContainer, range.startOffset)
        const to = editor.view.posAtDOM(range.endContainer, range.endOffset)
        const text = editor.state.doc.textBetween(Math.min(from, to), Math.max(from, to), " ").trim()
        if (!text) return setAt(null)
        const box = range.getBoundingClientRect()
        const frame = root.getBoundingClientRect()
        setAt({ from: Math.min(from, to), to: Math.max(from, to), text, top: box.top - frame.top + root.scrollTop, bottom: box.bottom - frame.top + root.scrollTop, left: box.left - frame.left + root.scrollLeft + box.width / 2 })
      } catch {
        setAt(null)
      }
    }
    const up = () => window.setTimeout(read, 0)
    const change = () => {
      if (window.getSelection()?.isCollapsed) setAt(null)
    }
    const dom = editor.view.dom
    dom.addEventListener("mouseup", up)
    dom.addEventListener("keyup", up)
    document.addEventListener("selectionchange", change)
    return () => {
      dom.removeEventListener("mouseup", up)
      dom.removeEventListener("keyup", up)
      document.removeEventListener("selectionchange", change)
    }
  }, [editor, container])
  return [at, setAt] as const
}

/** The bar itself, above the selection. */
export function SelectionToolbar({ at, children, className }: { at: SelectionAt; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("absolute z-40 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}
      style={{ top: at.top - 6, left: at.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {children}
    </div>
  )
}
