"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Dropcursor } from "@tiptap/extensions"
import type { Node as PmNode } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { GripVerticalIcon } from "lucide-react"

import { insertLevel } from "@/components/workspace/typeset-xml-toolbar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// The block view (Brendan asked where it went, 2026-09-14): Plate's blocks
// layout on the USLM editor, where each unit of the law is a block. Plate
// wrapped every block in a draggable with its own gutter, handle and tooltip,
// 30,000 DOM nodes on a bill, and Typeset dropped it for that on 2026-09-13
// (777d8bd, docs/typeset-perf.md). Here one handle follows the pointer to the
// unit it rests on, in the left gutter as Plate drew it: a click selects the
// unit, a drag moves it wherever the schema lets it stand, with a drop line,
// and a right-click opens the unit's menu. Every change goes through the
// editor, so on the XML view the first one makes the reader's copy.

/** The line a dragged unit would land on. */
export const BlockDrop = Dropcursor.configure({ color: "rgb(59 130 246 / 0.6)", width: 2 })

const UNIT = ".uslm-level, .ProseMirror > [data-uslm]"

/** The unit an element sits in, and its position; null outside the document. */
function unitAt(view: EditorView, target: EventTarget | null): { pos: number; el: HTMLElement } | null {
  const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(UNIT)
  if (!el || !view.dom.contains(el)) return null
  try {
    const $pos = view.state.doc.resolve(view.posAtDOM(el, 0))
    for (let d = $pos.depth; d > 0; d--) if (view.nodeDOM($pos.before(d)) === el) return { pos: $pos.before(d), el }
  } catch {}
  return null
}

/** A copy of a unit as new law: no identifiers anywhere in it, so the amendment engine reads it as an insertion. */
function freshCopy(node: PmNode): PmNode {
  const strip = (json: { attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (json.attrs) json.attrs = { ...json.attrs, identifier: null, id: null }
    for (const child of json.content ?? []) strip(child as typeof json)
    return json
  }
  return node.type.schema.nodeFromJSON(strip(node.toJSON()))
}

type Menu = { pos: number; x: number; y: number }

export function BlockHandle({ editor, container }: { editor: Editor | null; container: React.RefObject<HTMLElement | null> }) {
  const [at, setAt] = React.useState<{ pos: number; top: number; left: number } | null>(null)
  const [menu, setMenu] = React.useState<Menu | null>(null)
  const dragging = React.useRef(false)

  React.useEffect(() => {
    const box = container.current
    if (!box || !editor) return
    let frame = 0
    const place = (target: EventTarget | null) => {
      if (dragging.current || editor.isDestroyed) return
      // Off every unit (the gutter, the way to the handle): the last one stays, so the handle can be reached.
      const unit = unitAt(editor.view, target)
      if (!unit) return
      const b = box.getBoundingClientRect()
      const r = unit.el.getBoundingClientRect()
      setAt({ pos: unit.pos, top: r.top - b.top + box.scrollTop, left: Math.max(2, r.left - b.left + box.scrollLeft - 24) })
    }
    const onMove = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-block-handle]")) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => place(e.target))
    }
    const onLeave = () => !dragging.current && setAt(null)
    const onContext = (e: MouseEvent) => {
      const unit = unitAt(editor.view, e.target)
      if (!unit) return
      e.preventDefault()
      const b = box.getBoundingClientRect()
      setMenu({ pos: unit.pos, x: e.clientX - b.left + box.scrollLeft, y: e.clientY - b.top + box.scrollTop })
    }
    box.addEventListener("mousemove", onMove)
    box.addEventListener("mouseleave", onLeave)
    box.addEventListener("contextmenu", onContext)
    return () => {
      cancelAnimationFrame(frame)
      box.removeEventListener("mousemove", onMove)
      box.removeEventListener("mouseleave", onLeave)
      box.removeEventListener("contextmenu", onContext)
    }
  }, [editor, container])

  if (!editor || editor.isDestroyed) return null

  const nodeAt = (pos: number) => {
    const node = editor.state.doc.nodeAt(pos)
    return node && !node.isText ? node : null
  }
  const select = (pos: number) => {
    if (!nodeAt(pos)) return
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
    editor.view.focus()
  }
  const run = (pos: number, action: "after" | "under" | "duplicate" | "delete" | "copy") => {
    const node = nodeAt(pos)
    if (!node) return
    const { state, view } = editor
    if (action === "copy") {
      if (node.attrs.identifier) void navigator.clipboard?.writeText(String(node.attrs.identifier))
      return
    }
    try {
      if (action === "delete") view.dispatch(state.tr.delete(pos, pos + node.nodeSize).scrollIntoView())
      else if (action === "duplicate") view.dispatch(state.tr.insert(pos + node.nodeSize, freshCopy(node)).scrollIntoView())
      else {
        // The unit's own buttons act at the cursor: put it inside this unit first.
        view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1))))
        insertLevel(editor, action)
      }
    } catch {
      // The schema refuses the change here; nothing changes.
    }
    view.focus()
  }
  const menuNode = menu ? nodeAt(menu.pos) : null

  return (
    <>
      {at && (
        <div data-block-handle contentEditable={false} className="absolute z-20 flex h-6 w-[18px] items-center" style={{ top: at.top + 2, left: at.left }}>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  draggable
                  aria-label="Drag to move"
                  className="flex h-6 w-[18px] cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  onClick={() => select(at.pos)}
                  onDragStart={(e) => {
                    const node = nodeAt(at.pos)
                    if (!node) return e.preventDefault()
                    const { view, state } = editor
                    const selection = NodeSelection.create(state.doc, at.pos)
                    view.dispatch(state.tr.setSelection(selection))
                    const slice = selection.content()
                    const { dom, text } = view.serializeForClipboard(slice)
                    e.dataTransfer.clearData()
                    e.dataTransfer.setData("text/html", dom.innerHTML)
                    e.dataTransfer.setData("text/plain", text)
                    e.dataTransfer.effectAllowed = "copyMove"
                    const el = view.nodeDOM(at.pos)
                    if (el instanceof HTMLElement) e.dataTransfer.setDragImage(el, 0, 0)
                    view.dragging = { slice, move: true }
                    dragging.current = true
                  }}
                  onDragEnd={() => {
                    dragging.current = false
                    if (!editor.isDestroyed) editor.view.dragging = null
                    setAt(null)
                  }}
                />
              }
            >
              <GripVerticalIcon className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="left">Drag to move</TooltipContent>
          </Tooltip>
        </div>
      )}
      {menu && menuNode && (
        <DropdownMenu open onOpenChange={(open) => !open && setMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span aria-hidden className="pointer-events-none absolute size-0" style={{ top: menu.y, left: menu.x }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={2} className="w-max min-w-44 rounded-lg">
            <DropdownMenuItem className="whitespace-nowrap" onClick={() => run(menu.pos, "after")}>
              Add a unit after
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" onClick={() => run(menu.pos, "under")}>
              Add a unit under
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" onClick={() => run(menu.pos, "duplicate")}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" onClick={() => run(menu.pos, "delete")}>
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" disabled={!menuNode.attrs.identifier} onClick={() => run(menu.pos, "copy")}>
              Copy address
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}
