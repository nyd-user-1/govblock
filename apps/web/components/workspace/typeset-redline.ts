"use client"

import { Extension } from "@tiptap/react"
import { DOMSerializer, type Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import type { MarkedSpec } from "@/lib/typeset/amend"

// The redline in place (window 5, 2026-09-14; moved here by window 6b so the
// Fork view's Redline mode and the in-context view's tabs draw it alike): the
// engine's marked() specs laid over a read-only editor as decorations. Nothing
// is written into the document. Styles are in typeset-fork.css, under
// `.amend-redline`.

export const redlineKey = new PluginKey<DecorationSet>("redline")

/** The engine's specs as decorations over the base: strikes inline and on whole units, insertions as widgets. */
export function decorate(doc: PmNode, specs: MarkedSpec[]): DecorationSet {
  const schema = doc.type.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const out: Decoration[] = []
  for (const s of specs) {
    try {
      if (s.kind === "strike") out.push(Decoration.inline(s.from, s.to, { class: "amend-del" }))
      else if (s.kind === "strike-block") out.push(Decoration.node(s.from, s.to, { class: "amend-del-block" }))
      else if (s.kind === "insert")
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("ins")
              el.className = "amend-ins"
              el.textContent = s.text
              return el
            },
            { side: 1, key: `i:${s.at}:${s.text}` }
          )
        )
      else
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("div")
              el.className = "amend-ins-block"
              el.appendChild(serializer.serializeNode(schema.nodeFromJSON(s.node.toJSON())))
              return el
            },
            { side: -1, key: `b:${s.at}:${s.node.textContent}` }
          )
        )
    } catch {
      // A spec that no longer fits the base is left out rather than breaking the view.
    }
  }
  return DecorationSet.create(doc, out)
}

export const Redline = Extension.create({
  name: "redline",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: redlineKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => {
          const specs = tr.getMeta(redlineKey) as MarkedSpec[] | undefined
          return specs ? decorate(tr.doc, specs) : set.map(tr.mapping, tr.doc)
        },
      },
      props: { decorations: (state) => redlineKey.getState(state) },
    }),
  ],
})
