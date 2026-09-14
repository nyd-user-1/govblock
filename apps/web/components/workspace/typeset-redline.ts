"use client"

import { Extension } from "@tiptap/react"
import { DOMSerializer, type Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import type { MarkedSpec } from "@/lib/typeset/amend"
import type { ForkSpec } from "@/lib/typeset/fork-marked"

export { forkMarked, type ForkSpec } from "@/lib/typeset/fork-marked"

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

// ------------------------------------------------------ the redline on the fork ---

// Redline by default, on the text being edited (Brendan, 2026-09-14: "the user
// just puts the cursor in the product and begins editing and the redline view
// is the default"). The same diff, read from the fork's side: what the fork
// adds is marked where it stands in the fork, and what it strikes from the base
// is drawn, struck, where it stood. The struck words are widgets, not text, so
// the cursor passes them and nothing is written into the document.

export const forkRedlineKey = new PluginKey<DecorationSet>("forkRedline")

function decorateFork(doc: PmNode, specs: ForkSpec[]): DecorationSet {
  const schema = doc.type.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const size = doc.content.size
  const out: Decoration[] = []
  for (const s of specs) {
    try {
      if (s.kind === "ins" && s.to <= size) out.push(Decoration.inline(s.from, s.to, { class: "amend-ins" }))
      else if (s.kind === "ins-block" && s.to <= size) out.push(Decoration.node(s.from, s.to, { class: "amend-ins-block" }))
      else if (s.kind === "del" && s.at <= size)
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("del")
              el.className = "amend-del"
              el.contentEditable = "false"
              el.textContent = s.text
              return el
            },
            { side: -1, key: `d:${s.at}:${s.text}`, ignoreSelection: true }
          )
        )
      else if (s.kind === "del-block" && s.at <= size)
        out.push(
          Decoration.widget(
            s.at,
            () => {
              const el = document.createElement("div")
              el.className = "amend-del-block"
              el.contentEditable = "false"
              el.appendChild(serializer.serializeNode(schema.nodeFromJSON(s.node.toJSON())))
              return el
            },
            { side: -1, key: `db:${s.at}:${s.node.textContent}`, ignoreSelection: true }
          )
        )
    } catch {
      // A spec that no longer fits the fork waits for the next diff.
    }
  }
  return DecorationSet.create(doc, out)
}

/** The redline over the editable fork; `setMeta(forkRedlineKey, specs)` redraws it, an empty list clears it. */
export const ForkRedline = Extension.create({
  name: "forkRedline",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: forkRedlineKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => {
          const specs = tr.getMeta(forkRedlineKey) as ForkSpec[] | undefined
          return specs ? decorateFork(tr.doc, specs) : set.map(tr.mapping, tr.doc)
        },
      },
      props: { decorations: (state) => forkRedlineKey.getState(state) },
    }),
  ],
})
