"use client"

import * as React from "react"
import { Extension, type Editor } from "@tiptap/react"
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { IndentIncreaseIcon, LandmarkIcon, LibraryIcon, ListPlusIcon, TextQuoteIcon, Trash2Icon, UserIcon } from "lucide-react"

import type { AtItem, AtResponse } from "@/app/api/typeset/at/route"
import { FlagChip } from "@/components/policy/imagery"
import { childElement, insertLevel, levelAt, removeLevel } from "@/components/workspace/typeset-xml-toolbar"
import { cn } from "@govblock/ui/lib/utils"

// `@` and `/` typed in the text, the way Plate has them (Brendan, 2026-09-14):
// the menu opens at the cursor and filters on what is typed after the
// character, arrows move, Enter or Tab chooses, Escape closes, and the typed
// characters are replaced by the choice. `@` is a person: a member, inserted
// as their name carrying a reference to their page. `/` is everything else:
// the unit commands for the text's structure (the USLM view's headings and
// lists), and references — citations resolved through the address scheme,
// the text's defined terms, committees. A trigger opens only at the start of
// a word, so "and/or" and an email address type through.

export type Trigger = { char: "@" | "/"; from: number; to: number; query: string }

type Open = { char: "@" | "/"; from: number } | null

const key = new PluginKey<Open>("inlineMenu")

export const InlineMenu = Extension.create<{ onChange: ((t: Trigger | null) => void) | null; onKey: ((key: string) => boolean) | null }>({
  name: "inlineMenu",
  addOptions: () => ({ onChange: null, onKey: null }),
  addProseMirrorPlugins() {
    const options = this.options
    let last = ""
    const read = (state: EditorState): Trigger | null => {
      const open = key.getState(state)
      if (!open) return null
      const head = state.selection.from
      return { char: open.char, from: open.from, to: head, query: state.doc.textBetween(open.from + 1, head, " ") }
    }
    return [
      new Plugin<Open>({
        key,
        state: {
          init: (): Open => null,
          apply: (tr, prev, _old, state): Open => {
            const meta = tr.getMeta(key) as { open: "@" | "/"; from: number } | "close" | undefined
            if (meta === "close") return null
            if (meta) return { char: meta.open, from: meta.from }
            if (!prev) return null
            const from = tr.mapping.map(prev.from)
            const head = state.selection.from
            if (!state.selection.empty || head <= from || head - from > 48) return null
            if (state.doc.textBetween(from, from + 1) !== prev.char) return null
            const query = state.doc.textBetween(from + 1, head, "\n")
            if (query.includes("\n") || /\s\s/.test(query)) return null
            return { char: prev.char, from }
          },
        },
        props: {
          handleTextInput: (view: EditorView, from: number, to: number, text: string) => {
            if ((text !== "@" && text !== "/") || !view.editable) return false
            const $from = view.state.doc.resolve(from)
            const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, "", "￼")
            if (before && !/\s/.test(before)) return false
            view.dispatch(view.state.tr.insertText(text, from, to).setMeta(key, { open: text, from }))
            return true
          },
          handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
            if (!key.getState(view.state)) return false
            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(key, "close"))
              return true
            }
            if (["ArrowUp", "ArrowDown", "Enter", "Tab"].includes(event.key)) return options.onKey?.(event.key) ?? false
            return false
          },
          handleClick: (view: EditorView) => {
            if (key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, "close"))
            return false
          },
        },
        view: () => ({
          update: (view: EditorView) => {
            const t = read(view.state)
            const id = t ? `${t.char}:${t.from}:${t.to}:${t.query}` : ""
            if (id === last) return
            last = id
            options.onChange?.(t)
          },
        }),
      }),
    ]
  },
})

export const closeInlineMenu = (editor: Editor) => editor.view.dispatch(editor.state.tr.setMeta(key, "close"))

/** The words the document defines, from its `term` marks. */
function termsOf(editor: Editor): string[] {
  const out = new Set<string>()
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === "term")) out.add(node.text!.trim())
    return true
  })
  return [...out].filter(Boolean).sort((a, b) => a.localeCompare(b))
}

type Row = { id: string; group: string; label: string; detail?: string | null; icon: React.ReactNode; run: () => void }

export function InlineMenuPopup({ editor, trigger, jurisdiction, state, keys }: { editor: Editor; trigger: Trigger; jurisdiction: string; state: string | null; keys: React.RefObject<((key: string) => boolean) | null> }) {
  const [data, setData] = React.useState<AtResponse | null>(null)
  const [pending, setPending] = React.useState(false)
  const [index, setIndex] = React.useState(0)
  const query = trigger.query.trim()
  const terms = React.useMemo(() => (trigger.char === "/" ? termsOf(editor) : []), [editor, trigger.char])

  React.useEffect(() => {
    if (query.length < 2) {
      setData(null)
      return
    }
    let live = true
    setPending(true)
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, jurisdiction })
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
  }, [query, jurisdiction, state])

  // The typed trigger and its words go; what was chosen takes their place.
  const replace = React.useCallback(
    (text: string, href: string | null) => {
      const { state: s, view } = editor
      const marks = href ? [s.schema.marks.ref.create({ href })] : []
      try {
        const tr = s.tr.replaceWith(trigger.from, trigger.to, s.schema.text(text, marks)).setMeta(key, "close")
        tr.insert(trigger.from + text.length, s.schema.text(" "))
        view.dispatch(tr.scrollIntoView())
      } catch {
        closeInlineMenu(editor)
      }
      view.focus()
    },
    [editor, trigger.from, trigger.to]
  )
  const command = React.useCallback(
    (fn: (e: Editor) => void) => {
      const { state: s, view } = editor
      view.dispatch(s.tr.delete(trigger.from, trigger.to).setMeta(key, "close"))
      fn(editor)
      view.focus()
    },
    [editor, trigger.from, trigger.to]
  )

  const matches = (words: string) => !query || words.toLowerCase().includes(query.toLowerCase())
  const entity = (group: string, items: AtItem[] | undefined, icon: React.ReactNode): Row[] =>
    (items ?? []).map((item) => ({
      id: `${item.kind}-${item.label}-${item.insert.href}`,
      group,
      label: item.label,
      detail: item.detail,
      icon: item.state ? <FlagChip state={item.state} width={18} /> : icon,
      run: () => replace(item.insert.text, item.insert.href),
    }))

  const rows: Row[] = React.useMemo(() => {
    if (trigger.char === "@") return entity("People", data?.members, <UserIcon />)
    const at = levelAt(editor.state)
    const structure: Row[] = [
      { id: "unit-after", group: "Structure", label: "Unit after this one", icon: <ListPlusIcon />, run: () => command((e) => insertLevel(e, "after")), ok: Boolean(at) },
      { id: "unit-under", group: "Structure", label: "Unit under this one", icon: <IndentIncreaseIcon />, run: () => command((e) => insertLevel(e, "under")), ok: Boolean(at && childElement(at.node)) },
      { id: "unit-remove", group: "Structure", label: "Remove this unit", icon: <Trash2Icon />, run: () => command(removeLevel), ok: Boolean(at) },
    ]
      .filter((r) => r.ok && matches(r.label))
      .map(({ ok: _ok, ...r }) => r)
    const defined: Row[] = terms.filter(matches).slice(0, 8).map((t) => ({ id: `term-${t}`, group: "Defined terms", label: t, icon: <TextQuoteIcon />, run: () => replace(t, null) }))
    return [...structure, ...entity("Citations", data?.citations, <LibraryIcon />), ...defined, ...entity("Committees", data?.committees, <LandmarkIcon />)]
    // `entity` and `matches` read `query` and `data`, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger.char, data, terms, query, editor, command, replace])

  React.useEffect(() => setIndex(0), [query, trigger.char])

  const shown = rows.length ? Math.min(index, rows.length - 1) : -1
  keys.current = (k: string) => {
    if (k === "ArrowDown") {
      setIndex((i) => (rows.length ? (i + 1) % rows.length : 0))
      return true
    }
    if (k === "ArrowUp") {
      setIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0))
      return true
    }
    if ((k === "Enter" || k === "Tab") && shown >= 0) {
      rows[shown].run()
      return true
    }
    return false
  }

  const coords = React.useMemo(() => {
    try {
      return editor.view.coordsAtPos(Math.min(trigger.from, editor.state.doc.content.size))
    } catch {
      return null
    }
  }, [editor, trigger.from])

  const hint =
    rows.length > 0
      ? null
      : trigger.char === "@"
        ? query.length < 2
          ? "Type a name."
          : pending
            ? "Looking…"
            : "No one by that name."
        : query.length < 2
          ? "Type a command, a citation, a defined term or a committee."
          : pending
            ? "Reading the corpus…"
            : "Nothing by that name."

  let group = ""
  return (
    <div
      className="fixed z-50 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
      style={{ left: Math.max(16, Math.min((coords?.left ?? 200) - 8, window.innerWidth - 432)), top: (coords?.bottom ?? 200) + 6 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-80 overflow-y-auto p-1">
        {hint && <p className="px-2 py-3 text-center text-sm text-muted-foreground">{hint}</p>}
        {rows.map((row, i) => {
          const heading = row.group !== group ? (group = row.group) : null
          return (
            <React.Fragment key={row.id}>
              {heading && <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{heading}</div>}
              <button
                type="button"
                data-active={i === shown}
                onMouseEnter={() => setIndex(i)}
                onClick={row.run}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground")}
              >
                {row.icon}
                <span className="max-w-52 shrink-0 truncate font-medium">{row.label}</span>
                {row.detail && <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.detail}</span>}
              </button>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
