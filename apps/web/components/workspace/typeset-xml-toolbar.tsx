"use client"

import * as React from "react"
import { Extension, useEditorState, type Editor } from "@tiptap/react"
import { redo, redoDepth, undo, undoDepth } from "@tiptap/pm/history"
import type { Node as PmNode } from "@tiptap/pm/model"
import { TextSelection, type EditorState } from "@tiptap/pm/state"
import { BoldIcon, IndentIncreaseIcon, ItalicIcon, ListPlusIcon, Redo2Icon, StrikethroughIcon, Trash2Icon, UnderlineIcon, Undo2Icon } from "lucide-react"

import { ToolbarButton, ToolbarGroup } from "@/components/plate/ui/toolbar"
import { BIG_LEVELS, isLevel, SMALL_LEVELS } from "@/lib/xml/schema"

// The Tiptap editor's buttons on the USLM schema (window 5, 2026-09-14),
// drawn at the front of the rich-text toolbar on the XML views
// (typeset-toolbar.tsx), with the same buttons where they mean something for
// law. Undo and redo stand where
// they stand in Plate's. Formatting does not: a legislative amendment changes
// words and units, never their weight or colour, so in place of marks the
// editor adds a unit after the one at the cursor, adds one under it, or
// removes it. The schema's rank rules decide what may go where.

/** The innermost level holding the cursor. */
export function levelAt(state: EditorState): { node: PmNode; pos: number } | null {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (isLevel(node.type.name)) return { node, pos: $from.before(d) }
  }
  return null
}

/** The number after this one, where the pattern is plain: "(3)" → "(4)", "2-a" → "2-b", "§ 16" → "§ 17". */
export function nextNum(text: string): string {
  const m = /^(.*?)(\d+|[a-zA-Z])(\W*)$/.exec(text.trim())
  if (!m) return ""
  const [, head, core, tail] = m
  if (/^\d+$/.test(core)) return `${head}${Number(core) + 1}${tail}`
  // "(ii)" is a Roman numeral, not a letter to step.
  if (/[a-zA-Z]$/.test(head) || /z/i.test(core)) return ""
  return `${head}${String.fromCharCode(core.charCodeAt(0) + 1)}${tail}`
}

const ELEMENT = (n: PmNode) => (n.type.name === "level" ? String(n.attrs.element ?? "level") : n.type.name)

/** The level a unit holds next: a section holds subsections, a subsection paragraphs; a big level holds sections. */
export function childElement(parent: PmNode): string | null {
  const element = ELEMENT(parent)
  if ((BIG_LEVELS as readonly string[]).includes(element)) return "section"
  if (element === "section") return "subsection"
  const rank = (SMALL_LEVELS as readonly string[]).indexOf(element)
  return rank >= 0 && rank < SMALL_LEVELS.length - 1 ? SMALL_LEVELS[rank + 1] : null
}

/** A new, empty unit of an element, numbered, with a paragraph to type in. Its identifier is left empty: it is new law. */
function freshLevel(state: EditorState, element: string, role: string | null, num: string): PmNode | null {
  const { schema } = state
  const type = schema.nodes[element]
  if (!type) return null
  return type.create({ role }, [schema.nodes.num.create(null, num ? schema.text(num) : null), schema.nodes.content.create(null, schema.nodes.p.create())])
}

export function insertLevel(editor: Editor, where: "after" | "under") {
  const { state, view } = editor
  const at = levelAt(state)
  if (!at) return
  const numText = at.node.firstChild?.type.name === "num" ? at.node.firstChild.textContent : ""
  let node: PmNode | null
  let pos: number
  if (where === "after") {
    node = freshLevel(state, at.node.type.name, (at.node.attrs.role as string | null) ?? null, nextNum(numText))
    pos = at.pos + at.node.nodeSize
  } else {
    const element = childElement(at.node)
    if (!element) return
    // New York's roles follow the rank: a subdivision's units are paragraphs.
    const role = at.node.attrs.role ? (element === "subsection" ? "subdivision" : element) : null
    node = freshLevel(state, element, role, "")
    pos = at.pos + at.node.nodeSize - 1
  }
  if (!node) return
  try {
    const tr = state.tr.insert(pos, node)
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1 + node.child(0).nodeSize + 2)))
    view.dispatch(tr.scrollIntoView())
    view.focus()
  } catch {
    // The schema refuses the unit here; nothing changes.
  }
}

export function removeLevel(editor: Editor) {
  const { state, view } = editor
  const at = levelAt(state)
  if (!at) return
  try {
    view.dispatch(state.tr.delete(at.pos, at.pos + at.node.nodeSize).scrollIntoView())
    view.focus()
  } catch {
    // A unit its parent cannot do without stays.
  }
}

/** The USLM editor's groups, at the front of the rich-text toolbar on the XML views (Brendan, 2026-09-14); disabled over a reader with no editor. */
export function XmlToolbarGroups({ editor }: { editor: Editor | null }) {
  const status = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed || !e.isEditable) return { undo: false, redo: false, level: false, under: false }
      const at = levelAt(e.state)
      return { undo: undoDepth(e.state) > 0, redo: redoDepth(e.state) > 0, level: Boolean(at), under: Boolean(at && childElement(at.node)) }
    },
  }) ?? { undo: false, redo: false, level: false, under: false }
  const run = (fn: (e: Editor) => void) => () => editor && fn(editor)
  const keep = (e: React.MouseEvent) => e.preventDefault()

  return (
    <>
      <ToolbarGroup>
        <ToolbarButton tooltip="Undo" disabled={!status.undo} onMouseDown={keep} onClick={run((e) => undo(e.state, e.view.dispatch))}>
          <Undo2Icon />
        </ToolbarButton>
        <ToolbarButton tooltip="Redo" disabled={!status.redo} onMouseDown={keep} onClick={run((e) => redo(e.state, e.view.dispatch))}>
          <Redo2Icon />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarGroup>
        <ToolbarButton tooltip="Add a unit after this one" disabled={!status.level} onMouseDown={keep} onClick={run((e) => insertLevel(e, "after"))}>
          <ListPlusIcon />
        </ToolbarButton>
        <ToolbarButton tooltip="Add a unit under this one" disabled={!status.under} onMouseDown={keep} onClick={run((e) => insertLevel(e, "under"))}>
          <IndentIncreaseIcon />
        </ToolbarButton>
        <ToolbarButton tooltip="Remove this unit" disabled={!status.level} onMouseDown={keep} onClick={run(removeLevel)}>
          <Trash2Icon />
        </ToolbarButton>
      </ToolbarGroup>
    </>
  )
}

// Bold and italic on the XML views (2026-09-15): the schema's own `b` and `i`,
// in the places Plate's buttons stand. Underline and strikethrough stay off:
// in law they are the amendment's marks, and the redline draws them from the
// diff, so a hand-made one would say a change was made that was not.

/** ⌘B and ⌘I on the USLM editor. */
export const XmlMarkKeys = Extension.create({
  name: "xmlMarkKeys",
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleMark("b"),
      "Mod-i": () => this.editor.commands.toggleMark("i"),
    }
  },
})

const AMENDMENT_MARK = "The redline marks what changed"

/** Drawn in place of Plate's bold, italic, underline and strikethrough; `data-live` keeps them out of the toolbar's disabled styling. */
export function XmlMarkButtons({ editor }: { editor: Editor | null }) {
  const status = useEditorState({
    editor,
    selector: ({ editor: e }) => (!e || e.isDestroyed || !e.isEditable ? { on: false, b: false, i: false } : { on: true, b: e.isActive("b"), i: e.isActive("i") }),
  }) ?? { on: false, b: false, i: false }
  const keep = (e: React.MouseEvent) => e.preventDefault()
  const toggle = (mark: "b" | "i") => () => editor?.chain().focus().toggleMark(mark).run()
  return (
    <>
      <ToolbarButton data-live tooltip="Bold (⌘+B)" disabled={!status.on} data-state={status.b ? "on" : "off"} className="data-[state=on]:bg-accent" onMouseDown={keep} onClick={toggle("b")}>
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton data-live tooltip="Italic (⌘+I)" disabled={!status.on} data-state={status.i ? "on" : "off"} className="data-[state=on]:bg-accent" onMouseDown={keep} onClick={toggle("i")}>
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton data-live tooltip={AMENDMENT_MARK} aria-disabled className="cursor-default opacity-50 hover:bg-transparent" onMouseDown={keep}>
        <UnderlineIcon />
      </ToolbarButton>
      <ToolbarButton data-live tooltip={AMENDMENT_MARK} aria-disabled className="cursor-default opacity-50 hover:bg-transparent" onMouseDown={keep}>
        <StrikethroughIcon />
      </ToolbarButton>
    </>
  )
}
