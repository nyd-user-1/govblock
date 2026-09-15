import type { Node as PmNode } from "@tiptap/pm/model"

// The USLM unit around a place in the Tiptap reader or the Fork editor
// (2026-09-15): what a comment anchors to and what Ask AI is asked about.

export type Unit = { identifier: string | null; node: PmNode; start: number; end: number }

/** The innermost unit with an identifier around a position, else the document. */
export function unitAt(doc: PmNode, pos: number): Unit {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.attrs.identifier) return { identifier: String(node.attrs.identifier), node, start: $pos.start(depth), end: $pos.end(depth) }
  }
  return { identifier: doc.attrs.identifier ? String(doc.attrs.identifier) : null, node: doc, start: 0, end: doc.content.size }
}

/** What a unit is called on the page: its number and heading, "§ 2. Definitions". */
export function unitLabel(unit: Unit): string {
  const parts: string[] = []
  unit.node.forEach((child) => {
    if (child.type.name === "num" || child.type.name === "heading") parts.push(child.textContent.trim())
  })
  return parts.filter(Boolean).join(" ")
}
