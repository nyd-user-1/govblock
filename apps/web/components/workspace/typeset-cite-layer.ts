"use client"

import * as React from "react"
import { Extension, type Editor } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import { citationsOf, worksOf, type Cite, type CiteContext } from "@/lib/typeset/cite"
import type { Resolution } from "@/lib/typeset/resolve"
import { workHref } from "@/lib/xml/library"

import "./typeset-cite.css"

// Citations as decorations (window 6, 2026-09-14): the reader and the Fork
// view's editor find a document's citations (lib/typeset/cite.ts), ask the
// corpus once which Works are stored as of the document's date
// (/api/typeset/cite), and lay the answer over the text. A found citation
// opens its Work in Typeset, at the citing date; a missing one is muted; an
// advisory is flagged. Nothing is written into the document, and nothing is
// recomputed per keystroke: a pause after an edit re-reads, and resolutions
// already known are kept in this module.

export type CiteSpec = { from: number; to: number; href: string | null; className: string; title: string; cite: Cite; resolution: Resolution | null }

export const citeKey = new PluginKey<{ set: DecorationSet; specs: CiteSpec[] }>("citations")

export const CiteDecorations = Extension.create<{ onOpen: ((href: string) => void) | null; /** True while a plain click should still open: the XML view takes keystrokes but is read until the first one (2026-09-15). */ reading: (() => boolean) | null }>({
  name: "citeDecorations",
  addOptions: () => ({ onOpen: null, reading: null }),
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: citeKey,
        state: {
          init: () => ({ set: DecorationSet.empty, specs: [] as CiteSpec[] }),
          apply: (tr, value) => {
            const specs = tr.getMeta(citeKey) as CiteSpec[] | undefined
            if (specs) return { specs, set: DecorationSet.create(tr.doc, specs.map((s) => Decoration.inline(s.from, s.to, { class: s.className, title: s.title, "data-cite": s.href ?? "" }))) }
            return { specs: value.specs, set: value.set.map(tr.mapping, tr.doc) }
          },
        },
        props: {
          decorations: (state) => citeKey.getState(state)?.set,
          handleDOMEvents: {
            // A citation opens its Work in the corpus rather than the publisher's page its ref links to.
            // In an editable document a click places the cursor; a modifier click opens.
            click: (view, event) => {
              const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-cite]")
              const href = el?.dataset.cite
              if (!href) return false
              if (view.editable && !options.reading?.() && !(event.metaKey || event.ctrlKey || event.altKey)) return false
              event.preventDefault()
              if (options.onOpen) options.onOpen(href)
              else window.location.assign(href)
              return true
            },
          },
        },
      }),
    ]
  },
})

const known = new Map<string, Resolution>()

function specOf(cite: Cite, resolution: Resolution | undefined, at: string | null): CiteSpec {
  if (!cite.work) return { from: cite.from, to: cite.to, href: null, className: "cite cite-open", title: cite.address ?? cite.text, cite, resolution: null }
  if (!resolution?.found) return { from: cite.from, to: cite.to, href: null, className: "cite cite-missing", title: `${cite.address ?? cite.work} · not in the corpus yet`, cite, resolution: resolution ?? null }
  const advisory = resolution.advisories.map((a) => a.text).join(" ")
  return {
    from: cite.from,
    to: cite.to,
    href: workHref(cite.address ?? cite.work, at),
    className: `cite cite-found${resolution.advisories.length ? " cite-advisory" : ""}`,
    title: [`${resolution.label ?? cite.work}, as of ${resolution.date}`, advisory].filter(Boolean).join(". "),
    cite,
    resolution,
  }
}

export type CiteSummary = { cites: number; works: number; found: number; advisories: number }

/** Finds, resolves and decorates a document's citations; again on a pause after an edit. */
export function useCitations(editor: Editor | null, context: (CiteContext & { at?: string | null; citing?: string | null }) | null): CiteSummary | null {
  const [summary, setSummary] = React.useState<CiteSummary | null>(null)
  const jurisdiction = context?.jurisdiction
  const work = context?.work ?? null
  const at = context?.at ?? null
  const citing = context?.citing ?? null
  const laws = context?.laws

  React.useEffect(() => {
    if (!editor || !jurisdiction) return
    let live = true
    let timer = 0
    const run = async (attempt = 0) => {
      if (!live || editor.isDestroyed) return
      const doc = editor.state.doc
      if (!doc.content.size) return
      const cites = citationsOf(doc, { jurisdiction, work, laws })
      const works = worksOf(cites)
      const missing = works.filter((w) => !known.has(`${at ?? ""}|${w}`))
      if (missing.length) {
        const body = await fetch("/api/typeset/cite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ works: missing, at, citing }) })
          .then((r) => (r.ok ? (r.json() as Promise<{ resolutions: Record<string, Resolution> }>) : { resolutions: {} }))
          .catch(() => ({ resolutions: {} as Record<string, Resolution> }))
        for (const [w, r] of Object.entries(body.resolutions)) known.set(`${at ?? ""}|${w}`, r)
      }
      if (!live || editor.isDestroyed || editor.state.doc !== doc) return
      const specs = cites.map((c) => specOf(c, c.work ? known.get(`${at ?? ""}|${c.work}`) : undefined, at))
      try {
        editor.view.dispatch(editor.state.tr.setMeta(citeKey, specs).setMeta("addToHistory", false))
      } catch {
        // The view is not mounted yet.
        if (attempt < 20) timer = window.setTimeout(() => void run(attempt + 1), 250)
        return
      }
      setSummary({ cites: cites.length, works: works.length, found: specs.filter((s) => s.resolution?.found).length, advisories: specs.filter((s) => s.resolution?.advisories.length).length })
    }
    void run()
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void run(), 1000)
    }
    editor.on("update", onUpdate)
    return () => {
      live = false
      editor.off("update", onUpdate)
      window.clearTimeout(timer)
    }
  }, [editor, jurisdiction, work, at, citing, laws])

  return summary
}
