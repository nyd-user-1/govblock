import { Mark, Node, type AnyExtension } from "@tiptap/react"
import type { DOMOutputSpec, MarkSpec, Node as PmNode, NodeSpec, TagParseRule } from "@tiptap/pm/model"

import { MARKS, NODES } from "@/lib/xml/schema"

// The reader's schema as Tiptap extensions (window 1, 2026-09-14): generated
// from lib/xml/schema.ts's node and mark tables, the same tables the server's
// ProseMirror schema is built from, so the editor draws exactly the markup
// the page painted first. Nothing here is hand-written per element.

const attributes = (spec: { attrs?: Record<string, { default?: unknown }> }) =>
  Object.fromEntries(Object.entries(spec.attrs ?? {}).map(([name, a]) => [name, { default: a.default ?? null, rendered: false }]))

function nodeExtension(name: string, spec: NodeSpec) {
  return Node.create({
    name,
    topNode: name === "doc",
    group: spec.group,
    content: spec.content,
    inline: spec.inline,
    atom: spec.atom,
    defining: spec.defining,
    selectable: spec.selectable,
    addAttributes: () => attributes(spec),
    parseHTML: () => (spec.parseDOM ?? []) as TagParseRule[],
    ...(spec.toDOM ? { renderHTML: ({ node }: { node: PmNode }) => spec.toDOM!(node) as DOMOutputSpec } : {}),
  })
}

function markExtension(name: string, spec: MarkSpec) {
  return Mark.create({
    name,
    excludes: spec.excludes,
    addAttributes: () => attributes(spec),
    parseHTML: () => (spec.parseDOM ?? []) as TagParseRule[],
    renderHTML: ({ mark }) => spec.toDOM!(mark, false) as DOMOutputSpec,
  })
}

export const XML_EXTENSIONS: AnyExtension[] = [
  ...Object.entries(NODES).map(([name, spec]) => nodeExtension(name, spec)),
  ...Object.entries(MARKS).map(([name, spec]) => markExtension(name, spec)),
]
