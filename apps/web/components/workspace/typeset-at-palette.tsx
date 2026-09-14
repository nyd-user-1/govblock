"use client"

import * as React from "react"
import { Extension, type Editor } from "@tiptap/react"
import { Plugin } from "@tiptap/pm/state"
import { LibraryIcon, TextQuoteIcon } from "lucide-react"

import type { AtItem, AtResponse } from "@/app/api/typeset/at/route"
import { FlagChip } from "@/components/policy/imagery"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@govblock/ui/components/nova/command"

// `@` in the Fork view's editor (window 6, 2026-09-14): typing "@" opens one
// palette of references at the cursor. Citations resolve through the address
// scheme (/api/typeset/at), members and committees come from the site's own
// records, and the document's defined terms are listed from its `term` marks.
// Choosing one writes its words in place of the "@", a citation or an entity
// carrying a `ref` to its address or page, which is what the reader's XML
// writes back out.

export const AtTrigger = Extension.create<{ onAt: ((pos: number) => void) | null }>({
  name: "atTrigger",
  addOptions: () => ({ onAt: null }),
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        props: {
          handleTextInput: (_view, from, _to, text) => {
            if (text === "@" && options.onAt) window.setTimeout(() => options.onAt?.(from), 0)
            return false
          },
        },
      }),
    ]
  },
})

/** The words the document defines, from its `term` marks. */
function termsOf(editor: Editor): string[] {
  const out = new Set<string>()
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === "term")) out.add(node.text!.trim())
    return true
  })
  return [...out].filter(Boolean).sort((a, b) => a.localeCompare(b))
}

export function AtPalette({ editor, pos, jurisdiction, state, onClose }: { editor: Editor; pos: number; jurisdiction: string; state: string | null; onClose: () => void }) {
  const [term, setTerm] = React.useState("")
  const [data, setData] = React.useState<AtResponse | null>(null)
  const [pending, setPending] = React.useState(false)
  const terms = React.useMemo(() => termsOf(editor), [editor])
  const coords = React.useMemo(() => {
    try {
      return editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size))
    } catch {
      return null
    }
  }, [editor, pos])

  React.useEffect(() => {
    if (term.trim().length < 2) {
      setData(null)
      return
    }
    let live = true
    setPending(true)
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, jurisdiction })
      if (state) params.set("state", state)
      fetch(`/api/typeset/at?${params}`)
        .then((r) => (r.ok ? (r.json() as Promise<AtResponse>) : null))
        .then((body) => live && setData(body))
        .catch(() => live && setData(null))
        .finally(() => live && setPending(false))
    }, 200)
    return () => {
      live = false
      window.clearTimeout(handle)
    }
  }, [term, jurisdiction, state])

  const close = () => {
    onClose()
    editor.view.focus()
  }

  const insert = (text: string, href: string | null) => {
    const { state: s, view } = editor
    const at = Math.min(pos, s.doc.content.size)
    const typed = s.doc.textBetween(at, Math.min(at + 1, s.doc.content.size)) === "@"
    const marks = href ? [s.schema.marks.ref.create({ href })] : []
    try {
      const tr = s.tr.replaceWith(at, typed ? at + 1 : at, s.schema.text(text, marks))
      tr.insert(at + text.length, s.schema.text(" "))
      view.dispatch(tr.scrollIntoView())
    } catch {
      // Not a place text can go; nothing changes.
    }
    close()
  }

  const matchingTerms = terms.filter((t) => t.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 8)
  const group = (heading: string, items: AtItem[]) =>
    items.length ? (
      <CommandGroup heading={heading}>
        {items.map((item) => (
          <CommandItem key={`${item.kind}-${item.label}-${item.insert.href}`} value={`${item.kind}-${item.label}-${item.insert.href}`} onSelect={() => insert(item.insert.text, item.insert.href)}>
            {item.state ? <FlagChip state={item.state} width={18} /> : <LibraryIcon className="text-muted-foreground" />}
            <span className="max-w-44 shrink-0 truncate font-medium">{item.label}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.detail}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    ) : null

  const empty = !matchingTerms.length && !(data && (data.citations.length || data.members.length || data.committees.length))
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={close} />
      <div className="fixed z-50 w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg" style={{ left: Math.max(16, Math.min((coords?.left ?? 200) - 8, window.innerWidth - 464)), top: (coords?.bottom ?? 200) + 6 }}>
        <Command shouldFilter={false} onKeyDown={(e) => e.key === "Escape" && close()}>
          <CommandInput autoFocus value={term} onValueChange={setTerm} placeholder="10 U.S.C. 130i, a member, a committee, a defined term" />
          <CommandList className="max-h-80">
            {empty && <CommandEmpty>{term.trim().length < 2 ? "Type a citation or a name." : pending ? "Reading the corpus…" : "Nothing by that reference."}</CommandEmpty>}
            {data && group("Citations", data.citations)}
            {matchingTerms.length > 0 && (
              <CommandGroup heading="Defined terms">
                {matchingTerms.map((t) => (
                  <CommandItem key={`term-${t}`} value={`term-${t}`} onSelect={() => insert(t, null)}>
                    <TextQuoteIcon className="text-muted-foreground" />
                    <span className="truncate">{t}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {data && group("Members", data.members)}
            {data && group("Committees", data.committees)}
          </CommandList>
        </Command>
      </div>
    </>
  )
}
